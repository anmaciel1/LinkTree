# LinkTree

A 3D, animated LinkTree. The cover sits on a desk; each page of the book is one of my links — LinkedIn, GitHub, Resume, and a music feature for musicians. Built with React, React Three Fiber, Drei, and Tailwind v4.

## Run it

```bash
npm install
npm run dev
```

Vite will boot the dev server (default `http://localhost:5173/`, or the next free port). Open it and click through the pages of the book.

Build / preview a production bundle:

```bash
npm run build
npm run preview
```

## What's in the book

Each page is configured in `src/components/UI.jsx` under the `pages` array. Adding a link is a matter of dropping in a `{ front, back, link, label }` entry and putting matching `front.jpg` / `back.jpg` textures into `public/textures/`. Clicks on a page either open the page's URL (for normal links) or trigger the music feature (for the musician page, which uses `musicFeature: true` instead of `link`).

The Linktree-style bar at the bottom mirrors the pages so users without 3D appetite can navigate flat.

## The music feature

The musician page opens a modal that lets you paste a Spotify track URL and turn the song into a 15-second snippet you can post — either as a permanent player on the profile or as a tap-to-play story on the avatar. Visitors can listen to that exact 15 seconds without leaving the site.

The flow:

1. **LinkTree mockup** — opens to a card with the regular links (LinkedIn, GitHub, Resume) plus a green CTA to post your song. If a snippet is already posted, the CTA is replaced by a permanent player card with the album art, title, time range, and a play button.
2. **Paste a URL** — accepts `https://open.spotify.com/track/...`, `https://open.spotify.com/intl-pt/track/...`, and `spotify:track:...` URIs. Title and album art come from Spotify's public oEmbed endpoint, so no API keys or backend are required. There's a "Try a sample track" button if you don't have a URL handy.
3. **Pick the clip** — drag a 15-second window across a waveform-style timeline, or hit "Pick for me" to randomize. The picker is capped at 30 seconds, matching Spotify's free preview length, so any clip you pick will actually play.
4. **Preview** — a 9:16 story-style card that auto-plays the chosen 15 seconds via the Spotify Iframe API. The progress bar at the top tracks real playback, not a timer.
5. **Share** — two buttons:
   - **Share to Profile** writes a persistent player card to the LinkTree mockup. Tapping the play button on that card seeks to your `clipStart` and plays for 15 seconds, then pauses automatically.
   - **Share to Story** gives the profile avatar a glowing Instagram-style ring. Tapping the avatar opens a full-card story that auto-plays the 15 seconds and auto-dismisses when it ends.

Both surfaces persist across page reloads via `localStorage` — the prototype has no backend, but the snippet feels permanent. Each surface can be removed or changed independently from the LinkTree screen.

### How playback actually works

The Spotify Iframe API (loaded once from `open.spotify.com/embed/iframe-api/v1`) creates a controllable player. A small `useSnippetPlayer` hook wraps it: it boots a hidden iframe off-screen, seeks to `clipStart`, calls `play()`, listens to `playback_update`, and pauses when position passes `clipStart + 15s`. The visible UI (story progress bar, profile card animation, play/pause icon) is driven by the same updates so the visuals stay synced to real audio.

## Project layout

```
src/
  App.jsx               Canvas + Suspense + UI mount
  components/
    Experience.jsx      Three.js scene: camera, lights, OrbitControls, Float, Book
    Book.jsx            The 3D book — SkinnedMesh pages, bend rig, page-flip animation
    UI.jsx              Page list, nav bar, hover tooltip, banner, jotai atoms
    MusicFeature.jsx    The music modal — LinkTree mockup, URL input, clip picker,
                        story preview, story viewer, saved-song card, Spotify Iframe
                        API wrapper
public/
  textures/             Page artwork (front + back per page)
  audio/                Page-flip sound effect
```

State is in `jotai`. `musicFeatureOpenAtom` toggles the modal. `savedSongAtom` and `storyAtom` are `atomWithStorage` atoms so the posted snippet survives reloads.

## Responsiveness

The 3D camera pulls back on narrower viewports so the book is never cropped. The banner text uses `clamp()` so it scales from ~40px on small phones up to the original large sizes on desktop. The music modal sizes its 9:16 cards against both viewport width and height (`min(320px, 92vw, calc(65vh * 9 / 16))`) and falls back to scroll on landscape phones where the card would otherwise overflow.

## Notes

- Tailwind v4 is configured via `@tailwindcss/vite`; nothing custom in `tailwind.config.*`. Custom CSS — the banner scroll keyframes, the radial-gradient background — lives in `src/index.css`.
- The modal is rendered through `createPortal` into `document.body` so it escapes the R3F Canvas's stacking context.
- The "story" share is purely client-side state — it's not broadcast anywhere. This is a prototype; in a real implementation the snippet would be a row keyed on the user ID with a TTL for stories.
