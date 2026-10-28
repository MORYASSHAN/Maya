# Maya - immersive site

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
| Which live set each page shows, its grade and ambient chord | `src/content/scenes.ts` |
| Live sets: photo plate + 3D models anchored into it | `src/stage/scenes/` |
| Photo plates (art direction) and the anchoring helpers | `public/scenes/`, `src/stage/kit/plate.ts` |
| Composite: aperture transition, bloom, tone map, cursor flow, grain | `src/stage/shaders.ts`, `src/stage/stage.ts` |
| Synthesised sound (pad, whooshes, hover ticks) | `src/audio/sound.ts` |
| Loader, HUD, Index menu, pages | `src/ui/` |
| Design tokens + page styles | `src/styles/global.css`, `src/styles/pages.css` |
| `/simple` (rendered at build time from the same content file) | `build/simplePage.ts`, `src/styles/simple.css` |

Fonts: Cormorant Garamond (headlines), Syncopate (HUD and labels), Inter (body).
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

No code changes needed; both are detected at load.

## Performance notes

- One WebGL canvas. Only the one or two sets on screen render each frame, each into an HDR
  target; render resolution drops automatically if frames run slow.
- All sets are built and their shaders compiled behind the loader.
- `prefers-reduced-motion`: no smooth scrolling, no cursor flow or parallax.
- Sound is opt-in at the loader and can be toggled in the top bar.
