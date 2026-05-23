import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { musicFeatureOpenAtom, pages, savedSongAtom, storyAtom } from "./UI";

const TRACK_DURATION_SEC = 30;
const CLIP_LENGTH_SEC = 15;
const SAMPLE_URL = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";

let spotifyApiPromise = null;
function loadSpotifyApi() {
    if (typeof window === "undefined") return Promise.resolve(null);
    if (spotifyApiPromise) return spotifyApiPromise;
    spotifyApiPromise = new Promise((resolve) => {
        if (window.SpotifyIframeApi) {
            resolve(window.SpotifyIframeApi);
            return;
        }
        const prevReady = window.onSpotifyIframeApiReady;
        window.onSpotifyIframeApiReady = (api) => {
            window.SpotifyIframeApi = api;
            if (prevReady) prevReady(api);
            resolve(api);
        };
        if (document.querySelector('script[src*="spotify.com/embed/iframe-api"]')) return;
        const s = document.createElement("script");
        s.src = "https://open.spotify.com/embed/iframe-api/v1";
        s.async = true;
        document.body.appendChild(s);
    });
    return spotifyApiPromise;
}

function useSnippetPlayer({ trackId, clipStart, clipLength = CLIP_LENGTH_SEC, onEnded }) {
    const elementRef = useRef(null);
    const controllerRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;

    useEffect(() => {
        if (!trackId || !elementRef.current) return;
        let cancelled = false;
        const target = document.createElement("div");
        elementRef.current.appendChild(target);

        loadSpotifyApi().then((API) => {
            if (cancelled || !API) return;
            API.createController(
                target,
                { uri: `spotify:track:${trackId}`, width: "100%", height: 80 },
                (ctrl) => {
                    if (cancelled) {
                        ctrl?.destroy?.();
                        return;
                    }
                    controllerRef.current = ctrl;
                    ctrl.addListener("ready", () => {
                        if (!cancelled) setReady(true);
                    });
                }
            );
        });

        return () => {
            cancelled = true;
            controllerRef.current?.destroy?.();
            controllerRef.current = null;
            setReady(false);
            setPlaying(false);
            setPosition(0);
        };
    }, [trackId]);

    useEffect(() => {
        if (!ready) return;
        const ctrl = controllerRef.current;
        if (!ctrl) return;
        const onUpdate = (e) => {
            const data = e?.data || {};
            const posSec = (data.position ?? 0) / 1000;
            const isPaused = data.isPaused ?? true;
            const elapsed = Math.max(0, posSec - clipStart);
            setPosition(Math.min(clipLength, elapsed));
            setPlaying(!isPaused);
            if (!isPaused && elapsed >= clipLength) {
                ctrl.pause();
                setPlaying(false);
                onEndedRef.current?.();
            }
        };
        ctrl.addListener("playback_update", onUpdate);
        return () => ctrl.removeListener?.("playback_update", onUpdate);
    }, [ready, clipStart, clipLength]);

    const play = useCallback(() => {
        const ctrl = controllerRef.current;
        if (!ctrl || !ready) return;
        ctrl.seek(clipStart);
        ctrl.play();
    }, [ready, clipStart]);

    const pause = useCallback(() => {
        controllerRef.current?.pause();
    }, []);

    const toggle = useCallback(() => {
        if (playing) pause();
        else play();
    }, [playing, play, pause]);

    return { elementRef, ready, playing, position, play, pause, toggle };
}

function parseSpotifyTrackId(input) {
    const raw = input.trim();
    const uriMatch = raw.match(/^spotify:track:([a-zA-Z0-9]+)$/);
    if (uriMatch) return uriMatch[1];
    try {
        const u = new URL(raw);
        if (!u.hostname.includes("spotify.com")) return null;
        const parts = u.pathname.split("/").filter(Boolean);
        const trackIdx = parts.indexOf("track");
        if (trackIdx < 0 || !parts[trackIdx + 1]) return null;
        return parts[trackIdx + 1];
    } catch {
        return null;
    }
}

function formatTime(sec) {
    const total = Math.max(0, Math.floor(sec));
    const m = Math.floor(total / 60);
    const s = (total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

export const MusicFeature = () => {
    const [open, setOpen] = useAtom(musicFeatureOpenAtom);
    const [savedSong, setSavedSong] = useAtom(savedSongAtom);
    const [savedStory, setSavedStory] = useAtom(storyAtom);
    const [step, setStep] = useState("linktree");
    const [urlInput, setUrlInput] = useState("");
    const [trackId, setTrackId] = useState(null);
    const [trackTitle, setTrackTitle] = useState("");
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [artist, setArtist] = useState("Andre Maciel");
    const [clipStart, setClipStart] = useState(30);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) return;
        setStep("linktree");
        setUrlInput("");
        setTrackId(null);
        setTrackTitle("");
        setThumbnailUrl("");
        setArtist("Andre Maciel");
        setClipStart(30);
        setLoading(false);
        setError("");
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, setOpen]);

    if (!open) return null;

    const handleContinue = async (overrideUrl) => {
        const url = (overrideUrl || urlInput).trim();
        if (!url) {
            setError("Paste a Spotify track URL to continue.");
            return;
        }
        const id = parseSpotifyTrackId(url);
        if (!id) {
            setError("That doesn't look like a Spotify track link. Try the share URL.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const canonical = `https://open.spotify.com/track/${id}`;
            const res = await fetch(
                `https://open.spotify.com/oembed?url=${encodeURIComponent(canonical)}`
            );
            if (!res.ok) throw new Error("oEmbed failed");
            const data = await res.json();
            setTrackTitle(data.title || "Untitled Track");
            setThumbnailUrl(data.thumbnail_url || "");
        } catch {
            setTrackTitle("Spotify Track");
            setThumbnailUrl("");
        } finally {
            setTrackId(id);
            setStep("edit");
            setLoading(false);
        }
    };

    const handleAutoPick = () => {
        const max = Math.max(0, TRACK_DURATION_SEC - CLIP_LENGTH_SEC);
        setClipStart(max > 0 ? Math.floor(Math.random() * (max + 1)) : 0);
    };

    const buildSnippet = () => ({
        trackId,
        title: trackTitle,
        thumbnailUrl,
        artist,
        clipStart,
        clipLength: CLIP_LENGTH_SEC,
        postedAt: Date.now(),
    });

    const handleShareToProfile = () => {
        setSavedSong(buildSnippet());
        setStep("linktree");
    };

    const handleShareToStory = () => {
        setSavedStory(buildSnippet());
        setStep("linktree");
    };

    const handleChangeSong = () => {
        if (savedSong?.trackId) {
            setUrlInput(`https://open.spotify.com/track/${savedSong.trackId}`);
            setArtist(savedSong.artist || "Andre Maciel");
        }
        setStep("input");
    };

    const handleRemoveSong = () => {
        setSavedSong(null);
    };

    const handleRemoveStory = () => {
        setSavedStory(null);
        setStep("linktree");
    };

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{
                zIndex: 10000,
                background: "rgba(10,5,4,0.85)",
                backdropFilter: "blur(10px)",
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
            }}
        >
            <button
                onClick={() => setOpen(false)}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition"
                aria-label="Close"
            >
                ×
            </button>

            {step === "linktree" && (
                <LinkTreeStep
                    onSpotify={() => setStep("input")}
                    onChangeSong={handleChangeSong}
                    onRemoveSong={handleRemoveSong}
                    onViewStory={() => setStep("story-viewer")}
                />
            )}

            {step === "input" && (
                <InputStep
                    urlInput={urlInput}
                    setUrlInput={setUrlInput}
                    onContinue={() => handleContinue()}
                    onSample={() => handleContinue(SAMPLE_URL)}
                    onBack={() => setStep("linktree")}
                    loading={loading}
                    error={error}
                />
            )}

            {step === "edit" && (
                <EditStep
                    trackId={trackId}
                    trackTitle={trackTitle}
                    artist={artist}
                    setArtist={setArtist}
                    clipStart={clipStart}
                    setClipStart={setClipStart}
                    onAutoPick={handleAutoPick}
                    onBack={() => setStep("input")}
                    onShare={() => setStep("preview")}
                />
            )}

            {step === "preview" && (
                <PreviewStep
                    trackId={trackId}
                    trackTitle={trackTitle}
                    thumbnailUrl={thumbnailUrl}
                    artist={artist}
                    clipStart={clipStart}
                    onBack={() => setStep("edit")}
                    onShareStory={handleShareToStory}
                    onShareProfile={handleShareToProfile}
                />
            )}

            {step === "story-viewer" && savedStory && (
                <StoryViewerStep
                    story={savedStory}
                    onClose={() => setStep("linktree")}
                    onRemove={handleRemoveStory}
                />
            )}
        </div>,
        document.body
    );
};

const LinkTreeStep = ({ onSpotify, onChangeSong, onRemoveSong, onViewStory }) => {
    const [savedSong] = useAtom(savedSongAtom);
    const [savedStory] = useAtom(storyAtom);
    const linkPages = pages.filter((p) => p.link && p.label);
    const hasStory = !!savedStory;
    return (
        <div className="w-[min(94vw,420px)] max-h-[92vh] overflow-auto rounded-3xl bg-gradient-to-b from-[#1a1110] to-[#0f0807] border border-white/10 p-7 shadow-2xl">
            <div className="flex flex-col items-center text-center">
                <button
                    onClick={hasStory ? onViewStory : undefined}
                    disabled={!hasStory}
                    aria-label={hasStory ? "View story" : "Profile picture"}
                    className={`relative rounded-full transition ${hasStory ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
                    style={
                        hasStory
                            ? {
                                padding: 3,
                                background:
                                    "conic-gradient(from 0deg, #1DB954, #1ed760, #C96442, #1DB954)",
                            }
                            : undefined
                    }
                >
                    <div className={`w-20 h-20 rounded-full bg-[#C96442] flex items-center justify-center text-white text-2xl font-bold shadow-lg ${hasStory ? "ring-2 ring-[#1a1110]" : "ring-4 ring-white/10"}`}>
                        AM
                    </div>
                </button>
                <h2 className="text-white text-xl font-bold mt-4">Andre Maciel</h2>
                <p className="text-white/60 text-sm mt-1">
                    Software Engineer · Musician
                </p>
                <p className="text-white/40 text-xs mt-2">@andremaciel</p>
                {hasStory && (
                    <p className="text-[#1DB954] text-xs mt-1">
                        ♪ Tap profile to hear my story
                    </p>
                )}
            </div>

            <div className="mt-7 flex flex-col gap-3">
                {linkPages.map((p, i) => (
                    <a
                        key={i}
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-3.5 px-5 rounded-xl bg-white/95 hover:bg-white text-[#1a1110] font-semibold text-center transition hover:-translate-y-0.5 shadow"
                    >
                        {p.label}
                    </a>
                ))}

                {savedSong ? (
                    <div className="mt-1">
                        <SavedSongCard song={savedSong} />
                        <div className="flex justify-center gap-4 mt-2 text-xs">
                            <button
                                onClick={onChangeSong}
                                className="text-white/50 hover:text-white transition"
                            >
                                Change song
                            </button>
                            <span className="text-white/20">·</span>
                            <button
                                onClick={onRemoveSong}
                                className="text-white/50 hover:text-red-400 transition"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={onSpotify}
                        className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#1DB954] to-[#1ed760] hover:brightness-110 text-white font-semibold transition hover:-translate-y-0.5 shadow flex items-center justify-center gap-2"
                    >
                        <span className="text-lg leading-none">♪</span>
                        Post Your Song
                    </button>
                )}
            </div>

            <p className="text-white/30 text-xs text-center mt-6">
                Prototype · LinkTree mockup
            </p>
        </div>
    );
};

const SavedSongCard = ({ song }) => {
    const clipLen = song.clipLength ?? CLIP_LENGTH_SEC;
    const clipEnd = (song.clipStart ?? 0) + clipLen;
    const { elementRef, ready, playing, position, toggle } = useSnippetPlayer({
        trackId: song.trackId,
        clipStart: song.clipStart ?? 0,
        clipLength: clipLen,
    });
    const progressPct = (position / clipLen) * 100;
    return (
        <div className="rounded-xl bg-gradient-to-r from-[#1DB954]/25 to-[#1DB954]/5 border border-[#1DB954]/40 overflow-hidden relative">
            <div className="p-3 flex items-center gap-3">
                {song.thumbnailUrl ? (
                    <img
                        src={song.thumbnailUrl}
                        alt=""
                        className="w-12 h-12 rounded-md shrink-0"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-md bg-white/10 flex items-center justify-center text-white/60 shrink-0">
                        ♪
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate text-sm">
                        {song.title}
                    </div>
                    <div className="text-white/60 text-xs truncate font-mono">
                        {song.artist} · {formatTime(song.clipStart)}–{formatTime(clipEnd)}
                    </div>
                </div>
                <button
                    onClick={toggle}
                    disabled={!ready}
                    aria-label={playing ? "Pause snippet" : "Play snippet"}
                    className="w-10 h-10 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 flex items-center justify-center text-white text-sm shrink-0 transition"
                >
                    {playing ? (
                        <span className="flex gap-[3px]">
                            <span className="w-[3px] h-3 bg-white rounded-sm" />
                            <span className="w-[3px] h-3 bg-white rounded-sm" />
                        </span>
                    ) : (
                        <span className="ml-[2px]">▶</span>
                    )}
                </button>
            </div>
            <div className="h-1 bg-white/10 mx-3 mb-2 rounded-full overflow-hidden">
                <div
                    className="h-full bg-[#1DB954]"
                    style={{
                        width: `${progressPct}%`,
                        transition: "width 100ms linear",
                    }}
                />
            </div>
            <div
                ref={elementRef}
                aria-hidden
                style={{
                    position: "absolute",
                    left: "-9999px",
                    top: 0,
                    width: 300,
                    height: 80,
                    pointerEvents: "none",
                    opacity: 0,
                }}
            />
        </div>
    );
};

const InputStep = ({ urlInput, setUrlInput, onContinue, onSample, onBack, loading, error }) => (
    <div className="w-[min(92vw,520px)] rounded-2xl bg-[#1a1110] border border-white/10 p-8 shadow-2xl">
        <button
            onClick={onBack}
            className="text-white/50 hover:text-white text-sm mb-4 flex items-center gap-1 transition"
        >
            <span>←</span> Back
        </button>
        <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#C96442] flex items-center justify-center text-white text-xl">
                ♪
            </div>
            <div>
                <h2 className="text-white text-xl font-semibold">Share your music</h2>
                <p className="text-white/60 text-sm">
                    Paste a Spotify track link to make a 15s story.
                </p>
            </div>
        </div>

        <label className="block text-white/80 text-sm mb-2 mt-6">
            Spotify track URL
        </label>
        <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") onContinue();
            }}
            placeholder="https://open.spotify.com/track/..."
            className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/10 focus:border-[#C96442] focus:outline-none text-white placeholder-white/30 transition"
            autoFocus
        />

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <button
            onClick={() => onContinue()}
            disabled={loading}
            className="w-full mt-5 py-3 rounded-lg bg-[#C96442] hover:bg-[#d97352] text-white font-semibold transition disabled:opacity-50"
        >
            {loading ? "Loading…" : "Continue"}
        </button>

        <div className="flex items-center gap-2 mt-6 text-white/40 text-xs">
            <span className="flex-1 h-px bg-white/10" />
            <span>or</span>
            <span className="flex-1 h-px bg-white/10" />
        </div>

        <button
            onClick={onSample}
            disabled={loading}
            className="w-full mt-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-sm transition disabled:opacity-50"
        >
            Try a sample track
        </button>
    </div>
);

const EditStep = ({
    trackId,
    trackTitle,
    artist,
    setArtist,
    clipStart,
    setClipStart,
    onAutoPick,
    onBack,
    onShare,
}) => {
    const clipEnd = clipStart + CLIP_LENGTH_SEC;
    const maxStart = TRACK_DURATION_SEC - CLIP_LENGTH_SEC;
    return (
        <div className="w-[min(94vw,640px)] max-h-[92vh] overflow-auto rounded-2xl bg-[#1a1110] border border-white/10 p-7 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full bg-[#C96442] flex items-center justify-center text-white">
                    ♪
                </div>
                <div>
                    <h2 className="text-white text-lg font-semibold">Pick your clip</h2>
                    <p className="text-white/60 text-xs">
                        Drag the window or let us pick a 15s snippet.
                    </p>
                </div>
            </div>

            {trackId && (
                <iframe
                    title="Spotify preview"
                    src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
                    width="100%"
                    height="80"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    style={{ borderRadius: "12px", border: "none" }}
                />
            )}

            <div className="mt-4 mb-1 text-white text-base font-semibold truncate">
                {trackTitle}
            </div>
            <div className="flex items-center gap-2 text-white/60 text-sm mb-5">
                <span>by</span>
                <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="bg-transparent border-b border-white/20 focus:border-[#C96442] focus:outline-none text-white px-1 py-0.5 text-sm"
                />
            </div>

            <ClipTimeline
                clipStart={clipStart}
                setClipStart={setClipStart}
                maxStart={maxStart}
            />

            <div className="flex justify-between text-white/70 text-xs mt-2 font-mono">
                <span>{formatTime(clipStart)}</span>
                <span className="text-white/40">15s snippet</span>
                <span>{formatTime(clipEnd)}</span>
            </div>

            <button
                onClick={onAutoPick}
                className="w-full mt-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/90 text-sm transition flex items-center justify-center gap-2"
            >
                <span></span> Pick for me
            </button>

            <div className="flex gap-3 mt-5">
                <button
                    onClick={onBack}
                    className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-medium transition"
                >
                    Back
                </button>
                <button
                    onClick={onShare}
                    className="flex-[2] py-3 rounded-lg bg-[#C96442] hover:bg-[#d97352] text-white font-semibold transition"
                >
                    Share to Story
                </button>
            </div>
        </div>
    );
};

const ClipTimeline = ({ clipStart, setClipStart, maxStart }) => {
    const trackRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    const clipPct = (clipStart / TRACK_DURATION_SEC) * 100;
    const widthPct = (CLIP_LENGTH_SEC / TRACK_DURATION_SEC) * 100;

    const positionFromClientX = (clientX) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const ratio = (clientX - rect.left) / rect.width;
        const center = ratio * TRACK_DURATION_SEC;
        const next = Math.max(0, Math.min(maxStart, center - CLIP_LENGTH_SEC / 2));
        setClipStart(next);
    };

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e) => positionFromClientX(e.clientX);
        const onUp = () => setDragging(false);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [dragging, maxStart]);

    return (
        <div
            ref={trackRef}
            className="relative w-full h-14 rounded-lg bg-black/40 border border-white/10 overflow-hidden cursor-pointer select-none touch-none"
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                positionFromClientX(e.clientX);
                setDragging(true);
            }}
        >
            <div className="absolute inset-0 flex items-center gap-[2px] px-2">
                {Array.from({ length: 80 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-white/20 rounded-sm"
                        style={{
                            height: `${25 +
                                Math.abs(
                                    Math.sin(i * 0.7) * 45 + Math.cos(i * 0.3) * 25
                                )
                                }%`,
                        }}
                    />
                ))}
            </div>
            <div
                className="absolute top-0 bottom-0 bg-[#C96442]/40 border-2 border-[#C96442] rounded-md pointer-events-none"
                style={{ left: `${clipPct}%`, width: `${widthPct}%` }}
            />
        </div>
    );
};

const PreviewStep = ({ trackId, trackTitle, thumbnailUrl, artist, clipStart, onBack, onShareStory, onShareProfile }) => {
    const { elementRef, ready, playing, position, toggle, play } = useSnippetPlayer({
        trackId,
        clipStart,
        clipLength: CLIP_LENGTH_SEC,
    });
    const progressPct = (position / CLIP_LENGTH_SEC) * 100;

    useEffect(() => {
        if (ready) play();
    }, [ready, play]);

    return (
        <div className="flex flex-col items-center gap-4">
            <button
                onClick={onBack}
                className="self-start text-white/70 hover:text-white text-sm flex items-center gap-1 transition"
            >
                <span>←</span> Edit clip
            </button>

            <button
                onClick={toggle}
                disabled={!ready}
                className="relative rounded-2xl overflow-hidden shadow-2xl disabled:opacity-90"
                style={{ width: 320, height: 568 }}
                aria-label={playing ? "Pause" : "Play"}
            >
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{
                            filter: "blur(40px) brightness(0.5)",
                            transform: "scale(1.3)",
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C96442] to-[#3a1a14]" />
                )}

                <div className="absolute top-3 left-3 right-3 h-[3px] bg-white/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white"
                        style={{
                            width: `${progressPct}%`,
                            transition: "width 100ms linear",
                        }}
                    />
                </div>

                <div className="absolute top-7 left-4 right-4 flex items-center gap-2 text-white/85 text-xs">
                    <div className="w-6 h-6 rounded-full bg-[#1DB954] flex items-center justify-center text-[10px] font-bold text-black">
                        S
                    </div>
                    <span>Spotify · {playing ? "Now playing" : ready ? "Tap to play" : "Loading…"}</span>
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                    {thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={trackTitle}
                            className="w-44 h-44 rounded-xl shadow-2xl mb-6"
                        />
                    ) : (
                        <div className="w-44 h-44 rounded-xl bg-white/10 mb-6 flex items-center justify-center text-5xl text-white/40">
                            ♪
                        </div>
                    )}
                    <h3 className="text-white text-xl font-bold text-center px-4 leading-tight">
                        {trackTitle}
                    </h3>
                    <p className="text-white/80 text-sm mt-1">{artist}</p>
                    <div className="mt-6 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur text-white/90 text-xs font-mono">
                        {formatTime(clipStart)} – {formatTime(clipStart + CLIP_LENGTH_SEC)}
                    </div>
                </div>

                <div className="absolute bottom-5 left-0 right-0 text-center text-white/70 text-xs">
                    {playing ? "▶ Playing 15-second snippet" : "15-second snippet"}
                </div>
            </button>

            <div className="flex flex-col gap-2" style={{ width: 320 }}>
                <button
                    onClick={onShareStory}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-[#1DB954] to-[#1ed760] hover:brightness-110 text-white font-semibold transition shadow"
                >
                    Share to Story
                </button>
                <button
                    onClick={onShareProfile}
                    className="w-full py-3 rounded-lg bg-[#C96442] hover:bg-[#d97352] text-white font-semibold transition"
                >
                    Share to Profile
                </button>
            </div>

            <div
                ref={elementRef}
                aria-hidden
                style={{
                    position: "absolute",
                    left: "-9999px",
                    top: 0,
                    width: 300,
                    height: 80,
                    pointerEvents: "none",
                    opacity: 0,
                }}
            />
        </div>
    );
};

const StoryViewerStep = ({ story, onClose, onRemove }) => {
    const clipLen = story.clipLength ?? CLIP_LENGTH_SEC;
    const clipStart = story.clipStart ?? 0;
    const { elementRef, ready, playing, position, play } = useSnippetPlayer({
        trackId: story.trackId,
        clipStart,
        clipLength: clipLen,
        onEnded: onClose,
    });
    const progressPct = (position / clipLen) * 100;

    useEffect(() => {
        if (ready) play();
    }, [ready, play]);

    return (
        <div className="flex flex-col items-center gap-3">
            <div
                className="relative rounded-2xl overflow-hidden shadow-2xl"
                style={{ width: 320, height: 568 }}
            >
                {story.thumbnailUrl ? (
                    <img
                        src={story.thumbnailUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{
                            filter: "blur(40px) brightness(0.45)",
                            transform: "scale(1.3)",
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1DB954] to-[#0a3a18]" />
                )}

                <div className="absolute top-3 left-3 right-3 h-[3px] bg-white/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white"
                        style={{
                            width: `${progressPct}%`,
                            transition: "width 100ms linear",
                        }}
                    />
                </div>

                <div className="absolute top-7 left-4 right-4 flex items-center gap-2 text-white/90 text-xs">
                    <div
                        className="rounded-full"
                        style={{
                            padding: 2,
                            background:
                                "conic-gradient(from 0deg, #1DB954, #1ed760, #C96442, #1DB954)",
                        }}
                    >
                        <div className="w-7 h-7 rounded-full bg-[#C96442] flex items-center justify-center text-white text-[11px] font-bold">
                            AM
                        </div>
                    </div>
                    <span className="font-semibold">@andremaciel</span>
                    <span className="text-white/50">· story</span>
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                    {story.thumbnailUrl ? (
                        <img
                            src={story.thumbnailUrl}
                            alt={story.title}
                            className="w-44 h-44 rounded-xl shadow-2xl mb-6"
                        />
                    ) : (
                        <div className="w-44 h-44 rounded-xl bg-white/10 mb-6 flex items-center justify-center text-5xl text-white/40">
                            ♪
                        </div>
                    )}
                    <h3 className="text-white text-xl font-bold text-center px-4 leading-tight">
                        {story.title}
                    </h3>
                    <p className="text-white/80 text-sm mt-1">{story.artist}</p>
                    <div className="mt-6 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur text-white/90 text-xs font-mono">
                        {formatTime(clipStart)} – {formatTime(clipStart + clipLen)}
                    </div>
                </div>

                <div className="absolute bottom-5 left-0 right-0 text-center text-white/70 text-xs">
                    {playing ? "▶ Playing" : ready ? "Loading…" : "Tap below to play"}
                </div>
            </div>

            <div className="flex gap-3" style={{ width: 320 }}>
                <button
                    onClick={onClose}
                    className="flex-[2] py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition"
                >
                    Close
                </button>
                <button
                    onClick={onRemove}
                    className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/70 hover:text-red-300 text-sm transition"
                >
                    Remove
                </button>
            </div>

            <div
                ref={elementRef}
                aria-hidden
                style={{
                    position: "absolute",
                    left: "-9999px",
                    top: 0,
                    width: 300,
                    height: 80,
                    pointerEvents: "none",
                    opacity: 0,
                }}
            />
        </div>
    );
};
