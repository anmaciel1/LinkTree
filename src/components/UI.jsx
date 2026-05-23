import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { MusicFeature } from "./MusicFeature";
export const pageAtom = atom(0);
export const hoveredPageAtom = atom(-1);
export const musicFeatureOpenAtom = atom(false);
export const savedSongAtom = atomWithStorage("andre-linktree-song-v1", null);
export const storyAtom = atomWithStorage("andre-linktree-story-v1", null);

export const pages = [
    {
        front: "book-cover",
        back: "SWEtools"
    },
    {
        front: "LinkedIN",
        back: "Projects",
        link: "https://www.linkedin.com/in/andre-maciels/",
        label: "LinkedIn"
    },
    {
        front: "GitHub",
        back: "Resume",
        link: "https://github.com/anmaciel1",
        label: "GitHub"
    },
    {
        front: "ResumeImage",
        back: "Arrow",
        link: "/textures/Andre_Maciel_Resume2026.pdf",
        label: "Resume"
    },
    {
        front: "Music",
        back: "book-back",
        musicFeature: true,
        label: "Musician Feature"
    }
];

export const UI = () => {
    const [page, setPage] = useAtom(pageAtom);
    const [hoveredPage] = useAtom(hoveredPageAtom);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const tooltipRef = useRef(null);

    const handleMouseMove = useCallback((element) => {
        setMousePos({ x: element.clientX, y: element.clientY });
    }, []);

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [handleMouseMove]);

    useEffect(() => {
        const audio = new Audio("/audio/page-flip.mp3");
        audio.play();
    }, [page]);

    const hoveredData =
        hoveredPage >= 0 && hoveredPage < pages.length
            ? pages[hoveredPage]
            : null;
    const hoveredLink = hoveredData?.link || "";
    const hoveredLabel = hoveredData?.label || "";
    const hoveredIsMusic = !!hoveredData?.musicFeature;

    return (
        <>
            <main className="pointer-events-none select-none z-10 fixed inset-0 flex justify-between flex-col">
                <a className="pointer-events-auto mt-10 ml-10"></a>
                <div className="w-full overflow-auto pointer-events-auto flex justify-center">
                    <div className="overflow-auto flex items-center gap-4 max-w-full p-10">
                        {[...pages].map((_, index) => (
                            <button
                                key={index}
                                className={`border-transparent hover:border-white transition-all duration-300  px-4 py-3 rounded-full  text-lg uppercase shrink-0 border ${index === page
                                    ? "bg-white/90 text-black"
                                    : "bg-black/30 text-white"
                                    }`}
                                onClick={() => setPage(index)}
                            >
                                {index === 0 ? "Cover" : pages[index].label || `Page ${index}`}
                            </button>
                        ))}
                        <button
                            className={`border-transparent hover:border-white transition-all duration-300  px-4 py-3 rounded-full  text-lg uppercase shrink-0 border ${page === pages.length
                                ? "bg-white/90 text-black"
                                : "bg-black/30 text-white"
                                }`}
                            onClick={() => setPage(pages.length)}
                        >
                            End
                        </button>
                    </div>
                </div>
            </main>

            <div className="fixed inset-0 flex items-center -rotate-2 select-none z-0 pointer-events-none overflow-hidden">
                <div className="relative">
                    <div className="bg-white/0 animate-horizontal-scroll flex items-center gap-8 w-max px-8">
                        <h1 className="shrink-0 text-white text-10xl font-black">
                            Andre Maciel
                        </h1>
                        <h2 className="shrink-0 text-white text-8xl italic font-light">
                            Digital Nest
                        </h2>
                        <h2 className="shrink-0 text-white text-12xl font-bold">
                            Software Developer
                        </h2>
                    </div>
                    <div className="absolute top-0 left-0 bg-white/0 animate-horizontal-scroll-2 flex items-center gap-8 px-8 w-max">
                        <h1 className="shrink-0 text-white text-10xl font-black">
                            Andre Maciel
                        </h1>
                        <h2 className="shrink-0 text-white text-8xl italic font-light">
                            Digital Nest
                        </h2>
                        <h2 className="shrink-0 text-white text-12xl font-bold">
                            Software Developer
                        </h2>
                    </div>
                </div>
            </div>

            {(hoveredLink || hoveredIsMusic) && (
                <div
                    ref={tooltipRef}
                    style={{
                        position: "fixed",
                        left: mousePos.x + 16,
                        top: mousePos.y - 20,
                        zIndex: 9999,
                        background: "#C96442",
                        backdropFilter: "blur(12px)",
                        color: "#fff",
                        padding: "8px 18px",
                        borderRadius: "10px",
                        fontSize: "14px",
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                        textDecoration: "none",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        transition: "opacity 0.15s ease",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                    }}
                >
                    <span style={{ fontSize: "16px" }}>
                        {hoveredIsMusic ? "♪" : "↗"}
                    </span>{" "}
                    {hoveredLabel}
                </div>
            )}

            <MusicFeature />
        </>
    );
};