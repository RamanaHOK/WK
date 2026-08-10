/* ============================================
   PREVAILER MATATU JOURNEY — scroll.js
   Continuous rAF engine: scroll-driven + time-based motion
   ============================================ */

const SCENES = 42; // ends after scene-73
// Per-scene scroll multipliers — how many viewport-widths of scroll each scene consumes.
// Lower = faster transition. Scene 4 (savanna) is intentionally quick.
const SCENE_SCROLL = [
  1.2,  // 0  → scene-1  (jungle intro)
  1.2,  // 1  → scene-2  (jungle story)
  1.2,  // 2  → scene-3  (jungle detail)
  0.4,  // 3  → scene-4  (savanna — intentionally fast)
  1.2,  // 4  → scene-5  (city arrival)
  1.2,  // 5  → scene-6  (city continued)
  1.5,  // 6  → scene-7  (bus stop characters)
  14.0, // 7  → scene-8  (problem plaza + zoom sequence)
  1.5,  // 8  → scene-12 (wide city s12-s15, part A)
  8.0,  // 9  → scene-13 (wide city — zoom + popups)
  4.0,  // 10 → scene-21 (top-down road — 3 vehicles in 3 lanes)
  2.0,  // 11 → scene-26 (street arrival — ambient characters)
  1.3,  // 12 → scene-27 (Asmelash Teka Hadgu & Away Ly swap in together)
  1.3,  // 13 → scene-28 (Chris Emezue & Kathleen Siminyu swap in together)
  1.3,  // 14 → scene-29 (Sadik Shahadu & Samuel Rutunda swap in together)
  3.5,  // 15 → scene-30 (zoom + Awa Ly's message — widened so the hold has real scroll room)
  5.0,  // 16 → scene-32 (inside the matatu — extra "dummy" scroll runway, not new visual content, so the 4 popups/characters don't feel clubbed together)
  1.5,  // 17 → scene-33
  1.5,  // 18 → scene-34
  1.5,  // 19 → scene-44 (slides down from the top over scene-34 — see #s44-overlay/animateS44 in scroll.js)
  4.0,  // 20 → scene-45 (inside the matatu, continued — Kathleen/toto moto/red lady/wheelchair man sequence — extra scroll runway so each one gets real time on screen, especially wheelchair man at the end)
  1.5,  // 21 → scene-46 (red lady with bag ambient)
  1.5,  // 22 → scene-47 (wheelchair man ambient)
  0.4,  // 23 → scene-55 (street scene — matatu parked outside Municipal Federation building)
  0.4,  // 24 → scene-56 (second popup)
  0.4,  // 25 → scene-57 (third, bigger popup)
  0.3,  // 26 → scene-58 (pans past the street into clear sky)
  // Total 1.5 viewport-widths, matching #s55-s58-bg's new 150vw width (was 5.7/400vw) — no
  // dead scroll past where the content actually ends.
  0.3,  // 27 → scene-59 (park/lake — bridge, trees, bus driving through; first popup)
  0.3,  // 28 → scene-60 (second popup — kids playing catch on the path)
  0.3,  // 29 → scene-61
  0.3,  // 30 → scene-62
  0.3,  // 31 → scene-63
  0.3,  // 32 → scene-64 (fourth popup — vendor/elder/wheelchair group)
  0.3,  // 33 → scene-65
  0.3,  // 34 → scene-66
  0.3,  // 35 → scene-67
  0.3,  // 36 → scene-68
  0.3,  // 37 → scene-69
  0.3,  // 38 → scene-70
  0.3,  // 39 → scene-71
  0.3,  // 40 → scene-72
  0.3,  // 41 → scene-73 (closing scene)
  // Total 4.5 viewport-widths, matching #s59-s73-bg's 450vw width — same "no dead scroll"
  // match as scenes 55-58. Each of the 15 gets an equal, modest scroll window (first draft
  // — retune individually once the real popup text for 61-63/65-73 comes in, since some may
  // need more/less room than others).
];

// ---- Per-scene configuration ----
// Tune each scene independently here.
const SCENE_CONFIG = {
  // Jungle bus keyframes — one continuous journey across scenes 1–3.
  // `scene` : which jungle scene (1, 2, or 3)
  // `at`    : 0–100  — percentage through THAT scene  (easy to read in the debug bar)
  // `x`     : bus left-edge position in vw  (negative = off-screen left, 0–70 = visible, 100+ = off-screen right)
  // Add as many stops as you like — engine interpolates between them.
  jungleBus: [
    { scene: 1, at:   0, x: -35 },   // scene 1,   0% — fully off-screen left
    { scene: 1, at:  5, x:   5 },   // scene 1,  50% — bus fully visible
    { scene: 1, at:  10, x:   10 },   // scene 1,  50% — bus fully visible
    { scene: 1, at:  15, x:   15 },   // scene 1,  50% — bus fully visible
    { scene: 1, at:  20, x:   15 },   // bus parks here
    { scene: 1, at:  50, x:   15 },   // hold stopped — no movement until scene 2
    { scene: 2, at:   0, x:  30 },   // scene 2,   0% — cruising
    { scene: 2, at: 100, x:  60 },   // scene 2, 100%
    { scene: 3, at:   0, x:  60 },   // scene 3,   0%
    { scene: 3, at:   5, x:  70 },   // scene 3,   5% — bus stops here (right edge = viewport edge)
    { scene: 3, at: 100, x:  70 },   // scene 3, 100% — frozen until scene 4 enters from right
  ],

  // City buses (scenes 5 & 6) — single speed per scene
  5: { hasBus: true, busSpeed: 1.5, busOffset: 0.26 },  // enters from left, fully visible at scene4 70%
  6: { hasBus: true, busSpeed: 1.5, busOffset: 0.085, noPreEntry: true }, // continues from scene5 bus exit position
  4: { hasBus: false },
};

// Scenes that share the single fixed jungle bus
const JUNGLE_BUS_SCENES = [1, 2, 3];

// Scene-8 shared constants
const S8_EXIT          = 0.77;  // legacy ref kept for nearBusClose offset
const ZOOM_END         = 0.36;  // zoom-in phase ends here
const S8_PAN_MAX       = 0.40;  // vw units the background strip pans left during zoom
const BUS_CLOSE        = 0.75;  // bus close-up zoom starts here (after second popup)
const BUS_SCROLL_START = 0.88;  // bus slides off right from here; strip transitions to scene 11
const BUS_CLOSE_MULT   = 0.6;     // ← tune this: how many × zoomMax the bus zooms during close-up

// Scene 45's own local range used by the scene-44 exit zoom (see animateS44's exitT) —
// how fast the old overlay fades/zooms away. Independent from S45_STICKY_RANGE below.
const S45_EXIT_RANGE = 0.3;
// How long scene 45 stays fully still (no pan) before normal scrolling resumes — covers
// Kathleen's whole appearance so nothing moves while she's on screen.
const S45_STICKY_RANGE = 1.0;
// Scene 46's pan eases (not snaps) toward the position that centers the wheelchair man on
// screen by S46_HOLD_START, stays pinned there through S46_HOLD_END while he zooms in and
// his popup shows, then eases back to the normal continuous pan by the scene's end. Slower/
// gentler than a hard freeze+snap — see frame()'s effectiveTx and animateS45S48.
const S46_HOLD_START = 0.45;
const S46_HOLD_END = 0.8;
// (Scenes 55-57's slow-pan blend was removed — SCENE_SCROLL there is now small enough,
// 0.4/0.4/0.4/0.3 total, that natural panning alone doesn't feel frozen; the blend was tuned
// against the old, much larger values and became badly mismatched once those shrank, causing
// it to overshoot and run the background out of content too early — see #s55-s58-bg's width.)
// The zoom-in itself is wall-clock timed, not scroll-driven — once the pan settles him into
// center (S46_HOLD_START), it plays out on its own like a video over S46_ZOOM_MS, no further
// scrolling needed, then stays zoomed for the rest of scene 46 (see _s46ZoomT0 in frame()).
const S46_ZOOM_MS = 900;
// Once zoomed in, the Huniki popup shows first, stays up for S46_HUNIKI_MS, then fades out
// and the Big Tech popup queues in behind it — both wall-clock timed off the same
// _s46ZoomT0, same "plays on its own" approach as the zoom itself (see animateS45S48).
const S46_HUNIKI_MS = 4500;

// ---- DOM ----
const pinnedWrap  = document.getElementById('pinned-wrap');
const scrollX     = document.getElementById('scroll-x');
const spacer      = document.getElementById('scroll-spacer');
const progressBar      = document.getElementById('progress-bar');
const navProgressFill  = document.getElementById('navProgressFill');
const scrollHint  = document.getElementById('scroll-hint');
const dots        = document.querySelectorAll('.dot');

const panels = {
  1: document.getElementById('panel-1'),
  2: document.getElementById('panel-2'),
  3: document.getElementById('panel-3'),
  5: document.getElementById('panel-5'),
  6: document.getElementById('panel-6'),
  7: document.getElementById('panel-7'),
  8: document.getElementById('panel-8'),
  9: document.getElementById('panel-9'),
  10: document.getElementById('panel-12'),  // panel-12 popup shown at scroll index 9 (new scene-13)
  24: document.getElementById('panel-55'),  // scroll index 23 (scene-55) — was 25/index24 before scene-48 was removed
  25: document.getElementById('panel-56'),  // scroll index 24 (scene-56)
  26: document.getElementById('panel-57'),  // scroll index 25 (scene-57)
};
const panel5Driver = document.getElementById('panel-5-driver');
const popup8a    = document.getElementById('panel-8a');
const popup8b    = document.getElementById('panel-8b');
const popup13a   = document.getElementById('panel-13a');
const panelS13_1 = document.getElementById('panel-s13-1');
const panelS13_2 = document.getElementById('panel-s13-2');
const panelS13_3 = document.getElementById('panel-s13-3');

// Single fixed bus across all jungle scenes
const jungleBus = document.getElementById('jungle-bus');

// Debug scale refs
const dbgScene  = document.getElementById('dbg-scene');
const dbgTime   = document.getElementById('dbg-time');
const dbgBus    = document.getElementById('dbg-bus');
const dbgCursor = document.getElementById('dbg-cursor');

// Single fixed bus that rides across city scenes 5–6
const cityBus       = document.getElementById('city-bus');
const s12s15bg      = document.getElementById('s12-s15-bg');
const s21Preview    = document.getElementById('s21-preview');
const cityBusEmpty  = document.getElementById('city-bus-empty');
const cityBusPeople = document.getElementById('city-bus-people');
const cityBusFull    = document.getElementById('city-bus-full');
const cityBusPeople1 = document.getElementById('city-bus-people1');
const cityBusS26     = document.getElementById('city-bus-s26');
const cityBusInside  = document.getElementById('city-bus-inside');
const cityBusS55     = document.getElementById('city-bus-s55');
const s5558Car        = document.getElementById('s5558-car');
const s5558Car2       = document.getElementById('s5558-car2');
const s5558Car3       = document.getElementById('s5558-car3');
const s5558TransitionFrameFront = document.getElementById('s5558-transition-frame-front');
const s4548Bg = document.getElementById('s45-s48-bg');
// Scenes 59-73 popups — array indexed 0..14 matching scroll indices 27..41 (scene-59..73)
const s5973Panels = [59,60,61,62,63,64,65,66,67,68,69,70,71,72,73].map(n => document.getElementById(`panel-${n}`));
const cityAwayStand  = document.getElementById('city-awayly-stand');
const cityAwayHandle = document.getElementById('city-awayly-handle');
const cityBusHandleProp = document.getElementById('city-bus-handle-prop');
const panel30AwayLy  = document.getElementById('panel-30-awayly');
const panel32Intro   = document.getElementById('panel-32-intro');
const panel32Umuganda = document.getElementById('panel-32-umuganda');
const panel32Lesan    = document.getElementById('panel-32-lesan');
const panel32Samuel   = document.getElementById('panel-32-samuel');
const panel32Asmelash = document.getElementById('panel-32-asmelash');
const panel32Asmelash2 = document.getElementById('panel-32-asmelash2');
const panel32PregnantUp   = document.getElementById('panel-32-pregnant-up');
const panel32PregnantDown = document.getElementById('panel-32-pregnant-down');
const panel32Sadik = document.getElementById('panel-32-sadik');
const s44Overlay = document.getElementById('s44-overlay');
const panel44_1 = document.getElementById('panel-44-1');
const s44TotoMoto = document.querySelector('.s44-toto-moto');
const s4548Visual = document.getElementById('s45-s48-visual');
const char45Kathleen   = document.querySelector('.char-s45-kathleen');
const char45TotoMoto   = document.querySelector('.char-s45-totomoto');
const char45RedLady    = document.querySelector('.char-s45-redlady');
const char45Wheelchair = document.querySelector('.char-s45-wheelchair');
const panel45Kathleen = document.getElementById('panel-45-kathleen');
const soundCaptionKathleen = document.getElementById('sound-caption-kathleen');
const soundCaptionTotoMoto = document.getElementById('sound-caption-totomoto');
const panel45TotoMoto = document.getElementById('panel-45-totomoto');
const panel45RedLady = document.getElementById('panel-45-redlady');
const panel46Huniki = document.getElementById('panel-46-huniki');
const panel46BigTech = document.getElementById('panel-46-bigtech');
const panel47Chris = document.getElementById('panel-47-chris');
const soundCaptionChris = document.getElementById('sound-caption-chris');
// Chris Emezue + the last red-topped woman are baked directly into Seats%20extended.svg's
// own art (not a separate movable sprite) — confirmed in-browser at scene 47, local ~17%,
// see panel-47-chris's showChris window below.
const char32OldLady   = document.querySelector('.char-s32-oldlady');
const char33GirlPhone = document.querySelector('.char-s33-girlphone');
const char39Samuel     = document.querySelector('.char-s39-samuel');
const char37Asmelash   = document.querySelector('.char-s37-asmelash');
const char37Asmelash2  = document.querySelector('.char-s37-asmelash2');
const char35Pregnant   = document.querySelector('.char-s35-pregnant');
const char32Sadik      = document.querySelector('.char-s32-sadik');

// Fixed trees overlay for scene 4 — sits above #jungle-bus (z:11 vs z:10)
const s4TreesOverlay = document.getElementById('s4-trees');
// Fixed trees overlay for scene 5 — sits above #city-bus in root stacking context
const cityTrees5    = document.getElementById('city-trees-5');
// Fixed seller overlay for scenes 55-58 — sits above #s5558-car in root stacking context
// (see the HTML/CSS comments on #s5558-seller-front for why this can't just be a z-index
// bump on the in-background .s5558-* version)
const s5558SellerFront = document.getElementById('s5558-seller-front');
// Fixed character + tree overlays for scenes 7, 8 & 9
const cityOverlay7  = document.getElementById('city-overlay-7');
const cityOverlay8  = document.getElementById('city-overlay-8');
const cityOverlay9   = document.getElementById('city-overlay-9');
const cityOverlay12  = document.getElementById('city-overlay-12');

// City scene parallax — img elements targeted directly.
// applyCityParallax runs AFTER animateLayerReveals (which clears img transforms),
// so the pattern is: clear → re-set every frame with no flicker.
const s5ParallaxEls = {
  buildingImg: document.querySelector('.scene-5 .layer-city-buildings img'),
  cloudImg:    document.querySelector('.scene-5 .layer-city-clouds img'),
};
const s6ParallaxEls = {
  buildingImg: document.querySelector('.scene-6 .layer-city-buildings img'),
  cloudImg:    document.querySelector('.scene-6 .layer-city-clouds img'),
};
const s7ParallaxEls = {
  treeImg:     document.querySelector('.scene-7 .layer-city-trees img'),
  buildingImg: document.querySelector('.scene-7 .layer-city-buildings img'),
  cloudImg:    document.querySelector('.scene-7 .layer-city-clouds img'),
  redGirl:     document.querySelector('.char-s7-red-girl'),
  granny:      document.querySelector('.char-s7-granny'),
  orangeMan:   document.querySelector('.char-s7-orange-man'),
  greenMan:    document.querySelector('.char-s7-green-man'),
};
const s8ParallaxEls = {
  buildingImg: document.querySelector('.scene-8 .layer-city-buildings img'),
  treeImg:     document.querySelector('.scene-8 .layer-city-trees img'),
  cloudImg:    document.querySelector('.scene-8 .layer-city-clouds img'),
  purpleMan:   document.querySelector('.char-s8-purple-man'),
  blueGirl:    document.querySelector('.char-s8-blue-girl'),
  limeMan:     document.querySelector('.char-s8-lime-man'),
  greenMan:    document.querySelector('.char-s8-green-man'),
};
const s9ParallaxEls = {
  buildingImg: document.querySelector('.scene-9 .layer-city-buildings img'),
  cloudImg:    document.querySelector('.scene-9 .layer-city-clouds img'),
};

// ---- Parallax elements for new scenes 12–19 ----
// Each object mirrors the layer structure defined in style.css.
// Null-safe: querySelector returns null for missing layers, move() handles that gracefully.

// Scene 12: bus stop with 3 characters
const s12ParallaxEls = {
  cloudImg:    document.querySelector('.scene-12 .layer-s12-clouds img'),
  buildingImg: document.querySelector('.scene-12 .layer-s12-buildings img'),
  treeImg:     document.querySelector('.scene-12 .layer-s12-tree img'),
  greenMan:    document.querySelector('.char-s12-green-man'),
  blueMan:     document.querySelector('.char-s12-blue-man'),
  blueGirl:    document.querySelector('.char-s12-blue-girl'),
};

// Scene 13: Algorithm Avenue bus stop (no people)
const s13ParallaxEls = {
  cloudImg:    document.querySelector('.scene-13 .layer-s13-clouds img'),
  buildingImg: document.querySelector('.scene-13 .layer-s13-buildings img'),
  treeImg:     document.querySelector('.scene-13 .layer-s13-tree img'),
};

// Scene 21: top-down road — 3 vehicles in 3 lanes
// Scene-21 vehicles — all in fixed overlay
const s21Vehicles   = document.getElementById('s21-vehicles');
const s21CloudsWrap = document.getElementById('s21-clouds');
const s21vMeta      = document.getElementById('s21v-meta');
const s21vOpenAI    = document.getElementById('s21v-openai');
const s21vMatatu    = document.getElementById('s21v-matatu');
const s21vGoogle    = document.getElementById('s21v-google');
const s21vMicrosoft = document.getElementById('s21v-microsoft');
const s21vTruck     = document.getElementById('s21v-truck');
// Scene-21 clouds — fixed overlay z:2, fade in near end of scene
const s21cRegular   = document.getElementById('s21c-regular');
const s21cWhite     = document.getElementById('s21c-white');

// Scene 26–30 overlay — 500vw wide, translates in sync with the strip
const cityOverlay26 = document.getElementById('city-overlay-26');
const cityOverlay26Behind = document.getElementById('city-overlay-26-behind'); // fruit-lady lottie — stays below #city-bus, see animateS26S30
const s2630Bg        = document.getElementById('s26-s30-bg');

// Scene 32–43 overlay — 1300vw wide, ambient passengers, translates in sync with the strip
const cityOverlay32 = document.getElementById('city-overlay-32');
const s3243Bg        = document.getElementById('s32-s43-bg');
const s32People       = document.getElementById('s32-people');

// Interviewee swap, batched by scene pair (2 people at a time) instead of one by one:
// batch 0 = scene-27 (Asmelash + Awa), batch 1 = scene-28 (Chris + Kathleen),
// batch 2 = scene-29 (Sadik + Samuel) — each batch fades together during its own scene.
const s2630Pairs = [
  [document.querySelector('.char-s29-samuel'),   document.querySelector('.char-s29-samuel-1')],
  [document.querySelector('.char-s27-awayly'),   document.querySelector('.char-s27-awayly-1')],
  [document.querySelector('.char-s28-chris'),    document.querySelector('.char-s28-chris-1')],
  [document.querySelector('.char-s27-asmelash'), document.querySelector('.char-s27-asmelash-1')],
  [document.querySelector('.char-s29-sadik'),    document.querySelector('.char-s29-sadik-1')],
  [document.querySelector('.char-s28-kathleen'), document.querySelector('.char-s28-kathleen-1')],
];
const s2630Batch = [2, 0, 1, 0, 2, 1]; // batch index per s2630Pairs entry, in the order above
const s2630G1Op = [1, 1, 1, 1, 1, 1]; // running opacity — group1 standing chars
const s2630G2Op = [0, 0, 0, 0, 0, 0]; // running opacity — group2 name cards
let _s2630BoardFade    = 0;    // time-lerped 0→1 once all swaps done; fades out all characters
let _s32OverlayOpacity = 0; // fade-in high-water mark — never decreases within scene 32, so a small scroll-back doesn't fade it out
let _s32DampedTx  = null; // slow-motion scroll follow into scene 32, while the intro popup appears
let _s32DampRate  = 0.02; // ramps up from a heavy slow-mo lerp back to a direct 1:1 follow
let _s32FrozenTx  = null; // pan held stable during the initial zoom window (local 0-0.15)
let _s32ZoomOutT0 = null; // wall-clock timestamp when the zoom-out + Samuel reveal started
const S32_ZOOMOUT_MS = 1200; // duration of the auto-playing zoom-out — plays like a video, no scroll needed

// Zoom cycle spanning the whole Asmelash + pregnant-woman sequence: zooms IN right
// after the 4th popup (Lesan) is dismissed, stays zoomed through Asmelash/Asmelash2/
// both pregnant-woman popups, then zooms back OUT once local reaches S33_ZOOM_HOLD
// (after the 8th popup) — see asmelashZoomInT/pregnantZoomT/s32Scale in animateS32S43.
let _sAsmelashZoomInT0 = null; // wall-clock timestamp when the zoom-IN started (right after Lesan dismissed)
const ASMELASH_ZOOMIN_MS = 800;
let _s33FrozenTx  = null;
let _s33ZoomOutT0 = null;
const S33_ZOOM_HOLD    = 0.95; // zoom-OUT triggers here, after both pregnant-woman popups have had time to show
const S33_ZOOMOUT_MS   = 1200;

let _s44FrozenTx = null; // pan held stable during scene 44 (see animateS44) — the strip freezes, only the overlay slides

let _s46ZoomT0 = null; // wall-clock timestamp when the wheelchair-man zoom-in started (see frame() and animateS45S48)


// Popup scroll-freeze: the instant a scene-32 popup opens, wheel scroll is swallowed for
// a short grace period (see the 'wheel' listener below) so it doesn't get scrolled past
// before there's been any time to read it.
let _scrollFreezeUntil = 0; // Date.now() timestamp; wheel input is ignored while now < this
const POPUP_SCROLL_FREEZE_MS = 700;
let _panel32IntroShown     = false;
let _panel32UmugandaShown  = false;
let _panel32LesanShown     = false;
let _panel32SamuelShown    = false;
let _s32LesanTicks = 0;        // wheel-scroll count since the 4th popup (Lesan AI) opened
let _s32LesanDismissed = false; // becomes true once 2 wheel scrolls happen — hides the popup

// Scene-32 timing anchors — no zoom/pan-freeze effect anymore, just reference points
// the popup/character fade timing below is built around (PEOPLE_FADE_END, SAMUEL_FADE_END).
const S32_ZOOM_TRIGGER = 0.32; // matches "scene 32  14%" on the debug bar — two women start showing here
const S32_ZOOM_HOLD    = 0.68; // gap after panel-32-umuganda hides (0.60) — Samuel's zoom-out/reveal triggers here, Lesan (4th) follows once Samuel hides at local 0.90 (see animateS32S43)



// Scene-8 bus zoom + pan — read live from CSS every frame so DevTools / file edits take effect immediately.
// To change them, edit  #city-bus { --s8-zoom: X; --s8-pan: Y }  in style.css.
function s8BusZoom() {
  const v = cityBus ? parseFloat(getComputedStyle(cityBus).getPropertyValue('--s8-zoom')) : NaN;
  return Number.isFinite(v) ? v : 1.5;
}

// Returns the bus vertical center as a viewport-% (for transformOrigin Y).
// Uses offsetHeight (transform-independent) + the CSS bottom:30% rule.
function busCenterY() {
  if (!cityBus) return 55;
  const vh = window.innerHeight;
  // bottom:30% → bus bottom-edge is at 70% from top
  const centerPx = vh * 0.70 - cityBus.offsetHeight * 0.5;
  return Math.max(20, Math.min(85, centerPx / vh * 100));
}
function s8BusPan() {
  const v = cityBus ? parseFloat(getComputedStyle(cityBus).getPropertyValue('--s8-pan')) : NaN;
  return Number.isFinite(v) ? v : 0.20;
}

// Parallax mouse state — 4 independent tiers with different lerp speeds.
// Each tier settles at a different rate, so elements stagger in time rather than all moving together.
let _rawPX = 0, _rawPY = 0;
let _s13TotalScale = 1; // wrap × bus scale in scene 13 — used to counter-scale popups
let _popup3ShowTs  = null; // timestamp when popup 3 first became visible

let prlxX1 = 0, prlxY1 = 0;  // tier 1 slowest  (0.03) — clouds
let prlxX2 = 0, prlxY2 = 0;  // tier 2 medium   (0.07) — buildings, bus
let prlxX3 = 0, prlxY3 = 0;  // tier 3 fast     (0.12) — trees, mid-depth people
let prlxX4 = 0, prlxY4 = 0;  // tier 4 fastest  (0.20) — closest people

document.addEventListener('mousemove', e => {
  _rawPX = (e.clientX / window.innerWidth  - 0.5) * 2;
  _rawPY = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

// ---- Setup: scroll length ----
// Every value in SCROLL_MAP is a multiple of window.innerWidth, so rebuilding it on resize
// (scrollbar toggling, DevTools panel resizing, display scaling, etc.) rescales every scene
// boundary — but window.scrollY itself is an absolute pixel count that doesn't rescale with
// it. Without correcting for that, the exact same scrollY can suddenly land on a completely
// different (often much earlier) scene right after a resize, reading as the story jerking
// backward on its own. Capture the current logical position (scene + local%) before rebuilding
// and re-apply it in the new map's coordinates afterward, so a resize never moves the story.
function setup() {
  const prev = SCROLL_MAP.length ? scrollToState(window.scrollY) : null;
  buildScrollMap();
  spacer.style.height = (TOTAL_SCROLL + window.innerHeight) + 'px';
  document.body.style.height = (TOTAL_SCROLL + window.innerHeight) + 'px';
  if (prev) {
    const seg = SCROLL_MAP[prev.currentScene];
    if (seg) window.scrollTo(0, seg.scrollStart + prev.sceneLocal * (seg.scrollEnd - seg.scrollStart));
  }
  // All the *FrozenTx values below are captured once (in absolute pixels) the first frame a
  // freeze window is entered, then reused as-is for as long as that freeze stays active. They
  // don't rescale with window.innerWidth the way SCROLL_MAP's own vw-based values just did
  // above — so if a resize happens while a freeze is still active, the stale pixel value no
  // longer lines up with the (now-rescaled) CSS background it's supposed to match, showing as
  // a gap. Clearing them here forces a fresh capture, at the new scale, on the very next frame.
  _s32DampedTx = null;
  _s32FrozenTx = null;
  _s32ZoomOutT0 = null;
  _s33FrozenTx = null;
  _s33ZoomOutT0 = null;
  _s44FrozenTx = null;
  _s46ZoomT0 = null;
}

// ---- Easing ----
function easeOutCubic(t) {
  return 1 - Math.pow(1 - Math.min(t, 1), 3);
}
// Starts from rest, accelerates to mid-point, decelerates smoothly to stop.
// Derivative = 0 at both ends → no velocity spike on entry or exit.
function easeInOutCubic(t) {
  t = Math.min(Math.max(t, 0), 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- Keyframe interpolation ----
// Normalises {scene, at(0-100), x} keyframes to global 0→1 then interpolates.
function normaliseJungleKeyframes(keyframes) {
  const total = JUNGLE_BUS_SCENES.length;
  return keyframes.map(kf => ({
    at: (kf.scene - 1 + kf.at / 100) / total,
    x:  kf.x,
  }));
}

// Catmull-Rom spline interpolation.
// Smooths velocity at every keyframe — no abrupt speed changes (no jerk).
// Each keyframe's tangent is derived from its two neighbours.
function interpolateKeyframes(kf, t) {
  if (t <= kf[0].at)             return kf[0].x;
  if (t >= kf[kf.length - 1].at) return kf[kf.length - 1].x;

  // Find the segment [i, i+1] that contains t
  let i = 0;
  while (i < kf.length - 2 && kf[i + 1].at < t) i++;

  const k0 = kf[Math.max(0, i - 1)];
  const k1 = kf[i];
  const k2 = kf[i + 1];
  const k3 = kf[Math.min(kf.length - 1, i + 2)];

  // Local progress within this segment [0, 1]
  const u  = (t - k1.at) / (k2.at - k1.at);
  const u2 = u * u;
  const u3 = u2 * u;

  // Non-uniform Catmull-Rom tangents (accounts for unequal spacing)
  const d01 = k1.at - k0.at || 1e-6;
  const d12 = k2.at - k1.at;
  const d23 = k3.at - k2.at || 1e-6;
  const m1  = d12 * (k2.x - k0.x) / (d01 + d12);
  const m2  = d12 * (k3.x - k1.x) / (d12 + d23);

  // Cubic Hermite evaluation
  return (2*u3 - 3*u2 + 1) * k1.x
       + (u3 - 2*u2 + u)   * m1
       + (-2*u3 + 3*u2)    * k2.x
       + (u3 - u2)         * m2;
}

// Pre-normalise once at startup
const JUNGLE_KF = normaliseJungleKeyframes(SCENE_CONFIG.jungleBus);

// ---- Non-uniform scroll map ----
// Maps scrollY → {currentScene, sceneLocal, tx, scrollPct}
let SCROLL_MAP   = [];
let TOTAL_SCROLL = 0;

function buildScrollMap() {
  const vw = window.innerWidth;
  SCROLL_MAP   = [];
  TOTAL_SCROLL = 0;
  for (let i = 0; i < SCENES; i++) {
    const len    = SCENE_SCROLL[i] * vw;
    // Scene 21 (i=10): margin-left:65vw + width:400vw vs normal 100vw = +365vw for all later scenes
    const stripX = i * vw
      + (i === 10 ? 0.65 * vw : 0)
      + (i > 10   ? 3.65 * vw : 0);
    SCROLL_MAP.push({ scrollStart: TOTAL_SCROLL, scrollEnd: TOTAL_SCROLL + len, stripX });
    TOTAL_SCROLL += len;
  }
}

function scrollToState(scrollY) {
  const vw = window.innerWidth;
  const y  = Math.min(scrollY, TOTAL_SCROLL);
  for (let i = 0; i < SCROLL_MAP.length; i++) {
    const seg = SCROLL_MAP[i];
    if (y < seg.scrollEnd || i === SCROLL_MAP.length - 1) {
      const local = Math.min(1, Math.max(0, (y - seg.scrollStart) / (seg.scrollEnd - seg.scrollStart)));
      return {
        currentScene: i,
        sceneLocal:   local,
        tx:           -(seg.stripX + local * vw),
        scrollPct:    y / TOTAL_SCROLL,
      };
    }
  }
}

// ---- Scroll time tracker (exposed as window.scrollTimer for future use) ----
window.scrollTimer = {
  firstScrollAt:  null,   // Date of very first scroll
  totalMs:        0,      // cumulative ms the user has been scrolling
  isScrolling:    false,
  _sessionStart:  null,
  _idleHandle:    null,
};

const IDLE_TIMEOUT = 400; // ms without scroll = considered idle

window.addEventListener('scroll', () => {
  const t   = Date.now();
  const st  = window.scrollTimer;

  if (!st.firstScrollAt) st.firstScrollAt = new Date(t);

  if (!st.isScrolling) {
    st.isScrolling   = true;
    st._sessionStart = t;
  }

  clearTimeout(st._idleHandle);
  st._idleHandle = setTimeout(() => {
    st.totalMs  += Date.now() - st._sessionStart;
    st.isScrolling = false;
  }, IDLE_TIMEOUT);
}, { passive: true });

// ---- Popup scroll-freeze: swallow wheel input for a grace period right after a
// scene-32 popup opens (see _scrollFreezeUntil, set in animateS32S43) so it doesn't get
// scrolled past before there's been any time to read it. Native wheel scroll only —
// programmatic scrollTo (dot nav) and touch-drag are untouched. ----
let _s32LesanBurstActive = false;
let _s32LesanBurstTimer  = null;
window.addEventListener('wheel', e => {
  pauseAutoAdvance(); // manual scroll input — user is taking control themselves
  if (Date.now() < _scrollFreezeUntil) { e.preventDefault(); return; }
  // 4th popup (Lesan AI) has no auto-hide timer — it dismisses itself after a few wheel
  // *scrolls* once it's open, instead. One physical scroll (a wheel turn or trackpad
  // swipe) fires many rapid 'wheel' events, not one — so this only counts the START of
  // each burst (debounced by 150ms of inactivity) as a single "scroll", not every event.
  if (_panel32LesanShown) {
    if (!_s32LesanBurstActive) {
      _s32LesanBurstActive = true;
      _s32LesanTicks++;
      if (_s32LesanTicks >= 3) _s32LesanDismissed = true;
    }
    clearTimeout(_s32LesanBurstTimer);
    _s32LesanBurstTimer = setTimeout(() => { _s32LesanBurstActive = false; }, 150);
  }
}, { passive: false });

// ---- Bus opacity: hidden until first scroll, then fades in ----
let busOpacity  = 1;    // bus visible from scroll position 0
let hasScrolled = true;

// ---- Continuous animation loop ----
let lastTs = 0;
let _lastNarrationCheck = 0;

function frame(ts) {
  lastTs = ts;

  // Read bus rect BEFORE any style writes to avoid forced synchronous layout
  const _busRect = (cityBus && cityBus.style.opacity !== '0') ? cityBus.getBoundingClientRect() : null;

  const scrollY = window.scrollY;
  const { tx, currentScene, sceneLocal, scrollPct } = scrollToState(scrollY);


  // junglePhase: 0→1 across the jungle scroll segment (scenes 1–3, may differ from scrollPct)
  const jungleScrollLen = SCENE_SCROLL.slice(0, JUNGLE_BUS_SCENES.length)
                            .reduce((s, r) => s + r, 0) * window.innerWidth;
  const junglePhase = Math.min(scrollY / jungleScrollLen, 1);

  const _vw = window.innerWidth;

  // Smooth cursor parallax — 4 tiers, each at a different lerp speed.
  // Active across all city scenes (5–19); lerp target goes to 0 just before the bus exits.
  const inCityScene    = currentScene >= 4 && currentScene <= 15; // all city scenes (5–19)
  const nearBusClose   = (currentScene === 7 || currentScene === 10) && sceneLocal >= BUS_CLOSE - 0.06;
  const tgtX = (inCityScene && !nearBusClose) ? _rawPX : 0;
  const tgtY = (inCityScene && !nearBusClose) ? _rawPY : 0;
  prlxX1 += (tgtX - prlxX1) * 0.03;  prlxY1 += (tgtY - prlxY1) * 0.03;
  prlxX2 += (tgtX - prlxX2) * 0.07;  prlxY2 += (tgtY - prlxY2) * 0.07;
  prlxX3 += (tgtX - prlxX3) * 0.12;  prlxY3 += (tgtY - prlxY3) * 0.12;
  prlxX4 += (tgtX - prlxX4) * 0.20;  prlxY4 += (tgtY - prlxY4) * 0.20;

  // Scene 8: freeze strip during zoom + popup phases; stay frozen during exit so the
  // next scene does not bleed in from the right while the bus is still leaving.
  let effectiveTx;
  if (currentScene === 7 && SCROLL_MAP[7]) {
    const freezeX = -SCROLL_MAP[7].stripX;
    const holdX   = freezeX + S8_PAN_MAX * _vw;
    if (sceneLocal <= ZOOM_END) {
      const t = easeInOutCubic(sceneLocal / ZOOM_END);
      effectiveTx = freezeX + t * S8_PAN_MAX * _vw;
    } else {
      effectiveTx = holdX;
    }
  } else if (currentScene === 9 && sceneLocal >= 0.37 && SCROLL_MAP[9]) {
    // Scene 13: freeze strip during zoom + popup + slide-up phases
    const s9Freeze = -(SCROLL_MAP[9].stripX + 0.37 * _vw);
    if (sceneLocal >= 0.92 && SCROLL_MAP[10]) {
      // Bus slides up (0.92–1.0) while s21Preview covers the view — use this window to
      // advance the strip from freeze position to scene-21 natural start so there's no snap
      const bridgeT = easeInOutCubic((sceneLocal - 0.92) / 0.08);
      effectiveTx = s9Freeze + bridgeT * (-(SCROLL_MAP[10].stripX) - s9Freeze);
    } else {
      effectiveTx = s9Freeze;
    }
  } else if (currentScene === 10 && SCROLL_MAP[10]) {
    // Scene 21: pan full 400vw road — 4vw strip × sceneLocal lands exactly at scene-26 strip start
    effectiveTx = -(SCROLL_MAP[10].stripX + sceneLocal * 4 * _vw);
  } else if (SCROLL_MAP[11] && (
    (currentScene === 11 && sceneLocal >= 0.77) ||
    (currentScene >= 12 && currentScene <= 13) ||
    (currentScene === 14 && sceneLocal < 0.85)
  )) {
    // Scene 26 (after bus parks) through scene 29: strip frozen so all interviewees
    // stay on screen while they swap in, two at a time per scene
    effectiveTx = -(SCROLL_MAP[11].stripX + 0.77 * _vw);
  } else if (SCROLL_MAP[11] && (
    (currentScene === 14 && sceneLocal >= 0.85) ||
    currentScene === 15
  )) {
    // Stays fully frozen (no background pan at all) for ALL of scene 30, not just the
    // hold — any strip movement gets visually amplified by the pinnedWrap zoom (4x-8x),
    // which is what read as "clouds/road scrolling behind the bus". It jumps straight to
    // scene-32's natural position the instant scene 32 begins (the `else` branch below),
    // but by then #city-bus/Awa Ly/panel-30 are already faded to 0 (see busFadeT in
    // animateCityBus) and #city-overlay-32 hasn't started fading in yet (its fade-in now
    // lives in scene 32's own local range — see animateS32S43), so nothing visible jumps.
    effectiveTx = -(SCROLL_MAP[11].stripX + 0.77 * _vw);
  } else if (currentScene === 16 && sceneLocal >= S32_ZOOM_HOLD) {
    // Auto-playing zoom-out + Samuel reveal: once scrolled up to this point, it plays on
    // its own like a video (wall-clock timed via _s32ZoomOutT0/S32_ZOOMOUT_MS — see the
    // matching samuelT/s32Scale computation in animateS32S43), no further scroll needed.
    // Pan stays frozen for the same duration so it reads as a fixed-point animation.
    if (_s32ZoomOutT0 === null) {
      _s32ZoomOutT0 = ts;
      // Swallow wheel input for the whole freeze duration, not just a short grace period —
      // otherwise local keeps advancing past the frozen visual position while scrolling,
      // and the strip jerks/snaps forward the instant the freeze releases.
      _scrollFreezeUntil = Date.now() + S32_ZOOMOUT_MS;
    }
    if (ts - _s32ZoomOutT0 < S32_ZOOMOUT_MS) {
      if (_s32FrozenTx === null) { _s32FrozenTx = tx; }
      effectiveTx = _s32FrozenTx;
    } else {
      _s32FrozenTx = null;
      effectiveTx = tx;
    }
  } else if (currentScene === 17 && sceneLocal >= S33_ZOOM_HOLD) {
    // Same auto-playing zoom-out mechanic as scene 32, reused for the pregnant-woman
    // reveal — see pregnantZoomT/s32Scale in animateS32S43.
    if (_s33ZoomOutT0 === null) {
      _s33ZoomOutT0 = ts;
      _scrollFreezeUntil = Date.now() + S33_ZOOMOUT_MS;
    }
    if (ts - _s33ZoomOutT0 < S33_ZOOMOUT_MS) {
      if (_s33FrozenTx === null) { _s33FrozenTx = tx; }
      effectiveTx = _s33FrozenTx;
    } else {
      _s33FrozenTx = null;
      effectiveTx = tx;
    }
  } else if (currentScene === 19) {
    // Scene 44 slides down vertically over scene-34 (see animateS44) instead of panning
    // in horizontally — freeze the strip here so the background underneath doesn't keep
    // shifting (and running off the edge of its own width) while the new scene covers it.
    if (_s44FrozenTx === null) { _s44FrozenTx = tx; }
    effectiveTx = _s44FrozenTx;
  } else if (currentScene === 20 && sceneLocal < S45_STICKY_RANGE && SCROLL_MAP[20]) {
    // Scene 45 pans at a fraction of normal speed (not a hard freeze) — covers scene 44's
    // overlay zooming/fading away (the shorter S45_EXIT_RANGE, see animateS44) plus the whole
    // character sequence, while still drifting slowly so it doesn't feel completely static.
    // Deliberately stateless (computed straight from stripX(20), not captured on first entry)
    // so it's exactly reversible — the same sceneLocal always gives the same effectiveTx,
    // regardless of whether you arrived scrolling forward or backward. A captured/frozen
    // starting point would differ depending on direction (local=0 arriving forward vs
    // local=1 arriving backward from scene 46), making forward/backward scroll amounts
    // mismatch — same class of bug as any other direction-dependent captured state here.
    const S45_PAN_SPEED = 0.2;
    const slowTx = -(SCROLL_MAP[20].stripX + sceneLocal * S45_PAN_SPEED * _vw);
    // At 0.2x speed, by the end of the scene the slow pan has only covered 20% of a
    // viewport-width while scene 46 expects to start a full viewport-width further along —
    // an 80%-of-screen jump right at the boundary. Bridge the last stretch from the slow
    // position to the real tx so they meet exactly by sceneLocal=S45_STICKY_RANGE. Stays
    // stateless (pure function of sceneLocal and tx, no captured variables) so it's still
    // exactly reversible scrolling either direction.
    const S45_RELEASE_START = 0.8;
    if (sceneLocal >= S45_RELEASE_START) {
      const bridgeT = easeInOutCubic((sceneLocal - S45_RELEASE_START) / (S45_STICKY_RANGE - S45_RELEASE_START));
      effectiveTx = slowTx + bridgeT * (tx - slowTx);
    } else {
      effectiveTx = slowTx;
    }
  } else if (currentScene === 21) {
    // Eases the pan toward the exact position that centers the wheelchair man on screen
    // (.char-s45-wheelchair: left:240vw + width:21vw/2 = 250.5vw within #s45-s48-bg), holds
    // him there while he zooms in and his popup shows (see animateS45S48), then eases back
    // to the normal continuous pan before scene 47 begins. The pan itself stays a pure
    // function of sceneLocal/tx/vw (no captured state), so it's exactly symmetric scrolling
    // either direction. The zoom-in triggered below is the one piece of wall-clock state —
    // it plays out on its own once he's centered, independent of further scrolling.
    const S46_CHAR_CENTER_VW = 250.5;
    const S45S48_BG_LEFT_VW = 2298; // must match #s45-s48-bg's `left` in style.css
    const targetStripXvw = S45S48_BG_LEFT_VW + S46_CHAR_CENTER_VW - 50;
    const targetTx = -(targetStripXvw * _vw / 100);
    const entryTx = -SCROLL_MAP[21].stripX; // natural tx at local=0 — matches where scene
      // 45's own release-bridge was already easing toward, so there's no jump at entry.
    if (sceneLocal < S46_HOLD_START) {
      const approachT = easeInOutCubic(sceneLocal / S46_HOLD_START);
      effectiveTx = entryTx + approachT * (targetTx - entryTx);
    } else if (sceneLocal < S46_HOLD_END) {
      // He's centered — start the wall-clock zoom-in the first frame we get here (see
      // wheelchairZoomT in animateS45S48). It plays out on its own from this point, no
      // further scrolling needed — the pan itself already stays pinned at targetTx for the
      // whole hold window regardless of how much local advances underneath it.
      if (_s46ZoomT0 === null) { _s46ZoomT0 = ts; }
      effectiveTx = targetTx;
    } else {
      const releaseT = easeInOutCubic((sceneLocal - S46_HOLD_END) / (1 - S46_HOLD_END));
      effectiveTx = targetTx + releaseT * (tx - targetTx);
    }
  } else {
    if (currentScene < 21) _s46ZoomT0 = null; // scrolled back out — reset so re-entering replays it
    _s32FrozenTx = null; // out of the freeze window — reset so re-entering starts fresh
    _s32DampedTx = null;
    _s32ZoomOutT0 = null; // scrolled back out — reset so re-entering replays the animation
    _s33FrozenTx = null;
    _s33ZoomOutT0 = null;
    _s44FrozenTx = null;
    effectiveTx = tx;
  }

  // Reset whole-scene zoom when outside scene 8 and scene 13
  if (currentScene !== 7 && currentScene !== 9 && pinnedWrap) {
    pinnedWrap.style.transform = '';
    _s13TotalScale = 1;
  }

  // -- Horizontal strip --
  scrollX.style.transform = `translateX(${effectiveTx.toFixed(1)}px)`;

  // -- Scene-4 trees overlay: 140vw wide, starts 20vw left of scene 4 (mirrors .s4-extend) --
  if (s4TreesOverlay && SCROLL_MAP[3]) {
    const s4vx = SCROLL_MAP[3].stripX + effectiveTx - 0.20 * _vw;
    s4TreesOverlay.style.opacity   = (s4vx < _vw && s4vx > -1.40 * _vw) ? '1' : '0';
    s4TreesOverlay.style.transform = `translateX(${s4vx.toFixed(1)}px)`;
  }

  // -- Scene 55-58 seller: synced to his position (89vw) inside #s55-s58-bg so he tracks
  // the pan exactly, but rendered as a root-level fixed element (see #s5558-seller-front)
  // so his z-index can actually beat #s5558-car's instead of being trapped inside
  // #s55-s58-bg's own stacking context. --
  if (s5558SellerFront && SCROLL_MAP[23]) {
    const sellerVx = SCROLL_MAP[23].stripX + 0.89 * _vw + effectiveTx;
    s5558SellerFront.style.opacity   = (currentScene >= 23 && currentScene <= 26 && sellerVx < _vw && sellerVx > -0.1 * _vw) ? '1' : '0';
    s5558SellerFront.style.transform = `translateX(${sellerVx.toFixed(1)}px)`;
  }

  // -- Scenes 55-58 clouds+birds transition frame: synced to its 122vw slot inside
  // #s55-s58-bg, same reasoning as the seller above — rendered root-level so its z-index
  // (12) genuinely beats #city-bus/#s5558-car/#s5558-seller-front instead of being trapped
  // inside #s55-s58-bg's stacking context. Slides in and fades 0->1 as it approaches center,
  // then FREEZES there fully opaque (not a pass-through wipe that fades back out) — it
  // covers the bus/car and stays covering them for the rest of the scene, ending the
  // sequence on the birds instead of revealing empty background again. Still exactly
  // reversible scrolling backward: frameVx is recomputed live every frame, so scrolling up
  // naturally un-freezes it (frameVx goes positive again) and it slides back out. --
  if (s5558TransitionFrameFront && SCROLL_MAP[23]) {
    const frameVx = SCROLL_MAP[23].stripX + 1.22 * _vw + effectiveTx;
    if (currentScene >= 23 && currentScene <= 26) {
      if (frameVx <= 0) {
        s5558TransitionFrameFront.style.opacity   = '1';
        s5558TransitionFrameFront.style.transform = 'translateX(0px)';
      } else {
        const frameOpacity = Math.max(0, 1 - frameVx / _vw);
        s5558TransitionFrameFront.style.opacity   = frameOpacity.toFixed(3);
        s5558TransitionFrameFront.style.transform = `translateX(${frameVx.toFixed(1)}px)`;
      }
    } else {
      s5558TransitionFrameFront.style.opacity = '0';
    }
  }

  // -- Fade out #s45-s48-bg once scene 55 begins. It's 520vw wide (2298vw-2818vw), which
  // overlaps well into #s55-s58-bg's own territory (2665vw-2815vw) — normally invisible
  // because scenes 55-58 used to have a long scroll runway that panned well clear of the
  // overlap before the street content came on screen. Now that that scroll length is much
  // shorter (compressed to match #s55-s58-bg's smaller 150vw width), the pan doesn't clear
  // it in time, so #s45-s48-bg (z-index:2, above #s55-s58-bg's z-index:1) was still visibly
  // covering/patchworking with the street scene. Explicit fade instead of relying on pan
  // position to clear it. Starts easing out during scene 47's last 30% for a smooth handoff.
  if (s4548Bg) {
    let s4548Opacity;
    if (currentScene < 22) s4548Opacity = 1;
    else if (currentScene === 22) s4548Opacity = 1 - easeInOutCubic(Math.max(0, sceneLocal - 0.7) / 0.3);
    else s4548Opacity = 0;
    s4548Bg.style.opacity = s4548Opacity.toFixed(3);
  }

  // -- Scene-5 trees overlay: sync to scene-5 viewport position so it sits above city-bus --
  if (cityTrees5 && SCROLL_MAP[4]) {
    const s5vx = SCROLL_MAP[4].stripX + effectiveTx;
    const inView = s5vx < _vw && s5vx > -0.22 * _vw;
    cityTrees5.style.opacity = inView ? '1' : '0';
    cityTrees5.style.transform = `translateX(${s5vx.toFixed(1)}px)`;
  }

  // -- Scene 7 & 8 overlays (characters + trees): sync to their scene positions --
  if (cityOverlay7 && SCROLL_MAP[6]) {
    const s7vx = SCROLL_MAP[6].stripX + effectiveTx;
    // Hide once we enter scene-8 zoom (currentScene >= 7) so scene-7 characters
    // don't bleed into the left edge of the viewport during the freeze.
    const show7 = currentScene < 7 && s7vx < _vw && s7vx > -_vw;
    cityOverlay7.style.opacity = show7 ? '1' : '0';
    cityOverlay7.style.transform = `translateX(${s7vx.toFixed(1)}px)`;
  }
  if (cityOverlay8 && SCROLL_MAP[7]) {
    const s8vx = SCROLL_MAP[7].stripX + effectiveTx;
    cityOverlay8.style.opacity = (s8vx < _vw && s8vx > -_vw) ? '1' : '0';
    cityOverlay8.style.transform = `translateX(${s8vx.toFixed(1)}px)`;
  }
  if (cityOverlay9 && SCROLL_MAP[8]) {
    const s9vx = SCROLL_MAP[8].stripX + effectiveTx;
    cityOverlay9.style.opacity = (s9vx < _vw && s9vx > -_vw) ? '1' : '0';
    cityOverlay9.style.transform = `translateX(${s9vx.toFixed(1)}px)`;
  }
  if (cityOverlay12 && SCROLL_MAP[9]) {
    const s12vx = SCROLL_MAP[9].stripX + effectiveTx;
    cityOverlay12.style.transform = `translateX(${s12vx.toFixed(1)}px)`;

    let ov12Op = 0;
    if (currentScene === 8) {
      ov12Op = 1;
    } else if (currentScene === 9) {
      if (sceneLocal < 0.18) {
        ov12Op = 1;
      } else {
        // fade out over 10% of the scene
        ov12Op = Math.max(0, 1 - (sceneLocal - 0.18) / 0.10);
      }
    }
    cityOverlay12.style.opacity = ov12Op.toFixed(3);

    const p12 = panels[10];
    if (p12) {
      const show12 = (currentScene === 9) && sceneLocal > 0.0 && sceneLocal < 0.35;
      p12.style.opacity = show12 ? '1' : '0';
      p12.classList.toggle('visible', show12);
    }
  }

  // Scene 21 preview: fade in road behind pinned-wrap as s12-s15-bg fades out during close-up
  if (currentScene === 9 && sceneLocal >= 0.70) {
    const tFade = Math.min(1, (sceneLocal - 0.70) / 0.22); // 70%→92%
    if (s12s15bg)   s12s15bg.style.opacity   = (1 - tFade).toFixed(3);
    if (s21Preview) s21Preview.style.opacity = tFade.toFixed(3);
  } else if (currentScene >= 10) {
    if (s12s15bg)   s12s15bg.style.opacity   = '0';
    if (s21Preview) s21Preview.style.opacity = '0'; // strip scene-21+ has taken over
  } else {
    if (s12s15bg)   s12s15bg.style.opacity   = '1';
    if (s21Preview) s21Preview.style.opacity = '0';
  }

  // Scene 13 popups — position: fixed, screen-space coordinates
  // Bus exit shift on screen: bus moves right after 85%, amplified by pinnedWrap scale (3×)
  const _busShiftPx = currentScene === 9 && sceneLocal >= 0.85
    ? easeInOutCubic(Math.min(1, (sceneLocal - 0.85) / 0.10)) * 1.6 * window.innerWidth * _s13TotalScale / 4
    : 0;
  if (panelS13_1) {
    const show = currentScene === 9 && sceneLocal >= 0.64 && sceneLocal < 0.70;
    panelS13_1.style.top     = '8%';   // ← adjust popup 1 vertical
    panelS13_1.style.left    = '5%';   // ← adjust popup 1 horizontal
    panelS13_1.style.opacity = show ? '1' : '0';
    panelS13_1.style.transform = '';
  }
  if (panelS13_2) {
    const show = currentScene === 9 && sceneLocal >= 0.70 && sceneLocal < 0.72;
    panelS13_2.style.top     = '8%';   // ← adjust popup 2 vertical
    panelS13_2.style.left    = '5%';   // ← adjust popup 2 horizontal
    panelS13_2.style.opacity = show ? '1' : '0';
    panelS13_2.style.transform = '';
  }
  if (panelS13_3) {
    const show = currentScene === 9 && sceneLocal >= 0.88;
    // Position popup on the bus's second window using live bus screen rect
    // Tune WIN_X (0–1 = left→right across bus) and WIN_Y (0–1 = top→bottom) to hit the window
    const WIN_X = 0.35; // ← horizontal fraction of bus image where second window is
    const WIN_Y = 0.24; // ← vertical fraction of bus image where second window is
    if (_busRect && show) {
      panelS13_3.style.left = `${(_busRect.left + _busRect.width  * WIN_X).toFixed(0)}px`;
      panelS13_3.style.top  = `${(_busRect.top  + _busRect.height * WIN_Y).toFixed(0)}px`;
    }
    panelS13_3.style.opacity   = show ? '1' : '0';
    panelS13_3.style.transform = '';
  }

  // -- Progress bar --
  progressBar.style.width = (scrollPct * 100) + '%';
  if (navProgressFill) navProgressFill.style.width = (scrollPct * 100) + '%';

  // -- Scroll hint --
  if (scrollHint) scrollHint.classList.toggle('hidden', scrollY > 80);

  // -- Active dot --
  dots.forEach((d, i) => d.classList.toggle('active', i === currentScene));


  // -- Bus opacity: fade in via scroll in scene 1; instantly full in all later scenes --
  const st = window.scrollTimer;
  const elapsedMs = st.totalMs + (st.isScrolling && st._sessionStart ? Date.now() - st._sessionStart : 0);
  if (currentScene >= 1) {
    // Bus has completed its entry — lock opacity to 1 so there is no snap at any scene boundary
    busOpacity  = 1;
    hasScrolled = true;
  } else if (elapsedMs >= 1000) {
    hasScrolled = true;
  }
  busOpacity += ((hasScrolled ? 1 : 0) - busOpacity) * 0.08;

  // -- Matatu drive-in --
  animateMatatu(currentScene, sceneLocal, tx, junglePhase, busOpacity);
  animateCityBus(currentScene, sceneLocal, busOpacity);
  animateS21Vehicles(currentScene, sceneLocal);
  animateS26S30(currentScene, sceneLocal, effectiveTx);
  animateS32S43(currentScene, sceneLocal, effectiveTx, ts);
  animateS44(currentScene, sceneLocal);
  animateS45S48(currentScene, sceneLocal, effectiveTx, ts);

  // -- Debug scale --
  const st2      = window.scrollTimer;
  const totalMs2 = st2.totalMs + (st2.isScrolling && st2._sessionStart ? Date.now() - st2._sessionStart : 0);
  const secs     = (totalMs2 / 1000).toFixed(1);
  const _inJungle  = JUNGLE_BUS_SCENES.includes(currentScene + 1);
  const _scenePct  = Math.round(sceneLocal * 100);
  const busVw      = _inJungle
    ? interpolateKeyframes(JUNGLE_KF, junglePhase).toFixed(0)
    : '–';
  const SCENE_LABELS = [1,2,3,4,5,6,7,8,12,13,21,26,27,28,29,30,32,33,34,44,45,46,47,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73];
  const _sceneLabel  = SCENE_LABELS[currentScene] ?? (currentScene + 1);
  if (dbgScene)  dbgScene.textContent  = `scene ${_sceneLabel}  ${_scenePct}%`;
  if (dbgTime)   dbgTime.textContent   = `${secs}s`;
  if (dbgBus)    dbgBus.textContent    = `bus: ${busVw}vw`;
  if (dbgCursor) dbgCursor.style.left  = `${Math.min(((currentScene + sceneLocal) / SCENES) * 100, 96).toFixed(2)}%`;

  // -- Savanna / city layer reveals --
  animateLayerReveals(currentScene, sceneLocal);

  // -- City parallax for all city scenes (after layer clear so transforms aren't wiped) --
  applyCityParallax(currentScene, sceneLocal, prlxX1, prlxY1, prlxX2, prlxY2, prlxX3, prlxY3, prlxX4, prlxY4);

  // -- Text panel visibility -- each panel opens/closes at its own sceneLocal fraction
  // (0 = the very start of that scene's scroll, 1 = the very end) — edit start/end below to
  // change any one popup's timing independently, without affecting the others.
  // `preShow` is optional: it lets a panel also appear near the END of the PREVIOUS scene
  // (once that scene's own sceneLocal passes this fraction), instead of waiting for its own
  // scene to become current — this is how a popup can open "earlier than 0" (start can't go
  // below sceneLocal's own floor of 0, so earlier-than-that has to borrow time from the scene
  // before it).
  const PANEL_TIMING = {
    1: { start: 0.15, end: 0.92 }, // "Hop on the Prevailer matatu! TWENDE!"
    2: { start: 0.01, end: 0.92, preShow: 0.5 }, // also shows from the center of scene 1 onward
    3: { start: 0.01, end: 0.92, preShow: 0.5 }, // also shows from the center of scene 2 onward
    5: { start: 0.075, end: 0.92 }, // synced to the city bus's START position — it's already parked at ENTRY by scene-5's local:0 (drive-in happens during scene 4's final 40%, see animateCityBus scene===3 block), then eases ENTRY→CENTER over local 0-0.15 (scene===4 block) — this opens right as that move begins, not after it finishes.
    6: { start: 0.3, end: 0.92 },
    7: { start: 0.3, end: 0.92 },
    9: { start: 0.3, end: 0.92 },
    // panel-55/56/57 (keys 24/25/26) are NOT here — they're handled separately below via
    // positionCenteredPopup, not this generic left-fixed-in-CSS toggle. Reason: they live
    // inside #s55-s58-bg, which pans on a slow/nonlinear curve during the 55-57 hold (see
    // the S5557 blend in this function's effectiveTx block) — a static CSS `left` tuned for
    // a normal linear pan drifts off-screen once the curve isn't linear anymore. Same fix
    // already used for scenes 45-48's popups (see animateS45S48/positionCenteredPopup).
  };
  Object.keys(PANEL_TIMING).forEach(key => {
    const n = Number(key);
    if (!panels[n]) return;
    const { start, end, preShow } = PANEL_TIMING[n];
    const inOwnScene  = currentScene === n - 1 && sceneLocal > start && sceneLocal < end;
    const inPrevScene = preShow !== undefined && currentScene === n - 2 && sceneLocal >= preShow;
    const show = inOwnScene || inPrevScene;
    panels[n].style.opacity = show ? '1' : '0';
    panels[n].classList.toggle('visible', show);
  });

  // -- Scenes 55-57 popups: kept centered on screen via dynamic `left`, recomputed every
  // frame from the live pan — see the comment above for why a static CSS left doesn't work
  // here anymore. S5558_BG_LEFT_VW must match #s55-s58-bg's `left` in style.css.
  if (SCROLL_MAP[23]) {
    const S5558_BG_LEFT_VW = 2665;
    const vwPx = _vw / 100;
    const viewportCenterVw = -effectiveTx / vwPx + 50;
    const popupCenterVw = viewportCenterVw - S5558_BG_LEFT_VW;
    // combinedLocal: 0 at scene-55 start .. 3 at scene-57 end (same combined scale as the
    // pan-speed blend above). Used so panel-55/56 can overlap (both open together for a
    // stretch) instead of being strictly one-scene-each — 56 opens before 55 closes, then
    // 56 closes exactly as 57 opens (no overlap there, a clean handoff).
    const inHoldRange = currentScene >= 23 && currentScene <= 25;
    const combinedLocal = inHoldRange ? (currentScene - 23) + sceneLocal : -1;
    const show55 = inHoldRange && combinedLocal > 0.4 && combinedLocal < 0.9;
    const show56 = inHoldRange && combinedLocal > 0.6 && combinedLocal < 0.9;
    const show57 = inHoldRange && combinedLocal > 0.9 && combinedLocal < 1.2;
    positionCenteredPopup(panels[24], show55, popupCenterVw);
    positionCenteredPopup(panels[25], show56, popupCenterVw);
    positionCenteredPopup(panels[26], show57, popupCenterVw);
  }

  // -- Scenes 59-73 popups: same dynamic-centering technique as scenes 55-57 above (this
  // wrapper is 450vw, way more than one viewport, so a static CSS left can't track the pan).
  // One popup per scene here (no overlap design yet, unlike 55/56) — each shows for the
  // middle 75% of its own scene's local range. S5973_BG_LEFT_VW must match #s59-s73-bg's
  // `left` in style.css. --
  if (SCROLL_MAP[27]) {
    const S5973_BG_LEFT_VW = 3065;
    const vwPx2 = _vw / 100;
    const viewportCenterVw2 = -effectiveTx / vwPx2 + 50;
    const popupCenterVw2 = viewportCenterVw2 - S5973_BG_LEFT_VW;
    s5973Panels.forEach((el, i) => {
      const sceneIdx = 27 + i;
      const show = currentScene === sceneIdx && sceneLocal > 0.15 && sceneLocal < 0.9;
      positionCenteredPopup(el, show, popupCenterVw2);
    });
  }

  // #panel-5: track bus position — now `position: fixed` (see style.css), so it moves in
  // step with the bus's own drive-in animation instead of sitting at a static scene-relative
  // %. Anchored above-left of the bus's live on-screen rect (_busRect, already computed above
  // for the scene-13 popup) so the bubble tail — which points right/down — lands on the bus.
  if (panels[5] && currentScene === 4 && _busRect) {
    panels[5].style.left = `${(_busRect.left - 20).toFixed(0)}px`;
    panels[5].style.top  = `${(_busRect.top + _busRect.height * 0.08).toFixed(0)}px`;
    panels[5].style.bottom = 'auto';
    panels[5].style.right  = 'auto';
  }

  // Scene 5: driver popup — fixed near bus driver window
  if (panel5Driver) {
    const showDriver = currentScene === 4 && sceneLocal > 0.3 && sceneLocal < 0.92;
    panel5Driver.style.opacity = showDriver ? '1' : '0';
    panel5Driver.classList.toggle('visible', showDriver);
  }

  // Scene 8: staggered sequence driven by sceneLocal (SCENE_SCROLL[7] = 3.0)
  // Panel-8 "PROBLEM PLAZA" — visible briefly on scene entry, gone before zoom
  if (panels[8]) {
    const show8 = currentScene === 7 && sceneLocal < 0.08;
    panels[8].style.opacity = show8 ? '1' : '0';
    panels[8].classList.toggle('visible', show8);
  }
  // Popup 1 — Africa's 2 000 languages — appears once bus is fully zoomed
  if (popup8a) {
    const show = currentScene === 7 && sceneLocal > 0.42 && sceneLocal < 0.65;
    popup8a.style.opacity = show ? '1' : '0';
    popup8a.classList.toggle('visible', show);
  }
  // Popup 2 — matatu comparison — appears after popup 1 hides, clears before bus close-up
  if (popup8b) {
    const show = currentScene === 7 && sceneLocal > 0.68 && sceneLocal < 0.72;
    popup8b.style.opacity = show ? '1' : '0';
    popup8b.classList.toggle('visible', show);
  }

  // -- Spoken narration: check after every panel's visibility has been resolved above.
  // Throttled to ~6/sec (not every rAF tick) — narration doesn't need 60fps precision, and
  // a screen reader like Narrator is already CPU-heavy right when it starts (it walks the
  // whole accessibility tree and spins up its own TTS engine), so this frees up some of the
  // budget competing with it instead of adding a 60/sec DOM-read loop on top. --
  if (ts - _lastNarrationCheck >= 150) {
    _lastNarrationCheck = ts;
    checkNarration();
    checkSceneExtras(currentScene);
  }
}

// ---- Matatu animations ----
// Scene 1: bus enters from off-screen left → parks at center
// Scene 3 end: scene 4 slides in from right and covers the bus (clip-path)
function animateMatatu(scene, local, tx, junglePhase, opacity) {
  const vw     = window.innerWidth;
  const CENTER = 0.31 * vw;  // bus width 38vw → (100-38)/2 = 31vw, centred at 50vw
  const ENTRY  = -0.38 * vw; // off-screen left (right edge at 0)
  const inJungle = JUNGLE_BUS_SCENES.includes(scene + 1);

  if (jungleBus) {
    if (inJungle) {
      let busX;
      let busOpacityLocal;
      if (scene === 0) {
        // Fast approach, braking to a stop right as panel-1 appears (local 0.3, per
        // PANEL_TIMING) — compressing easeInOutCubic's own full accelerate/decelerate shape
        // into local 0-PARK_AT does this in a single continuous curve (unlike an earlier
        // version of this that stitched a linear phase to a separate easeOutCubic phase —
        // their velocities didn't match at the seam, which read as a jerk right there).
        // easeInOutCubic already starts AND ends at zero velocity, so both this curve's start
        // (local=0) and its clamped hold after PARK_AT are jerk-free too, not just the middle.
        const PARK_AT = 0.32; // essentially stopped by here — just past the popup trigger
        const t = easeInOutCubic(Math.min(1, local / PARK_AT));
        busX = ENTRY + t * (CENTER - ENTRY);
        busOpacityLocal = Math.min(1, local / 0.12);
      } else {
        busX = CENTER;
        busOpacityLocal = opacity; // time-based opacity once parked
      }

      // #s4-trees overlay (z:11) sits above #jungle-bus (z:10), so trees naturally cover the bus.
      // Road stays behind the bus because it's inside #pinned-wrap (z:0 in root) — no clip needed.
      // Only hide the bus once scene 4's background edge has passed the bus's left edge.
      const sc4LeftPx = SCROLL_MAP[3].stripX + tx;
      jungleBus.style.clipPath = 'none';
      if (sc4LeftPx <= busX) {
        jungleBus.style.opacity = '0';
      } else {
        // translateY(-50%) centers the bus on the road regardless of its own image height —
        // see #jungle-bus's top:55% (road's own vertical center) in style.css.
        jungleBus.style.transform = `translateX(${busX.toFixed(1)}px) translateY(-50%)`;
        jungleBus.style.opacity   = busOpacityLocal.toFixed(3);
      }
    } else {
      jungleBus.style.opacity  = '0';
      jungleBus.style.clipPath = 'none';
    }
  }
}

// ---- City bus: starts entering when 30% of scene 4 (savanna) has passed ----
function animateCityBus(scene, local, opacity) {
  if (!cityBus) return;
  const vw     = window.innerWidth;
  const vh     = window.innerHeight;
  const CENTER = 0.25 * vw;  // bus width 50vw → left edge at 5vw, bus sits left of centre
  const ENTRY  = -0.1 * vw; // off-screen left (right edge at 0)

  let busY = 0; // vertical offset (px) applied to translateY — tune per-scene

  // Reset every frame — scene-specific blocks override below
  if (cityBusEmpty)   cityBusEmpty.style.opacity   = '1';
  if (cityBusPeople)  cityBusPeople.style.opacity  = '0';
  if (cityBusFull)    cityBusFull.style.opacity    = '0';
  if (cityBusPeople1) cityBusPeople1.style.opacity = '0';
  if (cityBusS26)     cityBusS26.style.opacity     = '0';
  if (cityBusInside)  cityBusInside.style.opacity  = '0';
  if (cityBusS55)     cityBusS55.style.opacity     = '0';
  if (s5558Car)        s5558Car.style.opacity        = '0';
  if (s5558Car2)       s5558Car2.style.opacity       = '0';
  if (s5558Car3)       s5558Car3.style.opacity       = '0';
  if (cityAwayStand)  cityAwayStand.style.opacity  = '0';
  if (cityAwayHandle) cityAwayHandle.style.opacity = '0';
  if (cityBusHandleProp) cityBusHandleProp.style.opacity = '0';

  let eff  = 0;
  let busX = CENTER;
  let zoom = 1;

  if (scene === 3) {
    // Savanna (scene 4): city bus drives in from off-screen left in the final 40% of the scene
    // so it arrives at the left edge just as scene 5 begins — no fade, just a drive-in
    const t = easeInOutCubic(Math.min(1, Math.max(0, (local - 0.6) / 0.4)));
    busX = -0.6 * vw + t * (ENTRY - (-0.6 * vw));
    eff  = t > 0 ? opacity : 0;
  } else if (scene === 4) {
    // 10% of peak speed exactly at popup trigger (local=0.30): PARK_AT=0.356
    const t = easeInOutCubic(Math.min(1, local / 0.15));
    busX = ENTRY + t * (CENTER - ENTRY);
    eff  = opacity;
  } else if (scene === 5) {
    eff = opacity;
  } else if (scene === 6) {
    eff = opacity;
  } else if (scene === 7) {
    eff  = opacity;
    busX = CENTER;
    zoom = 1;
    const zoomMax = s8BusZoom();
    let targetZoom;
    if (local <= ZOOM_END) {
      targetZoom = 1 + (zoomMax - 1) * easeInOutCubic(local / ZOOM_END);
    } else if (local >= BUS_SCROLL_START) {
      // Bus exits right — ease whole-scene zoom back to 1× so there's no snap at scene-8 boundary
      const exitT = easeInOutCubic((local - BUS_SCROLL_START) / (1 - BUS_SCROLL_START));
      targetZoom = 1 + (zoomMax - 1) * (1 - exitT);
    } else {
      targetZoom = zoomMax;
    }
    if (pinnedWrap) {
      pinnedWrap.style.transformOrigin = `75% ${busCenterY().toFixed(1)}%`;
      pinnedWrap.style.transform = targetZoom > 1.001 ? `scale(${targetZoom.toFixed(3)})` : '';
    }
    // Quick swap empty → people at local 0.15 (completes in 3% of scene — imperceptible)
    const peopleT = Math.min(1, Math.max(0, (local - 0.15) / 0.03));
    if (cityBusEmpty)  cityBusEmpty.style.opacity  = (1 - peopleT).toFixed(3);
    if (cityBusPeople) cityBusPeople.style.opacity = peopleT.toFixed(3);

    if (local >= BUS_CLOSE) {
      if (local < BUS_SCROLL_START) {
        const closeT = easeInOutCubic((local - BUS_CLOSE) / (BUS_SCROLL_START - BUS_CLOSE));
        zoom = 1 + (BUS_CLOSE_MULT * zoomMax - 1) * closeT;
        busX = CENTER;
      } else {
        const exitT = easeOutCubic((local - BUS_SCROLL_START) / (1 - BUS_SCROLL_START));
        zoom = BUS_CLOSE_MULT * zoomMax;
        busX = CENTER + exitT * 1.5 * vw;
      }
      if (cityBus) cityBus.style.transformOrigin = '90% 50%';
    }
  } else if (scene === 8) {
    // Scene 12: bus with people, drive in from left
    eff  = opacity;
    zoom = 1;
    const t = easeInOutCubic(Math.min(1, local / 0.25));
    busX = local < 0.25 ? ENTRY + t * (CENTER - ENTRY) : CENTER;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (local < 0.55) {
      if (cityBusEmpty)  cityBusEmpty.style.opacity  = '0';
      if (cityBusPeople) cityBusPeople.style.opacity = '1';
      if (cityBusFull)   cityBusFull.style.opacity   = '0';
    } else {
      if (cityBusEmpty)  cityBusEmpty.style.opacity  = '0';
      if (cityBusPeople) cityBusPeople.style.opacity = '0';
      if (cityBusFull)   cityBusFull.style.opacity   = '1';
    }
  } else if (scene === 9) {
    eff  = opacity;
    busX = CENTER;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    // Scene 13: before 18% full toto moto; at 18% crossfade to people1
    const t13 = Math.min(1, Math.max(0, (local - 0.18) / 0.10));
    if (cityBusFull)    cityBusFull.style.opacity    = (1 - t13).toFixed(3);
    if (cityBusPeople1) cityBusPeople1.style.opacity = t13.toFixed(3);
    if (cityBusEmpty)   cityBusEmpty.style.opacity   = '0';
    if (cityBusPeople)  cityBusPeople.style.opacity  = '0';
    // At 37% first zoom: pinnedWrap 1×→3×, holds during popups
    let wrapScale = 1;
    if (local >= 0.37) {
      const t1 = easeInOutCubic(Math.min(1, (local - 0.37) / 0.21));
      wrapScale = 1 + (3.0 - 1) * t1;
      if (pinnedWrap) {
        pinnedWrap.style.transformOrigin = `75% ${busCenterY().toFixed(1)}%`;
        pinnedWrap.style.transform = `scale(${wrapScale.toFixed(3)})`;
      }
    }
    // After 70%: second zoom on the bus element itself, framing the window area
    if (local >= 0.70) {
      const t2 = easeInOutCubic(Math.min(1, (local - 0.70) / 0.15));
      zoom  = 1 + (4.0 - 1) * t2;
      busY  = -vh * -0.1 * t2;
      if (cityBus) cityBus.style.transformOrigin = '50% 35%';
    }
    // 85–90%: bus moves slightly right to stop position; 90–92%: fully stopped (popup 3)
    const EXIT_HOLD_X = CENTER + easeInOutCubic(1) * 0.3 * vw;
    if (local >= 0.85 && local < 0.90) {
      const tExit = easeInOutCubic((local - 0.85) / 0.05);
      busX = CENTER + tExit * (EXIT_HOLD_X - CENTER);
    } else if (local >= 0.90) {
      busX = EXIT_HOLD_X; // hold X while popup shows then during slide-up
    }
    // 92%+: slide bus straight up; unscale pinnedWrap 3×→1× simultaneously
    if (local >= 0.92) {
      const tUp = easeInOutCubic(Math.min(1, (local - 0.92) / 0.08));
      busX = EXIT_HOLD_X;
      busY = 0.1 * vh - vh * 2 * tUp;
      const wrapDown = 3 - (3 - 1) * tUp;
      if (pinnedWrap) {
        pinnedWrap.style.transformOrigin = `75% ${busCenterY().toFixed(1)}%`;
        pinnedWrap.style.transform = `scale(${wrapDown.toFixed(3)})`;
      }
    }
    _s13TotalScale = wrapScale * zoom;
  } else if (scene >= 11 && scene <= 15) {
    // Scenes 26-30: matatu re-enters from left, same pattern as scene 5
    eff  = opacity;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty)   cityBusEmpty.style.opacity   = '0';
    if (cityBusPeople)  cityBusPeople.style.opacity  = '0';
    if (cityBusPeople1) cityBusPeople1.style.opacity = '0';
    // Bus variant: full-toto-moto until all 3 batches swapped, then cross-fade to interviewees
    // (kept in sync with the progress/threshold used in animateS26S30)
    const swapProg = scene < 12 ? -1 : scene > 14 ? 3 : (scene - 12) + local;
    const busSwapT = Math.min(1, Math.max(0, (swapProg - 2.7) / 0.3));
    if (cityBusFull) cityBusFull.style.opacity = (1 - busSwapT).toFixed(3);
    if (cityBusS26)  cityBusS26.style.opacity  = busSwapT.toFixed(3);
    if (scene === 11) {
      // Drive from off-screen left to center over first 40% of scene 26
      const t = easeInOutCubic(Math.min(1, local / 0.4));
      busX = ENTRY + t * (CENTER - ENTRY);
    } else {
      busX = CENTER;
    }
    // Scene 30: zoom bus in (34%→55%), swap exterior → interior bus right at the peak
    // (55%→60%, fully cropped so the swap is invisible), then HOLD at peak scale through
    // Awa Ly's entrance and her message (60%→90% — see S30_HOLD_END), and only then zoom
    // back out + fade everything (90%→100%) to hand off to the scene 32-43 interior overlay.
    if (scene === 15 && local >= 0.34) {
      const ZOOM_IN_END  = 0.45;
      const SWAP_START   = 0.45;
      const SWAP_END     = 0.50;
      const S30_HOLD_END = 0.90; // stays at peak scale until here — the "stay" the quote reads during
      const PEAK_SCALE   = 4.0;
      const BUS_FADE_START = 0.85; // fades gradually, but only down to 0.8 (not 0) — see busFadeT below

      let s30Scale;
      if (local < ZOOM_IN_END) {
        const tIn = easeInOutCubic(Math.min(1, (local - 0.34) / (ZOOM_IN_END - 0.34)));
        s30Scale = 1 + (PEAK_SCALE - 1) * tIn;
      } else {
        // No further zoom past peak — stays flat through the fade-out and into scene 32.
        s30Scale = PEAK_SCALE;
      }

      const insideT = Math.min(1, Math.max(0, (local - SWAP_START) / (SWAP_END - SWAP_START)));
      // Crossfade, not a hard cut and not a fade-to-nothing: this side fades from full
      // down to 0.8 (never further) by the end of scene 30. The scene-32 overlay (see
      // animateS32S43) starts its own fade-in AT 0.5 and ramps up to 1 — so the two meet
      // in the middle instead of leaving an empty gap or a washed-out lingering ghost.
      const busFadeT = Math.min(1, Math.max(0, (local - BUS_FADE_START) / (1 - BUS_FADE_START)));
      const busFadeMul = 1 - busFadeT * 0.2; // floor at 0.8, not 0
      if (cityBusS26)    cityBusS26.style.opacity    = ((1 - insideT) * busFadeMul).toFixed(3);
      if (cityBusInside) cityBusInside.style.opacity = (insideT * busFadeMul).toFixed(3);

      // Awa Ly: fades in standing once the interior is settled (62%→66%), then crossfades
      // to holding the ceiling handle (70%→75%) — well inside the hold, so nothing about
      // her entrance competes with the zoom. She now lives in her own #s30-zoom-people
      // overlay (not inside #city-bus), so she needs the busFadeT fade-out applied
      // directly — she no longer inherits it from the container's opacity.
      const standInT = Math.min(1, Math.max(0, (local - 0.62) / 0.04));
      const handleT  = Math.min(1, Math.max(0, (local - 0.70) / 0.05));
      if (cityAwayStand)  cityAwayStand.style.opacity  = (standInT * (1 - handleT) * busFadeMul).toFixed(3);
      if (cityAwayHandle) cityAwayHandle.style.opacity = (standInT * handleT * busFadeMul).toFixed(3);
      // Ceiling handle prop: visible whenever she is (both poses), same fade in/out.
      if (cityBusHandleProp) cityBusHandleProp.style.opacity = (standInT * busFadeMul).toFixed(3);

      // Her message: appears once she's settled into the handle-hold pose, stays up for
      // the rest of the hold, and is dismissed right as the zoom-out/fade-out begins.
      if (panel30AwayLy) {
        const showQuote = local >= 0.76 && local < S30_HOLD_END;
        panel30AwayLy.style.opacity = showQuote ? '1' : '0';
        panel30AwayLy.classList.toggle('visible', showQuote);
      }

      // Fade the whole #city-bus container too (not just its children) — floor at 0.8,
      // same as everything above.
      eff *= busFadeMul;

      if (cityBus) cityBus.style.transformOrigin = '50% 50%';
      if (pinnedWrap) {
        pinnedWrap.style.transformOrigin = `50% ${busCenterY().toFixed(1)}%`;
        pinnedWrap.style.transform = `scale(${s30Scale.toFixed(3)})`;
      }
    } else {
      if (pinnedWrap) pinnedWrap.style.transform = 'scale(1)';
    }
  } else if (scene >= 23 && scene <= 26) {
    // Scenes 55-58: matatu drives in and parks outside the Municipal Federation building —
    // same drive-in-then-park pattern as scene 5 (see scene===4 block above), using the
    // "full bus" exterior variant. Parked through 56-57, then drives off right as the
    // street pans away into clear sky at the end of scene 58.
    eff  = opacity;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty) cityBusEmpty.style.opacity = '0';
    if (cityBusS55)   cityBusS55.style.opacity   = '1';
    if (scene === 23) {
      // Drive in from further off-screen (like the scene-4 savanna entry) instead of the
      // near-visible ENTRY point, so it reads as a continuous drive sliding in from under
      // the previous scene rather than popping in already mostly on-screen. Opacity ramps
      // in over the same window so it fades up while it's still off-screen, not a hard cut.
      // Spread across the FULL scene (was 0.7, sped up once SCENE_SCROLL[23] got cut to
      // 0.4 for the 150vw-wide background — same local fraction now means much less actual
      // scroll, so it read as fast) — this is the slowest it can be within that unchanged
      // scroll budget, not a scroll-length change.
      const FAR_ENTRY = -0.6 * vw;
      const t = easeInOutCubic(Math.min(1, local / 1.0));
      busX = FAR_ENTRY + t * (CENTER - FAR_ENTRY);
      eff  = opacity * Math.min(1, local / 0.4);
    } else if (scene <= 25) {
      // Scenes 56-57: stays parked
      busX = CENTER;
    } else {
      // Scene 58: the clouds+birds transition frame (#s5558-transition-frame-front) already
      // wipes across and hides the bus during scenes 56-57 (its own pan-synced position, see
      // frame()'s sync block) — no separate drive-off/fade needed here anymore, the bus is
      // simply gone once the birds have passed over it.
      busX = CENTER;
      eff  = 0;
    }
    // Companion cars — same drive-in/hold-sway/hide pattern, own timing per car so they
    // don't read as three identical clones moving in lockstep. entryWindow/fadeInWindow
    // control speed/fade-in like the bus's own window above; ahead offsets their parked X
    // so they don't all stack on the same spot; swayPhase offsets the idle sway so they
    // drift independently during the hold.
    function driveCar(el, { farEntry, ahead, entryWindow, fadeInWindow, swayPhase, swayAmp }) {
      if (!el) return;
      let carX, carEff;
      if (scene === 23) {
        const t = easeInOutCubic(Math.min(1, local / entryWindow));
        carX   = farEntry + t * (CENTER + ahead - farEntry);
        carEff = opacity * Math.min(1, local / fadeInWindow);
      } else if (scene <= 25) {
        const holdPhase = (scene - 24) + local + swayPhase;
        const sway = Math.sin(holdPhase * Math.PI * 1.5) * swayAmp;
        carX   = CENTER + ahead + sway;
        carEff = opacity;
      } else {
        // Scene 58: same reasoning as the bus above — the transition frame already hid it
        // during scenes 56-57, no separate drive-off/fade needed.
        carX   = CENTER + ahead;
        carEff = 0;
      }
      el.style.opacity   = carEff.toFixed(3);
      el.style.transform = `translateX(${carX.toFixed(1)}px)`;
    }
    // Leads ahead of the bus, a little earlier than it so it's already rolling into frame
    // before the bus catches up.
    driveCar(s5558Car,  { farEntry: -0.75 * vw, ahead:  0.15 * vw, entryWindow: 0.5,  fadeInWindow: 0.2,  swayPhase: 0,   swayAmp: 0.015 * vw });
    // Trails further back and enters slower — reads as a second car catching up from behind.
    driveCar(s5558Car2, { farEntry: -0.95 * vw, ahead: -0.35 * vw, entryWindow: 0.65, fadeInWindow: 0.3,  swayPhase: 0.4, swayAmp: 0.02  * vw });
    // Quick little car darting in ahead of both, own independent sway phase.
    driveCar(s5558Car3, { farEntry: -0.55 * vw, ahead:  0.55 * vw, entryWindow: 0.4,  fadeInWindow: 0.15, swayPhase: 0.8, swayAmp: 0.018 * vw });
  } else if (scene >= 27 && scene <= 41) {
    // Scenes 59-73: closing chapter — matatu drives in once at scene 59, then keeps "driving"
    // continuously (a gentle bob, not literally translating) through the whole park/lake
    // stretch instead of parking dead still, since this whole chapter is meant to read as the
    // bus still moving. Never exits — scene 73 is the story's end, it just stays on screen.
    eff  = opacity;
    zoom = 1;
    if (cityBus) cityBus.style.transformOrigin = '50% 50%';
    if (cityBusEmpty) cityBusEmpty.style.opacity = '0';
    if (cityBusS55)   cityBusS55.style.opacity   = '1';
    // Continuous phase across all 15 scenes so the bob doesn't reset/jump at each scene
    // boundary — 0 at scene-59 start, 14+local at scene-73.
    const chapterPhase = (scene - 27) + local;
    if (scene === 27) {
      // Drive in already half-visible at the very start (bus is 50vw wide, so -0.25vw left
      // edge = exactly half on-screen), not from fully off-screen like scene 55's entry.
      const FAR_ENTRY = -0.25 * vw;
      const t = easeInOutCubic(Math.min(1, local / 1.0));
      const bob = Math.sin(chapterPhase * Math.PI * 2) * 0.006 * vw;
      busX = FAR_ENTRY + t * (CENTER + bob - FAR_ENTRY);
      eff  = opacity; // no fade-in — fully visible (half on-screen) from local:0
      // Subtle zoom-out as it drives in — starts a little larger, eases down to normal size.
      zoom = 1.15 - 0.15 * t;
    } else {
      // Gentle continuous bob for the rest of the chapter — reads as still driving, not parked.
      const bob = Math.sin(chapterPhase * Math.PI * 2) * 0.006 * vw;
      busY = Math.sin(chapterPhase * Math.PI * 4) * 2; // subtle vertical jostle, px
      busX = CENTER + bob;
    }
  }

  // Apply cursor parallax across all city scenes (5–19, 55–58, 59–73); frozen only during bus close-up
  const inCityBus  = (scene >= 4 && scene <= 16) || (scene >= 23 && scene <= 26) || (scene >= 27 && scene <= 41);
  const inBusClose = scene === 7 && local >= S8_EXIT;
  const bpx = (inCityBus && !inBusClose) ? prlxX2 * 12 : 0;
  const bpy = (inCityBus && !inBusClose) ? prlxY2 * 6  : 0;

  if (eff > 0.001) {
    cityBus.style.opacity   = eff.toFixed(3);
    cityBus.style.transform = `translateX(${(busX + bpx).toFixed(1)}px) translateY(${(bpy + busY).toFixed(1)}px) scale(${zoom.toFixed(3)})`;
    cityBus.style.clipPath  = 'none';
  } else {
    cityBus.style.opacity   = '0';
    cityBus.style.transform = `translateX(${CENTER.toFixed(1)}px) scale(1)`;
    cityBus.style.clipPath  = 'none';
  }

}

// ---- Scene 21 vehicles — all 5 drive left-to-right across the fixed viewport ----
function animateS21Vehicles(scene, sceneLocal) {
  const vw     = window.innerWidth;
  const active = scene === 10;
  if (s21Vehicles) s21Vehicles.style.opacity = active ? '1' : '0';
  if (!active) {
    // Release GPU layers when not in scene 21 so they don't compete with pinnedWrap animations
    [s21vMeta, s21vOpenAI, s21vMatatu, s21vGoogle, s21vMicrosoft, s21vTruck].forEach(el => {
      if (el) el.style.transform = 'none';
    });
    if (s21cRegular) s21cRegular.style.opacity = '0';
    if (s21cWhite)   s21cWhite.style.opacity   = '0';
    return;
  }

  // Moving vehicles — Meta and Matatu only
  const w = Math.round(0.32 * vw);
  // All 5 vehicles travel right
  [
    [s21vMeta,      1.2, 0.0 ],
    [s21vOpenAI,    1.4, 0.30],
    [s21vMatatu,    1.8, 0.10],
    [s21vGoogle,    1.0, 0.50],
    [s21vMicrosoft, 1.2, 0.75],
    [s21vTruck,     1.5, 0.20],
  ].forEach(([el, speed, phase]) => {
    if (!el) return;
    const t = (sceneLocal * speed + phase) % 1;
    el.style.transform = `translate3d(${(t * (vw + w) - w).toFixed(1)}px,0,0)`;
  });

  // Regular clouds: 60%→80% (full); white clouds: 80%→100% (full at scene end)
  if (s21cRegular) s21cRegular.style.opacity = Math.max(0, Math.min(1, (sceneLocal - 0.60) / 0.20)).toFixed(3);
  if (s21cWhite)   s21cWhite.style.opacity   = Math.max(0, Math.min(1, (sceneLocal - 0.80) / 0.20)).toFixed(3);
}

// ---- Scene 26–30 overlay — 500vw wide, slides in sync with the strip ----
function animateS26S30(scene, local, etx) {
  if (!cityOverlay26 || !SCROLL_MAP[11]) return;
  const s26vx = SCROLL_MAP[11].stripX + etx;
  cityOverlay26.style.transform = `translateX(${s26vx.toFixed(1)}px)`;
  if (cityOverlay26Behind) cityOverlay26Behind.style.transform = `translateX(${s26vx.toFixed(1)}px)`;

  // Drops to 0 once the scene-30 zoom swap finishes (60%, see animateCityBus's SWAP_END)
  // and stays there — otherwise this overlay's own "Matatu with interviewees" backdrop
  // (.char-s30-matatu) is still sitting at full opacity behind the zoomed bus and pops
  // back into view once the bus fades, instead of just staying gone.
  let opacity;
  if (scene < 11)        opacity = 0;
  else if (scene === 15) opacity = local >= 0.60 ? 0 : 1;
  else if (scene <= 15)  opacity = 1;
  else                    opacity = 0;
  cityOverlay26.style.opacity = opacity.toFixed(3);
  if (cityOverlay26Behind) cityOverlay26Behind.style.opacity = opacity.toFixed(3);

  // #s26-s30-bg (trees/buildings/clouds art) has no opacity control of its own either —
  // fade it out right as the scene-30 zoom starts (30%→36%) so none of it is visible
  // peeking around the zoomed-in bus. #s32-s43-bg stays hidden until scene 32 begins
  // (see animateS32S43), so the whole zoom+fade plays out over a clean, empty backdrop —
  // just the bus — until the new scene is actually revealed.
  if (s2630Bg) {
    let bgOpacity;
    if (scene < 11)        bgOpacity = 0;
    else if (scene === 15) bgOpacity = 1 - Math.min(1, Math.max(0, (local - 0.30) / 0.06));
    else if (scene <= 15)  bgOpacity = 1;
    else                    bgOpacity = 0;
    s2630Bg.style.opacity = bgOpacity.toFixed(3);
  }

  // Batched character swap during scenes 27-29 (indices 12-14): 1 unit of progress
  // per scene, each scene's pair (batch) fades together over progress [b+0.3 → b+0.7].
  let progress;
  if (scene < 12)      progress = -1;
  else if (scene > 14) progress =  3;
  else                 progress = (scene - 12) + local;

  // Once all 3 batches are done, slowly fade ALL characters out (they've boarded the bus)
  const allDone = progress >= 2.7;
  if (!allDone) _s2630BoardFade = 0;
  else          _s2630BoardFade += (1 - _s2630BoardFade) * 0.018; // ~3 s to full fade

  const LERP = 0.08;
  s2630Pairs.forEach(([g1, g2], i) => {
    const b  = s2630Batch[i];
    const t  = Math.min(1, Math.max(0, (progress - (b + 0.3)) / 0.4));
    s2630G1Op[i] += ((1 - t) - s2630G1Op[i]) * LERP;
    s2630G2Op[i] += (t       - s2630G2Op[i]) * LERP;
    const board = 1 - _s2630BoardFade;
    if (g1) g1.style.opacity = (s2630G1Op[i] * board).toFixed(3);
    if (g2) g2.style.opacity = (s2630G2Op[i] * board).toFixed(3);
  });
}

// ---- Scene 32–43 overlay — 1300vw wide, ambient passengers, slides in sync with the strip ----
function animateS32S43(scene, local, etx, ts) {
  if (!cityOverlay32 || !SCROLL_MAP[16]) return;
  const s32vx = SCROLL_MAP[16].stripX + etx;
  cityOverlay32.style.transform = `translateX(${s32vx.toFixed(1)}px)`;

  // Fades in right at the start of scene 32 (not during scene 30's tail) — scene 30's
  // strip is frozen the whole way through (see frame()'s effectiveTx), so this overlay
  // would be mispositioned (still using the frozen offset) if it faded in before the
  // freeze actually releases. Fading in here instead keeps position and opacity in sync.
  // Uses a high-water mark so a small scroll-back doesn't fade it back out.
  let opacity;
  if (scene < 16) {
    opacity = 0;
    _s32OverlayOpacity = 0; // reset only once fully scrolled back out of scene 32
  } else if (scene === 16) {
    // Crossfade partner to the scene-30 fade-out (see busFadeMul in animateCityBus):
    // that side fades from full down to 0.8, this side starts AT 0.8 and eases up to 1
    // — the two meet in the middle instead of either an empty gap or a lingering ghost.
    const t = easeInOutCubic(Math.min(1, Math.max(0, local / 0.15)));
    const raw = 0.8 + 0.2 * t;
    _s32OverlayOpacity = Math.max(_s32OverlayOpacity, raw);
    opacity = _s32OverlayOpacity;
  } else {
    opacity = 1;
    _s32OverlayOpacity = 1;
  }
  cityOverlay32.style.opacity = opacity.toFixed(3);

  // #s32-s43-bg has no opacity control of its own (unlike the overlay above), so it's
  // always fully opaque wherever the strip happens to place it. It's SUPPOSED to be
  // clipped out of view by the frozen strip during scene 30, but that's relying on
  // position math alone with no safety margin — explicitly hiding it here guarantees
  // scene 32's background can never show through behind the zoom.
  if (s3243Bg) {
    s3243Bg.style.opacity = opacity.toFixed(3);
  }

  // Intro popup — appears once the interior overlay has fully faded in (scene 32,
  // local 20%), stays up through most of the scene, dismissed by 60% so it's clear
  // before scene 33's own content would start competing for attention.
  if (panel32Intro) {
    // Starts at local 0.15, not earlier: that's when #city-overlay-32's own fade-in
    // finishes (see the crossfade in animateS32S43 below) — showing it any sooner made
    // its white background look washed-out/translucent since it inherits the still-
    // fading-in ancestor's opacity.
    const showIntro = scene === 16 && local >= 0.15 && local < 0.30;
    if (showIntro && !_panel32IntroShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32IntroShown = showIntro;
    panel32Intro.style.opacity = showIntro ? '1' : '0';
    panel32Intro.classList.toggle('visible', showIntro);
  }

  // Digital Umuganda popup — appears near old lady / girl-with-phone right after the
  // intro popup dismisses, and is gone before S32_ZOOM_HOLD (0.70) so it's dismissed
  // before the zoom finishes and the pan starts bridging into scene 33.
  if (panel32Umuganda) {
    const showUmuganda = scene === 16 && local >= 0.38 && local < 0.60;
    if (showUmuganda && !_panel32UmugandaShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32UmugandaShown = showUmuganda;
    panel32Umuganda.style.opacity = showUmuganda ? '1' : '0';
    panel32Umuganda.classList.toggle('visible', showUmuganda);
  }

  // Old lady + girl-with-phone: plain fade-in in place, reaching full opacity quickly
  // (a short 6% local window right after the trigger) rather than spread across the
  // whole zoom — still continuously scroll-driven, not a one-shot: scroll back and
  // they fade out again.
  const PEOPLE_FADE_END = S32_ZOOM_TRIGGER + 0.06;
  const peopleT = scene < 16 ? 0 : scene > 16 ? 1
    : Math.min(1, Math.max(0, (local - S32_ZOOM_TRIGGER) / (PEOPLE_FADE_END - S32_ZOOM_TRIGGER)));

  // Samuel Rutunda: same plain fade-in transition, but auto-plays on a wall-clock timer
  // once local reaches S32_ZOOM_HOLD (see _s32ZoomOutT0 in frame()) instead of tracking
  // scroll directly — it plays out like a video, no further scrolling needed.
  let samuelT;
  if (scene < 16) samuelT = 0;
  else if (scene > 16) samuelT = 1;
  else if (local < S32_ZOOM_HOLD) samuelT = 0;
  else samuelT = _s32ZoomOutT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _s32ZoomOutT0) / S32_ZOOMOUT_MS)));
  if (char39Samuel) char39Samuel.style.opacity = samuelT.toFixed(3);

  // Pregnant woman: plain quick fade-in in place (not tied to the zoom below — she just
  // needs to be visible while the scene stays zoomed in around her and Asmelash).
  const PREGNANT_FADE_END = 0.80;
  const pregnantT = scene < 17 ? 0 : scene > 17 ? 1
    : easeInOutCubic(Math.min(1, Math.max(0, (local - 0.75) / (PREGNANT_FADE_END - 0.75))));
  if (char35Pregnant) char35Pregnant.style.opacity = pregnantT.toFixed(3);

  // Zoom IN once the 4th popup (Lesan) is dismissed (see _s32LesanDismissed, set in the
  // 'wheel' listener) — ramps 1x -> 1.5x, wall-clock timed like the other zooms here.
  if (_s32LesanDismissed && _sAsmelashZoomInT0 === null) _sAsmelashZoomInT0 = ts;
  if (!_s32LesanDismissed) _sAsmelashZoomInT0 = null; // scrolled back out — reset so re-entering replays it
  const asmelashZoomInT = _sAsmelashZoomInT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _sAsmelashZoomInT0) / ASMELASH_ZOOMIN_MS)));

  // Zoom OUT once local reaches S33_ZOOM_HOLD (after both pregnant-woman popups have had
  // time to show) — wall-clock timed via _s33ZoomOutT0/S33_ZOOMOUT_MS in frame().
  let pregnantZoomT;
  if (scene < 17) pregnantZoomT = 0;
  else if (scene > 17) pregnantZoomT = 1;
  else if (local < S33_ZOOM_HOLD) pregnantZoomT = 0;
  else pregnantZoomT = _s33ZoomOutT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _s33ZoomOutT0) / S33_ZOOMOUT_MS)));

  // Zoom-out: locked at 1.5x while the two women are on screen, then eases back down to
  // 1x in step with Samuel fading in (same samuelT) — held stable until they're fully
  // seen, then zoom and cast change play out together. After that, a second cycle zooms
  // back IN once the 4th popup is dismissed (asmelashZoomInT), stays zoomed through
  // Asmelash + the pregnant-woman popups, then eases back OUT (pregnantZoomT) once
  // they're done.
  //
  // transform-origin is recomputed every frame instead of a fixed CSS %: with a hardcoded
  // origin, panning the strip while scale != 1 makes the zoomed content visibly drift
  // left/right (the origin point stays put in the div's own coordinates while the visible
  // viewport slides past it). Computing the origin as "whatever's centered in the viewport
  // right now" keeps the zoom centered on-screen regardless of where the strip has panned to.
  if (s3243Bg) {
    let s32Scale;
    if (scene < 16) {
      s32Scale = 1;
    } else if (scene === 16 && !_s32LesanDismissed) {
      s32Scale = 1.5 - 0.5 * samuelT; // original scene-32 zoom-out for Samuel's reveal
    } else if (scene >= 19) {
      // Scene 44: zoom in on the frozen scene-34 content underneath while the new scene
      // slides down over it (see animateS44) — continuously tied to its own local, so
      // scrolling back out eases the zoom back to 1x in step with the slide sliding back up.
      const s44ZoomT = scene > 19 ? 1 : easeInOutCubic(local);
      s32Scale = 1 + 0.3 * s44ZoomT;
    } else if (scene > 17 || (scene === 17 && local >= S33_ZOOM_HOLD)) {
      s32Scale = 1.5 - 0.5 * pregnantZoomT; // zoom-out after both pregnant-woman popups
    } else {
      s32Scale = 1 + 0.5 * asmelashZoomInT; // zoomed-in phase: Lesan-dismiss through Asmelash + pregnant popups
    }
    const vwPx = window.innerWidth / 100;
    const stripXvw = -etx / vwPx;             // strip coordinate currently at the viewport's left edge
    const viewportCenterVw = stripXvw + 50;   // center of the 100vw viewport, in strip coordinates
    const S3243_BG_LEFT_VW = 1965;             // must match #s32-s43-bg's `left` in style.css
    const S3243_BG_WIDTH_VW = 450;            // must match #s32-s43-bg's `width` in style.css — needs to reach 2365vw (scene-44's frozen viewport right edge) with real margin; 380 gapped on the right during scene 44
    const originXPct = Math.max(0, Math.min(100,
      ((viewportCenterVw - S3243_BG_LEFT_VW) / S3243_BG_WIDTH_VW) * 100));
    const originStr = `${originXPct.toFixed(2)}% 75%`;
    const scaleStr  = `scale(${s32Scale.toFixed(3)})`;
    s3243Bg.style.transformOrigin = originStr;
    s3243Bg.style.transform = scaleStr;
    // #s32-people (old lady/girl-with-phone/Samuel/etc.) shares the exact same 1300vw
    // local coordinate space as #s32-s43-bg (both map to the same physical seat position
    // for a given local offset — see the matching S3243_BG_LEFT_VW/stripX relationship),
    // so the same scale + origin keeps them glued to their seats instead of drifting
    // independently of the background art as it zooms.
    if (s32People) {
      s32People.style.transformOrigin = originStr;
      s32People.style.transform = scaleStr;
    }
  }

  // Old lady + girl-with-phone fade back OUT as Samuel fades in (same samuelT, inverted)
  // — a clean "cast change" instead of all three staying on screen together.
  const behindT = peopleT * (1 - samuelT);
  if (char32OldLady)   char32OldLady.style.opacity   = behindT.toFixed(3);
  if (char33GirlPhone) char33GirlPhone.style.opacity = behindT.toFixed(3);

  // Samuel's quote — appears once he's fully faded in (samuelT reaches 1), stays up
  // until local 0.90, then hands off to the Lesan AI popup (4th popup, see below).
  if (panel32Samuel) {
    const showSamuel = scene === 16 && samuelT >= 1 && local < 0.90;
    if (showSamuel && !_panel32SamuelShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32SamuelShown = showSamuel;
    panel32Samuel.style.opacity = showSamuel ? '1' : '0';
    panel32Samuel.classList.toggle('visible', showSamuel);
  }

  // Lesan AI / community-centred practices popup — 4th popup, appears after Samuel's
  // quote (3rd) hides (local 0.90+), then dismisses itself after 2 wheel scrolls (see
  // the 'wheel' listener above) instead of a wall-clock timer.
  if (panel32Lesan) {
    // Stays triggered even after scrolling past scene 32 into 33+ (unlike the popup
    // itself, which is scene-32-only) — otherwise, scrolling through the tail of scene
    // 32 skips straight past the "popup dismissed, show Asmelash" state before it ever
    // gets a chance to happen.
    const lesanTriggered = scene > 16 || (scene === 16 && local >= 0.90);
    if (!lesanTriggered) {
      _s32LesanDismissed = false; // scrolled back out — reset so re-entering replays it
      _s32LesanTicks = 0;
    }
    const showLesan = lesanTriggered && !_s32LesanDismissed;
    if (showLesan && !_panel32LesanShown) _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    _panel32LesanShown = showLesan;
    panel32Lesan.style.opacity = showLesan ? '1' : '0';
    panel32Lesan.classList.toggle('visible', showLesan);
  }

  // Asmelash — same rules as Samuel (3rd popup): a plain scroll-position window,
  // recalculated fresh every frame, no unlock/dismiss ratchet state to get stuck —
  // so scrolling back and forth always shows/hides him correctly.
  if (char37Asmelash) {
    const showAsmelash = scene > 17 || (scene === 17 && local >= 0.32);
    char37Asmelash.style.opacity = showAsmelash ? '1' : '0';
  }

  // 5th popup — near Asmelash's head, same rules as Samuel's popup: a plain
  // scroll-position window (local 0.32-0.55 in scene 33), not a scroll-gesture count.
  if (panel32Asmelash) {
    const showAsmelashPopup = scene === 17 && local >= 0.32 && local < 0.55;
    if (showAsmelashPopup && panel32Asmelash.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Asmelash.style.opacity = showAsmelashPopup ? '1' : '0';
    panel32Asmelash.classList.toggle('visible', showAsmelashPopup);
  }

  // Flipped Asmelash (facing right) — same simple scroll-position rules, shown right
  // after the 5th popup hides.
  if (char37Asmelash2) {
    const showAsmelash2 = scene > 17 || (scene === 17 && local >= 0.55);
    char37Asmelash2.style.opacity = showAsmelash2 ? '1' : '0';
  }

  // 6th popup — near the flipped Asmelash, same rules as the others: a plain
  // scroll-position window (local 0.55-0.75 in scene 33).
  if (panel32Asmelash2) {
    const showAsmelash2Popup = scene === 17 && local >= 0.55 && local < 0.75;
    if (showAsmelash2Popup && panel32Asmelash2.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Asmelash2.style.opacity = showAsmelash2Popup ? '1' : '0';
    panel32Asmelash2.classList.toggle('visible', showAsmelash2Popup);
  }

  // Sadik — last man in this sequence. Plain scroll-position rule (not tied to
  // pregnantZoomT's wall-clock timer) — that timer only completes 1200ms after local
  // hits 0.95, and if you keep scrolling during that window (keyboard/touch aren't
  // blocked by the wheel-only pan-freeze) local keeps advancing, so Sadik ended up not
  // showing until much later than intended.
  const showSadik = scene > 17 || (scene === 17 && local >= 0.97);
  if (char32Sadik) char32Sadik.style.opacity = showSadik ? '1' : '0';

  // 7th popup — above the pregnant woman, appears once she's fully zoomed-in-revealed
  // (pregnantZoomT reaches 1), hides again once Sadik (the last man) shows up.
  if (panel32PregnantUp) {
    const showPregnantUp = !showSadik && scene === 17 && pregnantT >= 1;
    if (showPregnantUp && panel32PregnantUp.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32PregnantUp.style.opacity = showPregnantUp ? '1' : '0';
    panel32PregnantUp.classList.toggle('visible', showPregnantUp);
  }

  // 8th popup — below the pregnant woman, shown after scrolling past the 7th, hides
  // again once Sadik shows up.
  if (panel32PregnantDown) {
    const showPregnantDown = !showSadik && scene === 17 && local >= 0.87;
    if (showPregnantDown && panel32PregnantDown.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32PregnantDown.style.opacity = showPregnantDown ? '1' : '0';
    panel32PregnantDown.classList.toggle('visible', showPregnantDown);
  }

  // 9th popup — near Sadik, shown right alongside him (same trigger — pregnantZoomT
  // already carries a wall-clock delay from the zoom-out itself, so no extra wait needed).
  if (panel32Sadik) {
    if (showSadik && panel32Sadik.style.opacity !== '1') {
      _scrollFreezeUntil = Date.now() + POPUP_SCROLL_FREEZE_MS;
    }
    panel32Sadik.style.opacity = showSadik ? '1' : '0';
    panel32Sadik.classList.toggle('visible', showSadik);
  }
}

// ---- Scene 44: slides down from the top over scene-34, instead of panning in
// horizontally like every other scene. Continuously scroll-driven (not a one-shot), so
// scrolling back up slides it back off-screen. Once fully covering, scrolling on into
// scene 45 zooms the whole overlay away (scale up + fade) instead of leaving it frozen on
// screen forever — reveals scene 45 continuing underneath. ----
function animateS44(scene, local) {
  if (!s44Overlay) return;
  const slideT = scene < 19 ? 0 : scene > 19 ? 1 : easeInOutCubic(local);

  // Exit zoom uses the first S45_EXIT_RANGE of scene-45's own local range — scene 45 is kept
  // sticky (no pan) for this same window, see the effectiveTx freeze in frame().
  const exitT = scene < 20 ? 0 : scene > 20 ? 1 : easeInOutCubic(Math.min(1, local / S45_EXIT_RANGE));

  const translateY = (1 - slideT) * -100;
  const scale = 1 + 0.5 * exitT;
  s44Overlay.style.transform = `translateY(${translateY.toFixed(2)}%) scale(${scale.toFixed(3)})`;
  s44Overlay.style.opacity = (1 - exitT).toFixed(3);

  // "The guy" (toto-moto) — fades in a bit before the popup, so he's clearly visible by the
  // time the message appears rather than lagging behind it. Fades away with the rest of the
  // overlay during the exit zoom (its own opacity:1 stacks under the parent's).
  if (s44TotoMoto) s44TotoMoto.classList.toggle('visible', slideT >= 0.75);

  // Popup — appears once the slide-down finishes (slideT reaches 1).
  if (panel44_1) {
    const showPanel44_1 = slideT >= 1;
    panel44_1.style.opacity = showPanel44_1 ? '1' : '0';
    panel44_1.classList.toggle('visible', showPanel44_1);
  }
}

// Centers a scene-45/48 popup on the current viewport horizontally, recomputed every frame
// from the live pan position — same technique as the scene-46 zoom's transform-origin. A
// static CSS left:Xvw only happens to look centered at one particular scroll position and
// drifts everywhere else, which is exactly the bug this fixes: every other text-panel on the
// site stays centered on screen at all times (e.g. .scene-8 .text-panel's static
// left:50%/translateX(-50%) — that works as a plain constant there because that scene's own
// box is exactly one viewport-width; #s45-s48-bg is 520vw wide, so the equivalent "centered"
// vw value has to be computed live instead of being a fixed 50%).
function positionCenteredPopup(el, show, centerVw) {
  if (!el) return;
  el.style.left = `${centerVw.toFixed(2)}vw`;
  el.style.transform = `translateX(-50%) translateY(${show ? '0' : '8px'})`;
  el.style.opacity = show ? '1' : '0';
  el.classList.toggle('visible', show);
}

// ---- Scenes 45-48: ambient bus-interior passengers continue, same simple "plain
// scroll-position, no ratchet" fade pattern as scenes 32-34's ambient characters. No zoom
// sequence here, so no position sync is needed either — #s45-s48-bg is a normal child of
// #scroll-x and pans automatically with it; this only toggles each character's opacity. ----
function animateS45S48(scene, local, etx, ts) {
  // Where the viewport's horizontal center currently sits, in #s45-s48-bg's own container-
  // local coordinate space — recomputed every frame from the live pan (etx), reused below
  // by every popup's positionCenteredPopup() call so they all stay centered on screen.
  const S45S48_BG_LEFT_VW = 2298; // must match #s45-s48-bg's `left` in style.css
  const vwPx = window.innerWidth / 100;
  const viewportCenterVw = -etx / vwPx + 50;
  const popupCenterVw = viewportCenterVw - S45S48_BG_LEFT_VW;

  // Sequence within scene 45, which stays fully pinned the whole time (S45_STICKY_RANGE
  // covers the whole scene, now stretched to 4.0 viewport-widths of scroll so everyone gets
  // real time on screen) — nobody shows at the very start (a small scroll-in delay first),
  // then Kathleen (with popup) → toto moto → red lady (with popup) → toto moto's popup →
  // wheelchair man, one at a time. Each one stays visible once shown (no fade-out) — they
  // accumulate instead of replacing each other.
  // Kathleen stays seated next to the wheelchair man through scenes 46-48 too (see the
  // scene-47/48 popups below) — same "stays visible once shown" pattern as wheelchair man.
  if (char45Kathleen)   char45Kathleen.classList.toggle('visible',   scene > 20 || (scene === 20 && local >= 0.2));
  const showTotoMoto = scene === 20 && local >= 0.45;
  if (char45TotoMoto)   char45TotoMoto.classList.toggle('visible',   showTotoMoto);
  if (soundCaptionTotoMoto) soundCaptionTotoMoto.style.opacity = showTotoMoto ? '1' : '0';
  if (char45RedLady)    char45RedLady.classList.toggle('visible',    scene === 20 && local >= 0.65);
  // Toto moto and red lady don't carry into 46-48 — only Kathleen and wheelchair man stay
  // seated together for the scene-47/48 popups below.

  // Kathleen's quote — shown once she's been visible a moment, hides again before toto moto
  // takes over.
  const showKathleen = scene === 20 && local > 0.25 && local < 0.4;
  positionCenteredPopup(panel45Kathleen, showKathleen, popupCenterVw);
  // Name plate + sound icon stay up always (not tied to the quote popup's narrower window),
  // so the audio is reachable any time Kathleen's around, not just while her quote is showing.
  if (soundCaptionKathleen) soundCaptionKathleen.style.opacity = '1';

  // Red lady's quote — shown once she's been visible a moment, hides again before toto
  // moto's own popup takes its turn.
  const showRedLady = scene === 20 && local > 0.7 && local < 0.82;
  positionCenteredPopup(panel45RedLady, showRedLady, popupCenterVw);

  // Toto moto's quote — shown after red lady's popup, hides again before wheelchair man's turn.
  const showTotoMotoQuote = scene === 20 && local > 0.85 && local < 0.95;
  positionCenteredPopup(panel45TotoMoto, showTotoMotoQuote, popupCenterVw);

  // Wheelchair man — next guy in the sequence, stays for the rest of the scene once he
  // appears, giving him real time on screen before scene 46 begins.
  // Stays visible even past scene 45 (scrolling into 46/47/48) — no hide once he's appeared.
  if (char45Wheelchair) char45Wheelchair.classList.toggle('visible', scene > 20 || (scene === 20 && local >= 0.9));

  // Wheelchair man zoom-in — wall-clock timed (see _s46ZoomT0, stamped in frame() the moment
  // the pan settles him into center), so it plays out on its own like a video, no further
  // scrolling needed. Stays fully zoomed through the rest of scene 46 and scenes 47/48 too,
  // since Kathleen and he stay in frame together for their popups there (see below).
  const wheelchairZoomT = scene < 21 ? 0
    : scene > 21 ? 1
    : _s46ZoomT0 === null ? 0
    : easeInOutCubic(Math.min(1, Math.max(0, (ts - _s46ZoomT0) / S46_ZOOM_MS)));
  if (s4548Visual) {
    const s46Scale = 1 + 0.5 * wheelchairZoomT;
    // Same "recompute origin from the current viewport center" technique as
    // animateS32S43's s3243Bg zoom — keeps the zoom centered on-screen regardless of where
    // the strip has panned to (a fixed CSS % origin would visibly drift while panning).
    // Scales #s45-s48-visual (background art + character sprites only), not #s45-s48-bg
    // itself — the popups/nameplates are siblings outside that wrapper (see index.html),
    // so they stay normal-sized instead of stretching along with the zoomed visuals.
    // Reuses popupCenterVw (computed once at the top of this function) — it's the same
    // "viewport center in #s45-s48-bg's own coordinate space" value the popups use.
    const S45S48_BG_WIDTH_VW = 520;  // must match #s45-s48-bg's `width` in style.css
    const originXPct = Math.max(0, Math.min(100, (popupCenterVw / S45S48_BG_WIDTH_VW) * 100));
    s4548Visual.style.transformOrigin = `${originXPct.toFixed(2)}% 75%`;
    s4548Visual.style.transform = `scale(${s46Scale.toFixed(3)})`;
  }

  // Huniki popup shows first once the zoom-in finishes, stays up for S46_HUNIKI_MS, then
  // fades out and the Big Tech popup queues in behind it — both wall-clock timed off the
  // same _s46ZoomT0 as the zoom itself, so the whole sequence plays on its own, no further
  // scrolling needed. sinceFinish is negative/NaN until the zoom has actually completed.
  const sinceZoomFinish = _s46ZoomT0 === null ? -Infinity : ts - (_s46ZoomT0 + S46_ZOOM_MS);
  const showHuniki = scene === 21 && sinceZoomFinish >= 0 && sinceZoomFinish < S46_HUNIKI_MS;
  positionCenteredPopup(panel46Huniki, showHuniki, popupCenterVw);
  const showBigTech = scene === 21 && sinceZoomFinish >= S46_HUNIKI_MS;
  positionCenteredPopup(panel46BigTech, showBigTech, popupCenterVw);

  // Chris Emezue's quote — he and the last red-topped woman are baked into the seat art
  // itself, so there's no character reveal here, just the popup timed to when that part of
  // the art is roughly centered on screen (confirmed in-browser: scene 47, local ~4%).
  const showChris = scene === 22 && local >= 0.03 && local < 0.3;
  positionCenteredPopup(panel47Chris, showChris, popupCenterVw);
  if (soundCaptionChris) soundCaptionChris.style.opacity = (scene === 22 && local >= 0.03) ? '1' : '0';
}

// ---- Layer reveals — all layers static, clear any previously set transforms ----
function animateLayerReveals(scene, local) {
  // Clear transforms on all layer images across every scene
  document.querySelectorAll('.layer img').forEach(img => {
    img.style.transform = '';
  });

  const building = document.querySelector('.scene-4 .layer-s4-building img');
  if (building) building.style.opacity = '1';

  const buildings5 = document.querySelector('.scene-5 .layer-city-buildings img');
  if (buildings5) buildings5.style.opacity = '1';

  const trees5 = document.querySelector('.scene-5 .layer-city-trees img');
  if (trees5) trees5.style.opacity = '1';

  // Ensure all city+ scene layers stay at opacity 1 (parallax may write opacity elsewhere)
  [
    '.scene-7', '.scene-8',
    '.scene-12', '.scene-13',
    '.scene-21', '.scene-22', '.scene-23',
    '.scene-26', '.scene-27', '.scene-28', '.scene-29', '.scene-30',
  ].forEach(sel => {
    document.querySelectorAll(`${sel} .layer img`).forEach(img => {
      img.style.opacity = '1';
    });
  });
}

// ---- City parallax: cursor-driven depth layers for all city scenes (5–8) ----
// Each element is assigned a different speed tier so they settle at different times,
// creating a natural staggered-depth feel instead of everything moving as one frame.
//   tier1 (px1) = slowest 0.03 — clouds
//   tier2 (px2) = medium  0.07 — buildings, bus
//   tier3 (px3) = fast    0.12 — trees, mid-depth people
//   tier4 (px4) = fastest 0.20 — closest foreground people
function applyCityParallax(scene, local, px1, py1, px2, py2, px3, py3, px4, py4) {
  function move(el, active, px, py, mx, my) {
    if (!el) return;
    el.style.transform = active
      ? `translateX(${(px * mx).toFixed(1)}px) translateY(${(py * my).toFixed(1)}px)`
      : '';
  }

  // Original city scenes (scenes 5–9, scroll indices 4–8)
  const inS5 = scene === 4;   // scene 5  — city arrival
  const inS6 = scene === 5;   // scene 6
  const inS7 = scene === 6;   // scene 7  — bus stop characters
  const inS8 = scene === 7;   // scene 8  — problem plaza
  const inS9 = false;  // scene-11 removed; scene-9 (display:none) has no parallax

  const inScene12 = scene === 8;
  const inScene13 = scene === 9;
  const inScene21 = scene === 10;

  // Clouds — tier 1 (slowest drift, feels very far)
  move(s5ParallaxEls.cloudImg,    inS5, px1, py1, 10,  5);
  move(s6ParallaxEls.cloudImg,    inS6, px1, py1, 10,  5);
  move(s7ParallaxEls.cloudImg,    inS7, px1, py1, 10,  5);
  move(s8ParallaxEls.cloudImg,    inS8, px1, py1, 10,  5);
  move(s9ParallaxEls.cloudImg,    inS9, px1, py1, 10,  5);

  // Buildings — tier 2 (medium, responds after the bus)
  move(s5ParallaxEls.buildingImg, inS5, px2, py2, 30, 12);
  move(s6ParallaxEls.buildingImg, inS6, px2, py2, 30, 12);
  move(s7ParallaxEls.buildingImg, inS7, px2, py2, 30, 12);
  move(s8ParallaxEls.buildingImg, inS8, px2, py2, 30, 12);
  move(s9ParallaxEls.buildingImg, inS9, px2, py2, 30, 12);

  // Scene 7 people — each on a different tier for distinct timing
  move(s7ParallaxEls.redGirl,   inS7, px3, py3, 40, 18);  // tier 3 — mid-fast
  move(s7ParallaxEls.granny,    inS7, px2, py2, 30, 14);  // tier 2 — medium (furthest)
  move(s7ParallaxEls.orangeMan, inS7, px1, py1, 20, 10);  // tier 1 — slowest
  move(s7ParallaxEls.greenMan,  inS7, px4, py4, 50, 22);  // tier 4 — fastest

  // Scene 8 people — parallax + fade-out + blur as bus zooms in
  // Fade starts at 20 % through scene 8, fully gone by 70 %.
  // People fade out in sync with the bus swap (local 0.15, same 0.03 duration — imperceptible)
  // so it looks like they've boarded the Matatu-with-people version
  const s8FadeT   = inS8 ? Math.min(1, Math.max(0, (local - 0.15) / 0.03)) : 0;
  const s8Opacity = inS8 ? (1 - s8FadeT) : 1;
  const s8Blur    = inS8 ? s8FadeT * 10 : 0;   // 0 → 10 px blur

  const s8Chars = [s8ParallaxEls.purpleMan, s8ParallaxEls.greenMan, s8ParallaxEls.blueGirl, s8ParallaxEls.limeMan];
  s8Chars.forEach(el => {
    if (!el) return;
    el.style.opacity = s8Opacity.toFixed(3);
    el.style.filter  = s8Blur > 0.05 ? `blur(${s8Blur.toFixed(1)}px)` : '';
  });

  move(s8ParallaxEls.purpleMan, inS8, px4, py4, 45, 20);
  move(s8ParallaxEls.greenMan,  inS8, px3, py3, 40, 18);
  move(s8ParallaxEls.blueGirl,  inS8, px2, py2, 35, 16);
  move(s8ParallaxEls.limeMan,   inS8, px4, py4, 55, 25);

  // Scenes 12–13 — wide s12-s15 background; no per-layer parallax needed

  // Scene 21: vehicles are fixed on the 400vw road; the viewport pans across them via effectiveTx

}

// ---- Scene 8 character entrance: scroll-driven slide-up + fade, staggered per person ----
// Runs alongside the strip freeze so sceneLocal (0→1) drives the animation while the
// viewport stays locked. Parallax offsets are blended in on top.
function animateScene8Entry(active, local, px2, py2, px3, py3, px4, py4) {
  // [element, stagger-start (0–1), parallax px, py, mx, my]
  const chars = [
    [s8ParallaxEls.purpleMan, 0.00, px4, py4, 45, 20],
    [s8ParallaxEls.greenMan,  0.10, px3, py3, 40, 18],
    [s8ParallaxEls.blueGirl,  0.20, px2, py2, 35, 16],
    [s8ParallaxEls.limeMan,   0.30, px4, py4, 55, 25],
  ];

  chars.forEach(([el, delay, px, py, mx, my]) => {
    if (!el) return;
    if (!active) {
      el.style.transform = 'translateY(90px)'; // pre-position so entry starts with no jump
      return;
    }
    const t      = easeOutCubic(Math.min(1, Math.max(0, (local - delay) / 0.35)));
    const entryY = (1 - t) * 90;           // slides up 90 px as t goes 0→1
    const prlxX  = px * mx;
    const prlxY  = py * my;
    el.style.transform = `translateX(${prlxX.toFixed(1)}px) translateY(${(entryY + prlxY).toFixed(1)}px)`;
  });
}

// ---- Scene-32 sound icon (Samuel Rutunda): click plays the audio matching the active
// site language; clicking again while it's playing stops it; changing the language also
// stops it, since a src mid-playback would no longer match the newly selected language ----
// Three visual states (data-sound-state, crossfaded via CSS): "landing" (default, never
// clicked), "play" (currently playing), "pause" (currently paused/stopped) — so the icon
// always shows the user which state it's actually in.
const _s32Audios = []; // one Audio instance per sound icon (Samuel's, Asmelash's, ...)
document.querySelectorAll('.sound-icon-s32').forEach(icon => {
  const audio = new Audio();
  _s32Audios.push(audio);
  audio.addEventListener('ended', () => icon.dataset.soundState = 'pause');
  audio.addEventListener('error', () => {
    console.error('Sound icon: failed to load', audio.src, audio.error);
    icon.dataset.soundState = 'pause';
  });
  icon.addEventListener('click', () => {
    if (!audio.paused) {
      audio.pause();
      icon.dataset.soundState = 'pause';
      return;
    }
    const lang = window.i18nCurrentLang || 'en';
    const src  = icon.dataset[`audio${lang.charAt(0).toUpperCase()}${lang.slice(1)}`];
    if (!src) { console.error('Sound icon: no data-audio-* found for lang', lang); return; }
    audio.src = encodeURI(src);
    audio.currentTime = 0;
    audio.play()
      .then(() => icon.dataset.soundState = 'play')
      .catch(err => {
        console.error('Sound icon: play() rejected —', err.name, err.message, audio.src);
        icon.dataset.soundState = 'pause';
      });
  });
});

// ---- Spoken narration (Web Speech API) — always on. Every `.text-panel` across the whole
// site (scenes 1-44) is already shown/hidden via the same opacity + "visible" toggle pattern
// as it becomes relevant to the current scroll position (see the inline panel-visibility
// blocks in frame(), and animateCityBus/animateS26S30/animateS32S43/animateS44 below). Rather
// than hand-listing text per scene, narration just watches those same panels for their
// hidden→visible transition and speaks whichever one just appeared — so what's read out loud
// always matches what's actually on screen, in the same order and pacing as the visual story,
// no matter whether the user is scrolling with a mouse, the arrow/space keys, or a screen
// reader's own navigation.
//
// #pinned-wrap and every fixed scene overlay are permanently aria-hidden (see index.html) —
// a screen reader's own reading cursor auto-scrolls the page to wherever it lands next, which
// fights with this site's custom scroll/transform engine and has no concept of "scene". So
// #narration-live (role="status", aria-live="polite") is the only thing a screen reader
// actually reads: a live region this function writes to, which every major screen reader
// (Narrator, NVDA, JAWS, VoiceOver) announces automatically — in the user's own configured
// voice, rate and language — with no navigation or scrolling needed on their part. This is
// deliberately text-only, not also spoken via window.speechSynthesis: a screen reader user
// already has their AT reading it, so adding our own voice on top would mean two overlapping
// voices reading the same sentence at once. ----
const _narrationPanels = Array.from(document.querySelectorAll('.text-panel'));
const _narrationSeen = new WeakSet();
const narrationLive = document.getElementById('narration-live');

function _panelIsVisible(el) {
  return el.classList.contains('visible') || parseFloat(el.style.opacity || '0') >= 0.5;
}

// A fast scene-jump (see jumpScroll) can cross several popups' visibility windows within one
// smooth-scroll animation, each wanting to announce within milliseconds of each other — faster
// than a screen reader can speak them. Queue and drain one at a time instead of overwriting
// #narration-live's text before it's had a chance to be read.
let _liveQueue = [];
let _liveDraining = false;

function _queueLiveText(text) {
  _liveQueue.push(text);
  _drainLiveQueue();
}

function _drainLiveQueue() {
  if (_liveDraining || _liveQueue.length === 0 || !narrationLive) return;
  _liveDraining = true;
  const text = _liveQueue.shift();
  narrationLive.textContent = text;
  // Roughly proportional to length at a typical reading pace, so longer quotes get more time
  // before the next queued item overwrites this one.
  const readMs = Math.max(1200, Math.min(9000, text.length * 55));
  setTimeout(() => { _liveDraining = false; _drainLiveQueue(); }, readMs);
}

// ---- Auto-advance: once the current part finishes, automatically step forward to the next
// one — so a screen reader / keyboard user isn't pressing Next after every single panel. NOT
// started on page load (a sighted mouse user would never touch it, so it should never move on
// its own for them) — instead it only starts the first time the Previous/Next story button is
// pressed, since that's specifically the accessible control an AT/keyboard user interacts with.
// Pauses permanently the first time the user scrolls with their own wheel/touch/arrow input,
// read as them taking manual control. ----
let _autoAdvanceActive = false;
let _autoAdvanceTimer = null;

function startAutoAdvance() {
  if (_autoAdvanceActive) return;
  _autoAdvanceActive = true;
  scheduleAutoAdvance(600);
}

function scheduleAutoAdvance(delay) {
  if (!_autoAdvanceActive) return;
  clearTimeout(_autoAdvanceTimer);
  _autoAdvanceTimer = setTimeout(() => {
    if (!_autoAdvanceActive) return;
    const { currentScene, sceneLocal } = scrollToState(window.scrollY);
    if (currentScene >= SCENES - 1 && sceneLocal >= 1) return; // reached the very end
    stepScroll(1, true);
    // Some scenes have long gaps between narrated panels — keep checking shortly after each
    // step in case several steps are needed before the next thing to narrate becomes visible.
    scheduleAutoAdvance(900);
  }, delay);
}

function pauseAutoAdvance() {
  _autoAdvanceActive = false;
  clearTimeout(_autoAdvanceTimer);
}

// Speaks + live-announces one piece of text — shared by panel narration and the scene-beat
// descriptions below. #narration-live always updates (harmless with no screen reader present,
// and it's what Narrator itself reads regardless of our own audio). The spoken audio only
// plays once _autoAdvanceActive is true — i.e. only after the user has engaged the accessible
// Previous/Next controls — so ordinary mouse/trackpad scrolling stays silent and only makes
// the visuals move, exactly like a normal page.
function narrate(text) {
  _queueLiveText(text);
  if (_autoAdvanceActive && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = window.i18nCurrentLang || 'en';
    utterance.lang = lang === 'sw' ? 'sw-KE' : lang === 'ti' ? 'ti-ET' : 'en-US';
    window.speechSynthesis.speak(utterance);
  }
  if (_autoAdvanceActive) {
    const readMs = Math.max(1200, Math.min(9000, text.length * 55));
    scheduleAutoAdvance(readMs + 400);
  }
}

function checkNarration() {
  _narrationPanels.forEach(el => {
    const visible = _panelIsVisible(el);
    if (visible && !_narrationSeen.has(el)) {
      _narrationSeen.add(el);
      const text = el.textContent.trim();
      if (text) narrate(text);
    } else if (!visible && _narrationSeen.has(el)) {
      // Scrolling back to a panel later re-narrates it — no permanent "already read" state.
      _narrationSeen.delete(el);
    }
  });
}

// Short descriptions for story beats that have no dedicated text-panel — pure visual/motion
// moments (a scene transition, vehicles on the road, characters boarding) that would
// otherwise have nothing announced at all. Keyed by currentScene index (0-based, matches
// SCENE_SCROLL/SCENE_LABELS — label shown in parentheses).
const SCENE_NARRATION_EXTRAS = {
  3:  'The Prevailer speeds through the open savanna, leaving the jungle behind.',   // scene-4
  4:  'The Prevailer arrives in the city, rolling past its buildings and streets before pulling up at a busy bus stop, where several passengers board and speak about the languages they use every day.', // scene-5
  10: 'Top-down view of the road: Meta, OpenAI, Google and Microsoft vehicles speed past, trailed by a small delivery truck.', // scene-21
  11: 'The matatu arrives on a busy street, vendors and motorbikes passing by.',      // scene-26
  12: 'Asmelash Teka Hadgu of Lesan AI and Awa Ly of Galsen AI step aboard.',         // scene-27
  13: 'Chris Emezue of Lanfrica Labs and Kathleen Siminyu of Masakane and DAIR step aboard.', // scene-28
  14: 'Sadik Shahadu of the Dagbani Wikimedians User Group and Samuel Rutunda of Digital Umuganda step aboard.', // scene-29
};
let _lastExtraScene = -1;

function checkSceneExtras(scene) {
  if (scene === _lastExtraScene) return;
  _lastExtraScene = scene;
  const text = SCENE_NARRATION_EXTRAS[scene];
  if (text) narrate(text);
}

// ---- Dot click: jump to scene ----
dots.forEach(dot => {
  dot.addEventListener('click', () => {
    pauseAutoAdvance(); // manual scroll input — user is taking control themselves
    const scene   = parseInt(dot.dataset.scene);
    const targetY = SCROLL_MAP[scene] ? SCROLL_MAP[scene].scrollStart + 10 : 0;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  });
});

// ---- Touch: horizontal swipe → vertical scroll ----
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
  pauseAutoAdvance(); // manual scroll input — user is taking control themselves
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
  const dx = touchStartX - e.touches[0].clientX;
  const dy = touchStartY - e.touches[0].clientY;
  if (Math.abs(dx) > Math.abs(dy)) {
    window.scrollBy(0, dx * 1.5);
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
}, { passive: true });

// ---- Scroll navigation: shared by keyboard input and the Previous/Next story buttons ----
// jumpScroll: full scene skip (chapter-skip). stepScroll: incremental move, clamped to what's
// left in the CURRENT scene — a jump bigger than a scene's own scroll length (some, like
// scene-4, are intentionally very short) would skip straight over it, so nothing gated on
// sceneLocal inside that scene (trees reveal, popups) would ever get a frame to appear.
// behavior:'smooth' (only available via the options-object form of scrollTo, not scrollBy's
// two-argument form) makes the browser animate through every intermediate scrollY over several
// frames instead of teleporting to it in one paint.
function jumpScroll(dir) {
  const { currentScene } = scrollToState(window.scrollY);
  if (dir > 0 && currentScene < SCENES - 1) {
    const targetY = SCROLL_MAP[currentScene + 1] ? SCROLL_MAP[currentScene + 1].scrollStart + 10 : TOTAL_SCROLL;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  } else if (dir < 0 && currentScene > 0) {
    const targetY = SCROLL_MAP[currentScene - 1] ? SCROLL_MAP[currentScene - 1].scrollStart + 10 : 0;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
}

const STEP_LINE = 80;                          // px per small step
const STEP_PAGE = () => window.innerHeight * 0.9; // px per large (page) step

function stepScroll(dir, big) {
  const { currentScene } = scrollToState(window.scrollY);
  const seg  = SCROLL_MAP[currentScene];
  const want = big ? STEP_PAGE() : STEP_LINE;
  let targetY;
  if (dir > 0) {
    const remaining = seg ? seg.scrollEnd - window.scrollY : want;
    targetY = window.scrollY + Math.max(20, Math.min(want, remaining));
  } else {
    const remaining = seg ? window.scrollY - seg.scrollStart : want;
    targetY = window.scrollY - Math.max(20, Math.min(want, remaining));
  }
  window.scrollTo({ top: targetY, behavior: 'smooth' });
}

// ---- Keyboard: arrow navigation ----
// ArrowRight/ArrowLeft jump straight to the next/previous scene's start (chapter-skip).
// Down/PageDown/Space and Up/PageUp/Shift+Space instead step scrollY incrementally, like a
// normal page — this matters because most content (bus drive-in, popups, zoom sequences) is
// gated on gradual scroll *position within* a scene, not just which scene is active.
const JUMP_FORWARD_KEYS  = ['ArrowRight'];
const JUMP_BACKWARD_KEYS = ['ArrowLeft'];
const STEP_FORWARD_KEYS  = ['ArrowDown', 'PageDown', ' '];
const STEP_BACKWARD_KEYS = ['ArrowUp', 'PageUp'];

const SCROLL_KEY_SKIP_TAGS = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];

document.addEventListener('keydown', e => {
  // Let Space/Arrow keys do their normal job (activate/navigate) on focusable controls —
  // only treat them as scroll input when focus is elsewhere (e.g. the document body).
  if (SCROLL_KEY_SKIP_TAGS.includes(e.target.tagName)) return;

  const jumpForward  = JUMP_FORWARD_KEYS.includes(e.key);
  const jumpBackward = JUMP_BACKWARD_KEYS.includes(e.key);
  const stepBackward = STEP_BACKWARD_KEYS.includes(e.key) || (e.key === ' ' && e.shiftKey);
  const stepForward  = STEP_FORWARD_KEYS.includes(e.key) && !(e.key === ' ' && e.shiftKey);

  if (!jumpForward && !jumpBackward && !stepForward && !stepBackward) return;
  pauseAutoAdvance(); // manual scroll input — user is taking control themselves

  if (jumpForward)       { e.preventDefault(); jumpScroll(1); }
  else if (jumpBackward) { e.preventDefault(); jumpScroll(-1); }
  else {
    e.preventDefault();
    const big = e.key === ' ' || e.key === 'PageDown' || e.key === 'PageUp';
    stepScroll(stepForward ? 1 : -1, big);
  }
});

// ---- Story Previous/Next buttons — always-focusable, real controls (not aria-hidden) for
// screen reader users. The story area itself is aria-hidden (see #pinned-wrap in index.html)
// because a screen reader's own reading-cursor navigation auto-scrolls the page in ways that
// fight with this site's custom scroll engine — so its virtual cursor has nothing left to
// land on there, meaning it no longer generates the arrow-key input the handler above listens
// for. These buttons are an unambiguous Tab+Enter alternative that drives the exact same step,
// one page-sized step per press. Auto-advance starts the moment either button receives focus
// (Tab landing on it, Narrator announcing its label) — not only on click — since these are
// specifically the controls a screen reader / keyboard user interacts with, not something a
// sighted mouse user would ever touch, so there's no need to wait for an explicit activation.
const storyPrevBtn = document.getElementById('storyPrevBtn');
const storyNextBtn = document.getElementById('storyNextBtn');
if (storyPrevBtn) storyPrevBtn.addEventListener('click', () => { startAutoAdvance(); stepScroll(-1, true); });
if (storyNextBtn) storyNextBtn.addEventListener('click', () => { startAutoAdvance(); stepScroll(1, true); });

// focusin (bubbles, unlike focus) — more reliable across browsers/AT combinations for
// detecting "did focus land on this element", including however Narrator synchronizes its
// own reading cursor to a real focusable control.
document.addEventListener('focusin', e => {
  if (e.target === storyPrevBtn || e.target === storyNextBtn) startAutoAdvance();
});

// ---- Resize ----
window.addEventListener('resize', setup);

// ---- Character speech bubble ----
// Content is sourced from i18n/<lang>.json via tChar() (see i18n.js) so every
// popup is multilingual with automatic fallback to English.

const charBubble    = document.getElementById('char-bubble');
const bubbleStat    = charBubble.querySelector('.char-bubble-stat');
const bubbleLang    = charBubble.querySelector('.char-bubble-lang');
let activeCrossBtn  = null;

document.querySelectorAll('.cross-btn, .plus-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();

    if (activeCrossBtn === btn) {
      charBubble.classList.remove('visible', 'dialogue', 'pop-left');
      activeCrossBtn = null;
      return;
    }

    const data = tChar(btn.dataset.popup);
    if (!data) return;

    if (data.dialogue) {
      bubbleStat.textContent = '';
      bubbleLang.textContent = data.dialogue;
      charBubble.classList.add('dialogue');
    } else {
      bubbleStat.textContent = data.stat;
      bubbleLang.textContent = data.lang;
      charBubble.classList.remove('dialogue');
    }

    const rect = btn.getBoundingClientRect();
    const dir  = btn.dataset.dir || 'right';

    // Button is in front of the face; popup opens in the opposite direction (behind/over the character)
    charBubble.classList.add('visible');
    if (dir === 'right') {
      // Button on right (front of right-facing char) → popup opens LEFT
      charBubble.classList.add('pop-left');
      const bw = charBubble.offsetWidth;
      charBubble.style.left = (rect.left - bw - 12) + 'px';
    } else {
      // Button on left (front of left-facing char) → popup opens RIGHT
      charBubble.classList.remove('pop-left');
      charBubble.style.left = (rect.right + 12) + 'px';
    }
    charBubble.style.top = (rect.top + rect.height / 2 - 22) + 'px';

    activeCrossBtn = btn;
  });
});

document.addEventListener('click', () => {
  charBubble.classList.remove('visible', 'dialogue', 'pop-left');
  activeCrossBtn = null;
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    charBubble.classList.remove('visible', 'dialogue', 'pop-left');
    activeCrossBtn = null;
  }
});

// Re-render an already-open bubble's text when the language changes
document.addEventListener('i18n:rendered', () => {
  _s32Audios.forEach(audio => audio.pause());
  document.querySelectorAll('.sound-icon-s32[data-sound-state="play"]').forEach(icon => icon.dataset.soundState = 'pause');
  if (!activeCrossBtn) return;
  const data = tChar(activeCrossBtn.dataset.popup);
  if (!data) return;
  if (data.dialogue) {
    bubbleStat.textContent = '';
    bubbleLang.textContent = data.dialogue;
  } else {
    bubbleStat.textContent = data.stat;
    bubbleLang.textContent = data.lang;
  }
});

// ---- Pause toggle (press P or Space to freeze rAF for DevTools inspection) ----
let _paused = false;
document.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P') {
    _paused = !_paused;
    console.log(_paused ? '⏸ rAF paused — DevTools edits will hold' : '▶ rAF resumed');
  }
});

function frameLoop(ts) {
  if (!_paused) frame(ts);
  requestAnimationFrame(frameLoop);
}

// ---- Init ----
// Let the browser restore scroll position on refresh
if ('scrollRestoration' in history) history.scrollRestoration = 'auto';

setup();
requestAnimationFrame(frameLoop);
