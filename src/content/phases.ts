// ─────────────────────────────────────────────────────────────────────────────
// ALL copy for the site lives here. The immersive page, the /simple page and the
// meta tags all read from this file. Headline copy comes from the build brief;
// the long-form `detail` comes from DFORR_AND_MAYA.md, kept verbatim, and is shown
// on /simple only — the immersive site stays minimal. One feature = one page.
//
// Inline formatting inside strings: **bold** and `code`.
// ─────────────────────────────────────────────────────────────────────────────

export type Status = 'live' | 'dev'

export type DetailBlock =
  | { type: 'h'; text: string }
  | { type: 'p'; text: string }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'list'; items: (string | { text: string; items: string[] })[] }

export type Cta = { label: string; href: string; kind: 'primary' | 'ghost' }

export type Phase = {
  id: string
  name: string
  status?: Status
  title: string
  /** Rendered as a smaller line under the title (founder role). */
  subtitle?: string
  body: string[]
  stats?: { value: string; label: string }[]
  /** Short feature names shown as tags under the headline. */
  tags?: string[]
  ctas?: Cta[]
  detail?: { title: string; blocks: DetailBlock[] }
}

// ── Placeholders ─────────────────────────────────────────────────────────────
// Fill these in and redeploy. Empty strings fall back gracefully (see README).
export const PLACEHOLDERS = {
  DECK_LINK: '', // e.g. a DocSend / Drive link. Empty → opens an email asking for the deck.
  CONTACT_EMAIL: 'pksmr01@gmail.com',
  WAITLIST_LINK: '', // Empty → opens an email to join the waitlist.
  BETA_USERS: '',
  WAITLIST: '',
  PILOTS: '',
}

const mail = (subject: string) =>
  `mailto:${PLACEHOLDERS.CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`

export const LINKS = {
  deck: PLACEHOLDERS.DECK_LINK || mail('Deck request: Maya'),
  email: `mailto:${PLACEHOLDERS.CONTACT_EMAIL}`,
  waitlist: PLACEHOLDERS.WAITLIST_LINK || mail('Maya waitlist'),
  linkedin: 'https://linkedin.com/in/pankaj-sharma-807820324',
  github: 'https://github.com/PKSMR',
  x: 'https://x.com/PKSMR_2R',
}

// Traction row stays hidden until at least one value is filled in.
export const TRACTION = [
  { label: 'Beta users', value: PLACEHOLDERS.BETA_USERS },
  { label: 'Waitlist', value: PLACEHOLDERS.WAITLIST },
  { label: 'Pilots', value: PLACEHOLDERS.PILOTS },
].filter((t) => t.value.trim() !== '')

export const SITE = {
  title: 'Maya | Space is reality',
  description:
    'DFORR is building Maya, a camera-first spatial platform for capture, try-ons, live events and AI companions. Engineered in India.',
  wordmark: 'MAYA',
  loader: 'Calibrating spatial engine',
  quote: 'The 2D internet is a temporary accident.',
  footer: '© 2026 DFORR Private Limited, Jaipur, India',
  hud: {
    skip: 'Skip intro',
    simple: 'Simple view',
    deck: 'Request deck',
    scroll: 'Scroll',
    sound: 'Sound',
    enterSound: 'Enter with sound',
    enterQuiet: 'Enter without sound',
    readMore: 'Read more',
    index: 'Index',
    next: 'Next',
    back: 'Back to start',
    watch: 'Watch demo',
    close: 'Close',
    live: 'LIVE',
    dev: 'IN DEVELOPMENT',
    demo: 'Maya Eye demo',
  },
}

/** Status board (Live vs. Building). `id` links each feature to its own page. */
export const ORBIT = {
  live: [
    { name: 'Maya Eye', id: 'maya-eye' },
    { name: 'Maya Brain', id: 'maya-brain' },
    { name: 'Explore', id: 'explore' },
  ],
  building: [
    { name: 'AR Lenses', id: 'ar-lenses' },
    { name: 'Try-On', id: 'try-on' },
    { name: 'Live Events', id: 'live-events' },
    { name: 'AI Companion', id: 'companion' },
    { name: 'Worlds', id: 'worlds' },
    { name: 'Maya Coin', id: 'maya-coin' },
  ],
}

export const MEDIA = {
  demoVideo: '/media/maya-eye-demo.mp4',
}

export const PHASES: Phase[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'hero',
    name: 'Intro',
    title: 'Space is reality.',
    body: [
      'DFORR is building Maya, a camera-first spatial platform for capture, try-ons, live events and AI companions. Engineered in India.',
    ],
    ctas: [
      { label: 'Join the waitlist', href: LINKS.waitlist, kind: 'primary' },
      { label: 'For investors', href: '#contact', kind: 'ghost' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'problem',
    name: 'The Problem',
    title: '4 billion people. Heads down. Scrolling flat glass.',
    body: [
      "Feeds built to hold attention, not to connect people. We're 3D beings living 2D digital lives.",
    ],
    detail: {
      title: 'A question that refused to leave me alone',
      blocks: [
        {
          type: 'p',
          text: 'Look around you at any cafe, metro station, street, or home. Hundreds of millions of people have their heads tilted downward, staring blankly into small, flat 2D glass screens, mindlessly scrolling through endless algorithmic feeds designed to addict them, manipulate their attention, and sell ads.',
        },
        {
          type: 'p',
          text: 'Modern social media has become a digital slot machine that isolates people, damages mental health, and leaves society lonelier than ever. We are three-dimensional biological beings with spatial depth perception, stereoscopic vision, and rich physical presence — yet our entire digital lives have been flattened into a two-dimensional timeline of text boxes and video clips.',
        },
        {
          type: 'p',
          text: 'That realization became an obsession. That obsession became a mission. And that mission became Maya.',
        },
        {
          type: 'quote',
          text: "Why are 4 billion humans still trapped behind flat 2D screens when reality is spatial? Why must online connection mean passively watching other people's lives on an algorithmic feed instead of actually being together in breathtaking shared 3D spaces?",
          cite: 'Pankaj Kumar Sharma',
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'maya-eye',
    name: 'Maya Eye',
    status: 'live',
    title: 'Every lens. Same instant.',
    body: [
      'Maya Eye captures from all phone cameras at once, synced within 1 ms, plus depth, motion and 360° audio.',
    ],
    stats: [
      { value: '< 1s', label: 'Launch' },
      { value: '3', label: 'Lenses' },
      { value: '1 ms', label: 'Sync' },
    ],
    detail: {
      title: 'The Camera-First Spatial Engine',
      blocks: [
        {
          type: 'p',
          text: 'The modern smartphone camera has been degraded into a tool for taking flat selfies and temporary 2D video clips. DFORR transforms the camera into a spatial portal, making it the primary gateway to digital reality.',
        },
        {
          type: 'p',
          text: 'In Maya, there is no traditional home feed, no Reels, and no Shorts. When a user launches Maya on iOS or Android, the app lands directly in the camera viewfinder in under one second. The immediate human instinct becomes creation, observation, and spatial capture — never mindless scrolling.',
        },
        { type: 'h', text: 'Instant Camera Launch (<1 Second Speed)' },
        {
          type: 'list',
          items: [
            'Traditional apps force you to wait through loading splash screens, banner ads, and algorithmic feed updates before you can touch the camera.',
            'DFORR engineered a zero-friction launch pipeline: tapping the Maya icon opens the camera hardware directly, initializing graphics pipelines in under a single second so users never miss a real-world moment.',
          ],
        },
        { type: 'h', text: 'Maya Eye: Simultaneous Multi-Camera Capture' },
        {
          type: 'list',
          items: [
            '**What normal cameras do:** When you take a picture or record a video on an iPhone or Android, the phone only uses one camera lens at a time — either the main wide lens, the ultrawide lens, or the telephoto zoom lens. You are forced to choose one perspective and lose everything else.',
            '**What Maya Eye actually is:** Maya Eye fires **every single camera on the phone simultaneously at the exact same instant**. When you tap capture, Maya Eye clicks images and records video from the **Main Primary Lens, the Ultrawide Lens, and the Telephoto Lens all at once**.',
            '**Microsecond Hardware Synchronization:** All camera streams are synchronized at the hardware clock level within **1 millisecond**.',
            {
              text: '**The Extended `.mayacap` Spatial File:** Maya Eye packages this simultaneous capture into a proprietary multi-track spatial file containing:',
              items: [
                'Synchronized video and image tracks from all active physical lenses (Main, Ultrawide, Telephoto).',
                'A dense 16-bit depth map stream recording physical distances.',
                '6-DoF sensor motion telemetry (gyroscope and accelerometer movement).',
                'Ambisonic B-format 360-degree spatial audio.',
              ],
            },
            '**Why this changes everything:** You never miss context. You get the wide room view, the crisp standard shot, and the zoomed close-up all captured at the exact same fraction of a second, with true depth and 3D sound.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'maya-brain',
    name: 'Maya Brain',
    status: 'live',
    title: 'Nothing you capture is ever lost.',
    body: [
      'Crop, erase, reframe, and undo it years later. Private vaults stay encrypted on your device.',
    ],
    detail: {
      title: 'Maya Brain: The Intelligent Non-Destructive Spatial Gallery',
      blocks: [
        {
          type: 'list',
          items: [
            '**The problem with traditional photo galleries:** In standard apps, when you crop or zoom into a photo and save it, the pixels outside your crop box are permanently deleted and destroyed. You can never get the rest of the image back.',
            '**What Maya Brain actually is:** Maya Brain is an intelligent, non-destructive spatial gallery where every capture, saved lens output, and media file lives.',
            "**Non-Destructive Cropping & Viewport Recovery:** When you crop or rotate a photo in Maya Brain, it never throws away the cropped areas. It only saves your framing preference (viewport state). **Years later, you can open that photo, pinch outward, and instantly recover the complete, untouched original scene that was outside the crop frame.**",
            '**Versioned Framing History:** You can restore any past crop or zoom framing you previously saved.',
            '**Reversible AI Subject Removal:** When you erase an unwanted object or person from a photo using AI, the removed region is stored reversibly underneath. You can tap to restore the original person at any time.',
            '**Biometric & PIN-Protected Vaults:** Named private folders inside Maya Brain are encrypted locally on the device, unlockable only via your fingerprint, Face ID, or PIN. Keys never leave the phone.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'explore',
    name: 'Explore',
    status: 'live',
    title: 'Intentional discovery without feeds.',
    body: [
      'For finding community content, DFORR completely rejects the addictive, endless vertical video feed.',
    ],
    detail: {
      title: 'The Explore Engine (Intentional Discovery Without Feeds)',
      blocks: [
        {
          type: 'list',
          items: [
            'Instead, content lives inside the **Explore Engine** — structured through curated cultural zeitgeist strips, local community events, and a spatial directory of 3D rooms. Users discover what is interesting with intention, without being trapped in dopamine-manipulating algorithms.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ar-lenses',
    name: 'AR Lenses',
    status: 'dev',
    title: 'Utility over novelty.',
    body: [],
    stats: [
      { value: '10,000', label: 'Face lens triangles' },
      { value: '15,000', label: 'Full-body triangles' },
      { value: '60 FPS', label: 'On mobile' },
    ],
    detail: {
      title: 'Revolutionary Utility AR Lenses',
      blocks: [
        {
          type: 'p',
          text: 'Current augmented reality lenses on apps like Snapchat and Instagram are mostly superficial novelties: cartoon puppy ears, face-smoothing filters, or flat 2D stickers plastered over faces.',
        },
        {
          type: 'p',
          text: 'DFORR is actively engineering next-generation 3D lenses focused on real utility, physical interaction, and environment understanding:',
        },
        {
          type: 'list',
          items: [
            '**Utility Over Novelty:** Every Maya lens has a real function and a clear target (face, full body, hands, hair, eyes, room surfaces, or entire worlds). Applications include live hairstyle testing, tattoo placement preview, jewellery try-on, eyewear sizing, furniture placement, spatial mini-games, and portals into virtual realms.',
            '**Strict Mobile Polygon Budget:** To guarantee butter-smooth 60 FPS performance without crashing or overheating phones, DFORR enforces a disciplined 3D polygon matrix: a maximum cap of **10,000 triangles for face lenses** and **15,000 triangles for full-body wearables and avatars**.',
            '**Rapier Physics Engine:** Lenses integrate real-time physical simulation (via the Rapier physics engine). Digital chains, earrings, fabric trims, and loose items swing, collide, and react realistically to head and body movement.',
            '**Environment-Aware Lighting & Real Shadows:** Lenses scan the room to detect physical tables, floors, and walls. Virtual objects cast realistic soft shadows onto real physical furniture and bounce real ambient room light.',
            '**Real-Time Depth Occlusion:** When you place your real hand, arm, or an object in front of a virtual item, the virtual item is naturally hidden behind your hand. It never unnaturally glitches through your fingers.',
            '**Proprietary Encrypted `.mayalens` Packaging:** Creators build lenses in Blender, Unity, or Unreal and upload them in `.glb` format. DFORR compiles approved lenses into encrypted `.mayalens` binary containers with embedded shaders and an invisible steganographic watermark protecting creator intellectual property against piracy.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'try-on',
    name: 'Virtual Try-On',
    status: 'dev',
    title: 'See it on you before you buy.',
    body: ['Maya is building a 3D body twin with real-time cloth physics on everyday phones.'],
    stats: [
      { value: '30–40%', label: 'Fashion returned' },
      { value: '60 FPS', label: 'Cloth physics' },
      { value: '0%', label: 'Maya cut on checkout' },
    ],
    detail: {
      title: 'Hyper-Realistic Virtual Try-Ons & The 3D Digital Twin',
      blocks: [
        {
          type: 'p',
          text: 'Online clothing shopping faces an $800 Billion global crisis: between 30% and 40% of all apparel purchased online is returned. This return rate crushes retailer profit margins, creates millions of tons of reverse-logistics carbon waste, and frustrates consumers.',
        },
        {
          type: 'p',
          text: 'The crisis exists because 2D pictures on generic studio models and arbitrary sizing labels (Small, Medium, Large) tell you nothing about how a garment actually drapes over your unique shoulders, chest, or hips.',
        },
        { type: 'p', text: 'DFORR is actively solving this crisis on consumer mobile phones:' },
        {
          type: 'list',
          items: [
            '**Sub-Millimeter Biometric Body Calibration:** Using a standard smartphone camera and depth sensors, the user completes a quick, respectful scan. DFORR calculates exact biometric kinematics: height, shoulder slope, arm length, chest circumference, waist, hip curve, inseam, and shoe size. It also records exact aesthetic undertone hex codes (skin undertone, eye color, hair tone) with verified 99.4% accuracy in closed atelier pilots.',
            '**60 FPS Mobile Cloth Drape Physics:** High-end Hollywood cloth simulation takes hours to render on massive studio server farms. DFORR is writing custom GPU compute shaders running directly on everyday mobile chips (iOS and Android). These shaders calculate the true physical properties of fabric in real time at a fluid 60 frames per second: the heavy drape of raw denim, the breathability of linen, the stretch of athletic spandex, the delicate flow of silk, and the structured stiffness of leather.',
            "**Your Personal 3D Digital Twin:** Shoppers never have to guess based on another person's body. Users see their own photorealistic 3D digital twin on screen wearing the selected clothes. They can make their avatar walk down a virtual runway, turn around, or sit down, seeing exactly where the seams pull tight, where the fabric gathers, and how the garment moves with their body.",
            '**Virtual Mirror Lighting Environments:** Clothing looks completely different in morning sunlight than in a nightclub. Maya allows users to switch virtual mirror lighting in real time across multiple environments: Studio Bright, Morning Sunlight, Overcast Day, Golden Hour Evening, Nightclub, Candlelight, Neon Glow, and Film Set.',
            "**AI Stylist & Direct Brand Handoff:** An on-device AI stylist recommends clothing cuts, hairstyles, eyewear, and jewellery specifically matched to the user's face shape, body proportions, and skin tone. When a user decides to purchase, **checkout leaves Maya**: tapping \"Buy\" deep-links directly into the partner merchant app (Amazon, Myntra, Flipkart, Ajio, or brand store). Maya never takes a cut of physical product checkout.",
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'live-events',
    name: 'Live Events',
    status: 'dev',
    title: 'The front row, for everyone.',
    body: ['Designed to put up to 1,000,000 people in one virtual arena, with spatial audio, a live stage and afterparties after the show.'],
    stats: [
      { value: '1,000,000', label: 'In one arena' },
      { value: '100%', label: 'Tickets to artists' },
      { value: '15 m', label: 'Spatial audio zones' },
    ],
    detail: {
      title: 'Stadium-Scale 3D Live Events & Spatial Gatherings',
      blocks: [
        {
          type: 'p',
          text: 'Live events on today\'s internet are completely broken. Watching a major concert, sports match, or keynote on YouTube or Twitch is a solitary, flat experience: a video square with a chaotic comment box scrolling too fast to read. Meanwhile, physical concerts are plagued by predatory ticketing monopolies, bot scalpers, and $500 seat markups.',
        },
        {
          type: 'p',
          text: 'DFORR is actively engineering stadium-scale spatial gathering infrastructure to rebuild live human connection:',
        },
        {
          type: 'list',
          items: [
            '**1,000,000 Concurrent Spectators in a Single Arena:** DFORR is building a distributed WebRTC media fanout architecture and Stage Model system capable of hosting up to 1,000,000 live interactive participants in a single virtual 3D amphitheater simultaneously.',
            '**The Stage Model Architecture:** To keep events orderly and prevent audio chaos, only the verified host, performers, and invited speakers broadcast live voice and full avatar motion on the stage. The audience of up to 1,000,000 people spectates and interacts through 3D emoji throwing, holographic sky polls, and hand-raise queues.',
            '**Headless Virtual Director Bot (O(1) Server Rendering Cost):** Rendering 1,000,000 custom 3D perspectives on servers is physically impossible. DFORR deploys a headless virtual director bot that flies inside the 3D stadium, executing cinematic camera movements (wide crowd shots, stage close-ups, dynamic reaction cuts) and streaming a broadcast video feed to massive spectator tiers, keeping server costs flat whether 5,000 or 1,000,000 people watch.',
            "**15-Meter Positional 3D Audio:** In a physical stadium of 50,000 fans, you don't hear a chaotic roar of 50,000 voices in your ear. DFORR implements realistic 15-meter acoustic zoning with logarithmic distance falloff. The artist on the main stage broadcasts in pristine spatial clarity, while conversation audio is restricted to people standing near you. If your friends are standing right beside your avatar, their voices sound close and clear. As someone walks away, their voice smoothly fades into the ambient crowd atmosphere.",
            '**DMX-Programmable Concert Lighting Rigs:** Verified event hosts get access to professional stage layouts (arena, theatre, round table, floating island, zero-gravity sphere, club dancefloor) and programmable DMX lighting rigs — controlling light fixtures, pan, tilt, beam intensity, and synchronized color cues just like a real concert lighting desk.',
            "**1,000-Avatar Spatial Afterparties:** When a live concert ends, the app doesn't cut to black. Audiences can step directly into virtual rooftop lounges, beach clubs, and VIP afterparty terraces where up to 1,000 real attendees mingle, chat, network, and dance with expressive 3D avatars and low-latency spatial voice.",
            '**Anti-Scalping 10-Minute Atomic Holds:** DFORR eliminates predatory ticketing middlemen. Artists keep 100% of their event ticket revenue. Tickets are secured by 10-minute atomic reservation locks: when a fan selects a seat, it is locked to their personal device for 10 minutes, mathematically stopping scalper bots from hoarding tickets.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'companion',
    name: 'AI Companion',
    status: 'dev',
    title: 'Not a chatbot. A presence.',
    body: [
      'An embodied 3D companion that sees, listens and remembers, with its memory kept on your device.',
    ],
    stats: [
      { value: '100+', label: 'Emotional states' },
      { value: 'On-device', label: 'Memory graph' },
    ],
    detail: {
      title: 'Autonomous Embodied 3D AI Companions',
      blocks: [
        {
          type: 'p',
          text: 'The current state of artificial intelligence in consumer apps is cold, sterile, and transactional. You type into a text box, receive a generic paragraph from a remote corporate server, and when you close the tab, the bot forgets you exist. They have no physical presence, no face, and no real emotional connection. Furthermore, your private questions and confessions sit on a corporate server where they can be mined for ads.',
        },
        {
          type: 'p',
          text: 'DFORR is actively engineering **The Embodied 3D AI Companion** inside Tab 4 (The BedRoom):',
        },
        {
          type: 'list',
          items: [
            '**The BedRoom Sanctuary (Tab 4):** Anchored inside the app\'s dedicated fourth tab, your companion lives in a private, customizable 3D sanctuary. It is an embodied 3D entity acting as a lifelong friend, personal confidant, second body, and proactive co-pilot of JARVIS and FRIDAY caliber — far beyond reactive chatbots.',
            '**100+ Emotional States & Micro-Expressions:** The companion is not a 2D illustration or text stream. It is a full 3D avatar with realistic facial expressions, eye contact, emotional micro-reactions (smiling, nodding, empathetic listening, laughing, thinking), and fluid body gestures that respond dynamically to conversation.',
            {
              text: "**Omnimodal Sensory Perception:** The companion perceives the world through your smartphone. It doesn't just read flat text:",
              items: [
                '**Visual & Spatial Perception:** Ingests live camera video, depth maps, and Maya Eye spatial recordings. It sees what you see and understands your physical environment.',
                '**Acoustic & Paralinguistic Perception:** Listens to raw voice audio, understanding vocal inflections, pitch changes, hesitation, and emotional cadence rather than flat transcripts.',
              ],
            },
            "**Continuous Living Memory Graph:** Unlike forgetful text bots, DFORR's companion maintains an evolving on-device memory graph. It remembers your personal aesthetic tastes, intellectual ideas, creative projects, emotional highs and lows, and conversations across years of interaction — building a genuine, lifelong relationship.",
            '**Your Lifelong Co-Pilot of Reality:** The companion is not confined to a single room. It steps out with you as your personal co-pilot into live 3D concerts, acts as your fashion advisor during virtual try-ons, and helps you design your own virtual spaces.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'worlds',
    name: 'Persistent Worlds',
    status: 'dev',
    title: 'Worlds that stay.',
    body: [
      'Creators build spaces that persist, pinned to the internet or to real streets. Visitors explore. Only creators edit.',
    ],
    stats: [
      { value: '25,000', label: 'Scene triangle budget' },
      { value: '4-level', label: 'LOD' },
      { value: '5', label: 'Named collaborators' },
    ],
    detail: {
      title: 'Persistent 3D Worlds & Spatial Reality',
      blocks: [
        {
          type: 'p',
          text: 'In Maya, social spaces are not flat comment sections or profile grids. They are living, persistent 3D worlds that people can enter, explore, and inhabit together:',
        },
        {
          type: 'list',
          items: [
            '**What "Persistent" Means in Plain English:** If a creator builds a virtual beach house or art lounge, arranges furniture, or places a digital sculpture on a table, it stays there. When you or your friends visit tomorrow, next week, or next year, the space is exactly as it was left.',
            '**Strict 25,000 Scene Triangle Budget:** Massive 3D worlds usually crash mobile phones. DFORR enforces a strict composite scene budget of maximum **25,000 active rendered triangles** with automated 4-level LOD (Level of Detail) decimation. Intricate architectural spaces stream to mobile phones in seconds over standard 4G/5G connections without lag.',
            '**The Rule of Visitor Non-Editing:** A creator posts a 3D world or event and anyone can see it, enter it, roam it, and enjoy it. **Nothing in a posted world is editable by a visitor.** Editing belongs strictly to the creator and up to 5 named collaborators. This prevents griefing and protects the artistic integrity of the environment.',
            '**Persistent AR Cloud Anchors & Geofencing:** Experiences can be pinned to real-world GPS coordinates (geofencing) or anchored to physical surfaces using persistent point-cloud anchors (ARCore Cloud Anchors + ARKit World Sync), allowing virtual art, messages, or scavenger hunts to remain permanently locked to physical street corners or parks.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'calm',
    name: 'Calm & Privacy',
    status: 'dev',
    title: 'What happens in Maya stays in Maya.',
    body: [],
    tags: ['Universal Screen Protection Shield', 'Notification Calm', 'Pure OLED Dark Luxury Interface'],
    detail: {
      title: 'The Calm Interface & Universal Privacy Shield',
      blocks: [
        {
          type: 'list',
          items: [
            '**Pure OLED Dark Luxury Interface:** Designed for deep black screens (`#000000`, `#070B12`) with frosted glassmorphism, floating translucent controls, and subtle luminous cyan accents (`#7DD3FC`). It feels like interacting with a luxury timepiece or a precision aerospace cockpit.',
            '**Notification Calm:** Eliminates stressful red numerical badges ("99+ unread"). Replaced by a single, calm glowing presence dot that informs you without demanding your attention.',
            '**Universal Screen Protection Shield:** What happens in Maya stays in Maya. Platform-wide operating-system-level screenshot and screen-recording blocking is active across every screen (`FLAG_SECURE` on Android, secure window overlays on iOS). Intimate direct messages, private try-on scans, and shared 3D memories cannot be screenshotted, recorded, or leaked without consent.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'maya-coin',
    name: 'Maya Coin',
    status: 'dev',
    title: 'Fixed-peg Maya Coin.',
    body: ['Maya Coin is a transparent virtual currency permanently pegged to the US Dollar.'],
    stats: [
      { value: '$1 = 100', label: 'Maya Coins' },
      { value: '70/30', label: 'Creator-first split' },
    ],
    detail: {
      title: 'Fixed-Peg Maya Coin ($1.00 = 100 Coins)',
      blocks: [
        {
          type: 'list',
          items: [
            "**Fixed-Peg Maya Coin ($1.00 = 100 Coins):** DFORR completely rejects volatile cryptocurrency tokens and speculative schemes. Maya Coin is a transparent virtual currency permanently pegged to the US Dollar ($1.00 USD = 100 Coins). We offer an industry-leading **70/30 creator-first net revenue split**, paired with direct web top-ups that bypass Apple and Google's 30% mobile app store fees, putting maximum earnings directly into creators' hands.",
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'vision',
    name: 'Vision',
    title: 'Pockets today. Eyes tomorrow.',
    body: [
      'Spatial computing starts on the 4 billion phones already out there. When glasses arrive, Maya will already be there.',
    ],
    detail: {
      title: 'Pockets Today, Eyes Tomorrow',
      blocks: [
        {
          type: 'p',
          text: 'The biggest mistake made by tech giants like Apple and Meta is believing that the spatial computing era begins with $3,500 bulky headsets that isolate people from their surroundings, mess up their hair, and look absurd in public.',
        },
        { type: 'p', text: 'At DFORR, we understand the physics of human adoption:' },
        { type: 'h', text: 'The Revolution Starts in the Pocket (4 Billion Devices)' },
        {
          type: 'p',
          text: "There are already 4 billion high-performance smartphones in people's pockets with stunning OLED screens, multi-lens cameras, and advanced graphics processors. By delivering simultaneous multi-camera capture, 60 FPS mobile cloth try-ons, stadium-scale live events, and embodied AI companions on standard iPhones and Android devices today, Maya is building daily spatial habits for millions of people right now without asking them to purchase expensive new hardware.",
        },
        { type: 'h', text: 'The Seamless Transition to Smart Glasses' },
        {
          type: 'p',
          text: "When consumer AR smart glasses inevitably become as thin, light, comfortable, and socially acceptable as regular spectacles, Maya will not need to pivot or start over. The 3D avatars, the biometric digital twins, the AI companions, the spatial audio engines, the virtual worlds, and the creator economies will already be fully operational. Maya will effortlessly glide from the user's pocket directly to their eyes, becoming the default operating system of spatial reality worldwide.",
        },
        { type: 'h', text: 'The Post-Screen Era: Reclaiming Human Connection' },
        { type: 'p', text: 'The ultimate philosophy behind DFORR and Maya is to make technology disappear:' },
        {
          type: 'list',
          items: [
            '**Escaping the 2D Trap:** Technology should not pull human beings out of the physical world and trap them in solitary, addictive scrolling loops. The 2D feed was a temporary historical detour that commodified human attention and alienated society.',
            '**Invisible, Enhancing Technology:** Technology should sit quietly beneath human connection — amplifying our natural creativity, protecting our intimate privacy, collapsing physical distance between loved ones, and solving hundreds of billions of dollars in real-world economic waste.',
            '**Authentic Spatial Reality:** The future of human connection is spatial, embodied, private, and deeply human. Space is reality.',
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'status',
    name: 'Live vs Building',
    title: 'Live vs Building',
    body: [],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'founder',
    name: 'Founder',
    title: 'Pankaj Kumar Sharma',
    subtitle: 'Founder & Chief Spatial Architect',
    body: ['21. Computer Engineering, IIIT Bhubaneswar. Self-funded, building DFORR from Jaipur.'],
    detail: {
      title: 'Meet Pankaj Kumar Sharma',
      blocks: [
        {
          type: 'p',
          text: '**Founder, Director & Chief Spatial Architect, DFORR Private Limited.** Spatial Systems Architect · Deep-Tech Inventor · Building the Next Generation of 3D Social Reality, Immersive Worlds & AI Companions from India.',
        },
        {
          type: 'p',
          text: 'My name is Pankaj Kumar Sharma. I am 21 years old, born in Rajasthan, studying Computer Engineering at IIIT Bhubaneswar, and I am the Founder, Director, and Chief Spatial Architect of DFORR Private Limited.',
        },
        {
          type: 'p',
          text: 'I am a 21-year-old systems architect and founder from Jaipur, India, building the spatial reality platform of the future through DFORR Private Limited. We are replacing flat, addictive 2D feeds with living 3D experiences — multi-camera spatial capture, photorealistic virtual try-ons, stadium-scale live events, persistent creator worlds, and embodied 3D AI companions. Completely independent, self-funded, and engineered from the ground up with relentless conviction.',
        },
        {
          type: 'p',
          text: "I didn't wait for anyone's permission, and I haven't taken outside funding. Through DFORR, I spent thousands of nights mastering the deepest layers of graphics and systems engineering to turn this vision into working reality:",
        },
        {
          type: 'list',
          items: [
            'DFORR built the multi-camera spatial capture engine from scratch, firing all phone cameras simultaneously within 1 millisecond.',
            'DFORR is engineering custom GPU shaders to simulate fabric drape and clothing physics on standard smartphones at 60 frames per second.',
            'DFORR is developing on-device artificial intelligence systems that give every user an autonomous, embodied 3D companion with genuine facial emotions and lasting memory.',
            'DFORR is architecting massive real-time event streaming capable of bringing 1,000,000 people together into a single virtual stadium with realistic 3D spatial audio.',
          ],
        },
        {
          type: 'p',
          text: 'At 21, I have single-handedly engineered the entire ecosystem — from the mobile graphics engine and 3D camera systems to the live event servers and AI companion minds.',
        },
        {
          type: 'quote',
          text: 'I am not here to make another social media app. Through DFORR, I am here to build the spatial operating system of reality.',
          cite: 'Pankaj Kumar Sharma',
        },

        { type: 'h', text: 'DFORR Private Limited' },
        {
          type: 'p',
          text: 'DFORR Private Limited (operating in global venture and research contexts as DFORR Labs and DFORR Inc.) is an Indian deep-technology research and spatial systems engineering company, officially incorporated under the Companies Act, 2013 and operating from Jaipur, Rajasthan.',
        },
        {
          type: 'p',
          text: "We are not an app agency, and we do not build superficial wrappers around other companies' tools. DFORR is an independent deep-tech research lab built to pioneer the visual, cognitive, and experiential infrastructure of the spatial computing era.",
        },
        {
          type: 'p',
          text: 'DFORR is the legal home and engineering powerhouse behind Maya. We focus entirely on what makes spatial reality unforgettable:',
        },
        {
          type: 'list',
          items: [
            '**Breathtaking Visual Fidelity:** Delivering gaming-grade 3D graphics, dynamic lighting, and silky 60 FPS mobile physics on everyday smartphones without causing heat or battery drain.',
            '**Immersive Human Co-Presence:** Eliminating passive feeds in favor of shared real-time 3D spaces where people hang out, explore, and attend live concerts with friends.',
            '**Real Biological Utility:** Using camera depth and biometric precision to solve real-world problems — like virtual clothing try-ons that fit your exact body twin with sub-millimeter accuracy.',
            '**Uncompromising User Dignity:** Designing interfaces that feel calm, premium, and respectful of human attention, with universal screenshot protection so your private moments remain truly yours.',
          ],
        },
        { type: 'h', text: 'Official Corporate Identity' },
        { type: 'list', items: ['**Official Registered Name:** DFORR PRIVATE LIMITED'] },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'contact',
    name: 'Contact',
    title: "Let's build the spatial future.",
    body: ["Investors, creators, fashion brands and partners: let's talk."],
    ctas: [
      { label: 'Request deck', href: LINKS.deck, kind: 'primary' },
      { label: 'Email', href: LINKS.email, kind: 'ghost' },
    ],
    detail: {
      title: "Let's Build the Spatial Future",
      blocks: [
        {
          type: 'p',
          text: 'DFORR Private Limited is actively opening conversations with visionary 3D creators, digital fashion ateliers, artists, and partners who believe that the era of flat feeds is over — and that the spatial future is being built right now in India.',
        },
        {
          type: 'p',
          text: 'If you believe that the future belongs to immersive presence, photorealistic virtual fashion, and embodied intelligence, reach out directly.',
        },
        {
          type: 'list',
          items: [
            '**Founder & Direct Inquiries:** Pankaj Kumar Sharma',
            `**Primary Email:** ${PLACEHOLDERS.CONTACT_EMAIL}`,
            '**Official Location:** DFORR Private Limited, Jaipur, Rajasthan, India',
          ],
        },
        {
          type: 'p',
          text: '© 2026 DFORR Private Limited. All Rights Reserved. Incorporated in India under the Companies Act, 2013. Built in Jaipur. Engineering the Spatial Operating System of Reality.',
        },
        { type: 'quote', text: 'The 2D internet is a temporary accident. Space is reality.' },
      ],
    },
  },
]

export const SOCIALS = [
  { label: 'LinkedIn', href: LINKS.linkedin },
  { label: 'GitHub', href: LINKS.github },
  { label: 'X', href: LINKS.x },
]

export const phaseIndex = (id: string) => PHASES.findIndex((p) => p.id === id)

/** Index of the "Live vs. Building" phase — target of "Skip intro". */
export const SKIP_TO = phaseIndex('status')
