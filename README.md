# Maya — immersive site

The scroll-driven Three.js site for **Maya**, built by DFORR Private Limited (Jaipur).
One page per feature: each page pins a short, centered intro (uppercase headline, one line,
stats) over a live 3D scene. The 3D does the talking. A "Next" button links every page to the
next, and the right-edge rail jumps to any page. The long-form detail lives on `/simple`.

- `/` — the immersive experience (WebGL, scroll story, drag to look around)
- `/simple` — a fast, single-column version with the same copy and no JavaScript.
  Visitors are sent here automatically when WebGL isn't available.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build on http://localhost:4173
```

Dev-only shortcut: `http://localhost:5173/?goto=6.4` jumps straight to page 7 at 40%.

## Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel. The framework is detected as **Vite**;
   `vercel.json` already sets the build command, the `dist` output, clean URLs (`/simple`) and
   long-cache headers for hashed assets.
2. In **Project → Settings → Environment Variables**, set `SITE_URL` to your final domain,
   e.g. `https://maya.example.com`. It is used for Open Graph/Twitter tags, the canonical URL,
   `robots.txt` and `sitemap.xml`. Without it the build falls back to Vercel's production URL.
3. Deploy.

## Where things live

| What | Where |
| --- | --- |
| **All copy** (headlines, stats, long-form detail, links, placeholders) | `src/content/phases.ts` |
| Page layout, status chips, HUD + next-page button | `src/ui/` |
| 3D scenes (one per page; hero + problem share the feed) | `src/canvas/scenes/` |
| Camera path per page | `src/canvas/CameraRig.tsx` |
| Lighting moods (try-on studio → golden → neon, companion room) | `src/canvas/Lights.tsx` |
| Interactive diamond-block background (red glow follows the cursor) | `src/canvas/Backdrop.tsx` |
| Design tokens, HUD, loader | `src/styles/global.css` |
| Page + card styles | `src/styles/pages.css` |
| `/simple` (rendered at build time from the same content file) | `build/simplePage.ts`, `src/styles/simple.css` |

Headline copy comes from the build brief; the long-form detail (shown on `/simple`) comes from
`DFORR_AND_MAYA.md`. Fonts: Oswald (uppercase headlines), Inter (body), JetBrains Mono (labels).
Edit `phases.ts` and both `/` and `/simple` update.

## Fill in the placeholders

Open `src/content/phases.ts` → `PLACEHOLDERS`:

| Key | Used for | If left empty |
| --- | --- | --- |
| `DECK_LINK` | "Request deck" buttons | Opens an email to `CONTACT_EMAIL` with subject "Deck request" |
| `CONTACT_EMAIL` | Email button, deck/waitlist fallbacks | Set to `pksmr01@gmail.com` (from the content doc) |
| `WAITLIST_LINK` | "Join the waitlist" | Opens an email with subject "Maya waitlist" |
| `BETA_USERS`, `WAITLIST`, `PILOTS` | Traction row on the Live vs. Building page | The row stays hidden until at least one value is set |

## Drop in media

| File | Effect |
| --- | --- |
| `public/media/maya-eye-demo.mp4` | A "Watch demo" button appears on the Maya Eye page and plays it in a lightbox. Hidden until the file exists. |
| `public/media/founder.jpg` | The founder page samples this photo into the dot-matrix portrait (falls back to a neutral silhouette). A well-lit head-and-shoulders crop on a dark background works best. |

No code changes needed; both are detected at load.

## Swapping in real 3D models

Everything is procedural today, so there are no model downloads. `src/canvas/shared/ModelSlot.tsx`
lists the slots (`glasses`, `coin`). Export a Draco-compressed `.glb`, put it in `public/models/`
and set its URL in `MODELS`. The procedural version stays as the loading fallback. For KTX2
textures, copy `node_modules/three/examples/jsm/libs/basis/` to `public/basis/`. The loader code
is split out and only downloads when a model URL is set.

## Performance notes

- One persistent `<Canvas>`. Each scene is hidden and skips its updates outside its page and the
  crossfade into its neighbours. The render loop pauses when the tab is hidden.
- DPR is clamped to `[1, 1.75]` (lower on phones and low tiers) and drops further if FPS falls
  (`PerformanceMonitor`).
- Particle and instance counts scale with the GPU tier (`detect-gpu`, benchmarks served locally
  from `public/benchmarks`) and with mobile. Low-tier GPUs also skip bloom.
- All shaders compile behind the loader, so nothing hitches on first scroll.
- `prefers-reduced-motion`: no smooth scrolling, scenes hold a still frame, and pages crossfade.
- `/simple` ships no JavaScript. Lighthouse (mobile, production build): Performance 98,
  Accessibility 100, Best Practices 100.

Measure 60 FPS on a real mid-range Android: open the deployed site, enable
*Chrome DevTools → Rendering → Frame rendering stats* over USB debugging, and scroll the
whole story. The heaviest pages are Live Events (crowd particles) and the hero feed.
