/* ============================================
   PREVAILER MATATU JOURNEY — scroll.js
   Continuous rAF engine: scroll-driven + time-based motion
   ============================================ */

const SCENES = 16;
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
  2.0,  // 12 → scene-27 (Asmelash Teka Hadgu & Away Ly)
  2.0,  // 13 → scene-28 (Chris Emezue & Kathleen Siminyu)
  2.0,  // 14 → scene-29 (Sadik Shahadu & Samuel Rutunda)
  2.0,  // 15 → scene-30 (all interviewees aboard)
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
    { scene: 1, at:  20, x:   15 },   // scene 1,  50% — bus fully visible
    { scene: 1, at:  50, x:   25 },   // scene 1,  50% — bus fully visible
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

// Fixed trees overlay for scene 4 — sits above #jungle-bus (z:11 vs z:10)
const s4TreesOverlay = document.getElementById('s4-trees');
// Fixed trees overlay for scene 5 — sits above #city-bus in root stacking context
const cityTrees5    = document.getElementById('city-trees-5');
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
const s21vMeta      = document.getElementById('s21v-meta');
const s21vOpenAI    = document.getElementById('s21v-openai');
const s21vMatatu    = document.getElementById('s21v-matatu');
const s21vGoogle    = document.getElementById('s21v-google');
const s21vMicrosoft = document.getElementById('s21v-microsoft');
// Scene-21 clouds — fixed overlay z:2, fade in near end of scene
const s21cRegular   = document.getElementById('s21c-regular');
const s21cWhite     = document.getElementById('s21c-white');

// Scene 26–30 overlay — 500vw wide, translates in sync with the strip
const cityOverlay26 = document.getElementById('city-overlay-26');

// Sequential interviewee swap — ordered left-to-right by overlay position so swaps
// follow the natural scroll reveal (samuel 86vw → awayly 91vw → … → kathleen 280vw)
const s2630Pairs = [
  [document.querySelector('.char-s29-samuel'),   document.querySelector('.char-s29-samuel-1')],
  [document.querySelector('.char-s27-awayly'),   document.querySelector('.char-s27-awayly-1')],
  [document.querySelector('.char-s28-chris'),    document.querySelector('.char-s28-chris-1')],
  [document.querySelector('.char-s27-asmelash'), document.querySelector('.char-s27-asmelash-1')],
  [document.querySelector('.char-s29-sadik'),    document.querySelector('.char-s29-sadik-1')],
  [document.querySelector('.char-s28-kathleen'), document.querySelector('.char-s28-kathleen-1')],
];
const s2630G1Op = [1, 1, 1, 1, 1, 1]; // running opacity — group1 standing chars
const s2630G2Op = [0, 0, 0, 0, 0, 0]; // running opacity — group2 name cards
let _s2630ReleaseTxBase = null; // natural tx captured at the instant the release begins
let _s2630BoardFade    = 0;    // time-lerped 0→1 once all swaps done; fades out all characters



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
function setup() {
  buildScrollMap();
  spacer.style.height = (TOTAL_SCROLL + window.innerHeight) + 'px';
  document.body.style.height = (TOTAL_SCROLL + window.innerHeight) + 'px';
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

// ---- Bus opacity: hidden until first scroll, then fades in ----
let busOpacity  = 0;    // lerps 0 → 1 once scrolling starts
let hasScrolled = false;

// ---- Continuous animation loop ----
let lastTs = 0;

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
  if (currentScene === 7 && SCROLL_MAP[8]) {
    // Scene 8 zoom: pin strip at scene-12 position so background matches scene 12 start
    // cityOverlay8 is decoupled and stays fixed at viewport left (s8vx = 0 below)
    effectiveTx = -(SCROLL_MAP[8].stripX);
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
    // stay on screen while they swap one by one
    _s2630ReleaseTxBase = null; // clear so it's captured fresh when release begins
    effectiveTx = -(SCROLL_MAP[11].stripX + 0.77 * _vw);
  } else if (SCROLL_MAP[11] && (
    (currentScene === 14 && sceneLocal >= 0.85) ||
    currentScene === 15
  )) {
    // All swaps done — resume scrolling at normal speed from freeze position (no catch-up burst)
    const frozenEtx = -(SCROLL_MAP[11].stripX + 0.77 * _vw);
    if (_s2630ReleaseTxBase === null) _s2630ReleaseTxBase = tx;
    effectiveTx = frozenEtx + (tx - _s2630ReleaseTxBase);
  } else {
    _s2630ReleaseTxBase = null;
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
    // During scene 7 zoom the overlay is decoupled from the strip (strip shows scene-12 bg)
    // so pin it at viewport 0; outside scene 7 let it slide normally with the strip
    const s8vx = (currentScene === 7) ? 0 : SCROLL_MAP[7].stripX + effectiveTx;
    cityOverlay8.style.opacity = (s8vx < _vw && s8vx > -_vw) ? '1' : '0';
    cityOverlay8.style.transform = `translateX(${s8vx.toFixed(1)}px)`;
  }
  if (cityOverlay9 && SCROLL_MAP[8]) {
    const s9vx = SCROLL_MAP[8].stripX + effectiveTx;
    // Guard: only show once we're actually in scene 12+ — effectiveTx = -8vw during scene 7
    // would otherwise put this overlay at x=0 and bleed it into the zoom scene
    const show9 = currentScene >= 8 && s9vx < _vw && s9vx > -_vw;
    cityOverlay9.style.opacity = show9 ? '1' : '0';
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
    if (s21Preview) s21Preview.style.opacity  = tFade.toFixed(3);
  } else if (currentScene >= 10) {
    if (s12s15bg)   s12s15bg.style.opacity   = '0';
    if (s21Preview) s21Preview.style.opacity  = '0'; // strip scene-21+ has taken over
  } else {
    if (s12s15bg)   s12s15bg.style.opacity   = '1';
    if (s21Preview) s21Preview.style.opacity  = '0';
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
  scrollHint.classList.toggle('hidden', scrollY > 80);

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

  // -- Debug scale --
  const st2      = window.scrollTimer;
  const totalMs2 = st2.totalMs + (st2.isScrolling && st2._sessionStart ? Date.now() - st2._sessionStart : 0);
  const secs     = (totalMs2 / 1000).toFixed(1);
  const _inJungle  = JUNGLE_BUS_SCENES.includes(currentScene + 1);
  const _scenePct  = Math.round(sceneLocal * 100);
  const busVw      = _inJungle
    ? interpolateKeyframes(JUNGLE_KF, junglePhase).toFixed(0)
    : '–';
  const SCENE_LABELS = [1,2,3,4,5,6,7,8,12,13,21,26,27,28,29,30];
  const _sceneLabel  = SCENE_LABELS[currentScene] ?? (currentScene + 1);
  if (dbgScene)  dbgScene.textContent  = `scene ${_sceneLabel}  ${_scenePct}%`;
  if (dbgTime)   dbgTime.textContent   = `${secs}s`;
  if (dbgBus)    dbgBus.textContent    = `bus: ${busVw}vw`;
  if (dbgCursor) dbgCursor.style.left  = `${Math.min(((currentScene + sceneLocal) / SCENES) * 100, 96).toFixed(2)}%`;

  // -- Savanna / city layer reveals --
  animateLayerReveals(currentScene, sceneLocal);

  // -- City parallax for all city scenes (after layer clear so transforms aren't wiped) --
  applyCityParallax(currentScene, sceneLocal, prlxX1, prlxY1, prlxX2, prlxY2, prlxX3, prlxY3, prlxX4, prlxY4);

  // -- Text panel visibility --
  [1, 2, 3, 5, 6, 7, 9].forEach(n => {
    if (!panels[n]) return;
    const show = currentScene === n - 1 && sceneLocal > 0.3 && sceneLocal < 0.92;
    panels[n].style.opacity = show ? '1' : '0';
    panels[n].classList.toggle('visible', show);
  });

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
        // Scene 1: bus enters fast 0→30%, popup appears at 30% and bus visibly
        // parks at CENTER by 25% — fully stopped before popup opens at 30%
        const t = easeInOutCubic(Math.min(1, local / 0.25));
        busX = ENTRY + t * (CENTER - ENTRY);
        busOpacityLocal = Math.min(1, local / 0.12); // fade in over first 12% of scene
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
        jungleBus.style.transform = `translateX(${busX.toFixed(1)}px)`;
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
    // Scene 5: bus continues from ENTRY (left edge) to CENTER
    // Parks at CENTER by 25% — fully stopped before popup opens at 30%
    const t = easeInOutCubic(Math.min(1, local / 0.25));
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
    // Bus variant: full-toto-moto until all 6 swaps done, then cross-fade to interviewees
    const swapProg = scene < 12 ? -1 : scene > 14 ? 7 : (scene - 12) * 2 + local * 2;
    const busSwapT = Math.min(1, Math.max(0, (swapProg - 5.7) / 0.3));
    if (cityBusFull) cityBusFull.style.opacity = (1 - busSwapT).toFixed(3);
    if (cityBusS26)  cityBusS26.style.opacity  = busSwapT.toFixed(3);
    if (scene === 11) {
      // Drive from off-screen left to center over first 40% of scene 26
      const t = easeInOutCubic(Math.min(1, local / 0.4));
      busX = ENTRY + t * (CENTER - ENTRY);
    } else {
      busX = CENTER;
    }
    // Scene 30: zoom bus in starting at 34%, filling the screen by scene end
    if (scene === 15 && local >= 0.34) {
      const tz = easeInOutCubic(Math.min(1, (local - 0.34) / 0.66));
      const s30Scale = 1 + (3.0 - 1) * tz;
      if (cityBus) cityBus.style.transformOrigin = '50% 50%';
      if (pinnedWrap) {
        pinnedWrap.style.transformOrigin = `50% ${busCenterY().toFixed(1)}%`;
        pinnedWrap.style.transform = `scale(${s30Scale.toFixed(3)})`;
      }
    } else {
      if (pinnedWrap) pinnedWrap.style.transform = 'scale(1)';
    }
  }

  // Apply cursor parallax across all city scenes (5–19); frozen only during bus close-up
  const inCityBus  = scene >= 4 && scene <= 16;
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
    [s21vMeta, s21vOpenAI, s21vMatatu, s21vGoogle, s21vMicrosoft].forEach(el => {
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
  const active = scene >= 11 && scene <= 15;
  const s26vx = SCROLL_MAP[11].stripX + etx;
  cityOverlay26.style.opacity   = active ? '1' : '0';
  cityOverlay26.style.transform = `translateX(${s26vx.toFixed(1)}px)`;

  // Sequential character swap during scenes 27-29 (indices 12-14).
  // progress 0→6 across scenes 27-29 (indices 12-14), 2 units per scene.
  // Swap i fades over progress [i+0.3 → i+0.7] so there's a short pause between each.
  let progress;
  if (scene < 12)      progress = -1;
  else if (scene > 14) progress =  7;
  else                 progress = (scene - 12) * 2 + local * 2;

  // Once all 6 swaps are done, slowly fade ALL characters out (they've boarded the bus)
  const allDone = progress >= 5.7;
  if (!allDone) _s2630BoardFade = 0;
  else          _s2630BoardFade += (1 - _s2630BoardFade) * 0.018; // ~3 s to full fade

  const LERP = 0.08;
  s2630Pairs.forEach(([g1, g2], i) => {
    const t  = Math.min(1, Math.max(0, (progress - (i + 0.3)) / 0.4));
    s2630G1Op[i] += ((1 - t) - s2630G1Op[i]) * LERP;
    s2630G2Op[i] += (t       - s2630G2Op[i]) * LERP;
    const board = 1 - _s2630BoardFade;
    if (g1) g1.style.opacity = (s2630G1Op[i] * board).toFixed(3);
    if (g2) g2.style.opacity = (s2630G2Op[i] * board).toFixed(3);
  });
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

// ---- Dot click: jump to scene ----
dots.forEach(dot => {
  dot.addEventListener('click', () => {
    const scene   = parseInt(dot.dataset.scene);
    const targetY = SCROLL_MAP[scene] ? SCROLL_MAP[scene].scrollStart + 10 : 0;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  });
});

// ---- Touch: horizontal swipe → vertical scroll ----
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
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

// ---- Keyboard: arrow navigation ----
document.addEventListener('keydown', e => {
  const { currentScene } = scrollToState(window.scrollY);

  if (e.key === 'ArrowRight' && currentScene < SCENES - 1) {
    const targetY = SCROLL_MAP[currentScene + 1] ? SCROLL_MAP[currentScene + 1].scrollStart + 10 : TOTAL_SCROLL;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
  if (e.key === 'ArrowLeft' && currentScene > 0) {
    const targetY = SCROLL_MAP[currentScene - 1] ? SCROLL_MAP[currentScene - 1].scrollStart + 10 : 0;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
});

// ---- Resize ----
window.addEventListener('resize', setup);

// ---- Character speech bubble ----
const charMessages = {
  's7-red-girl':   { dialogue: 'In the African region we are highly multilingual! I speak Twi, Pidgin and understand Fante.' },
  's7-granny':     { dialogue: 'My mother speaks Oshiwambo, and my father Otjiherero. I learned both and I also speak English.' },
  's7-orange-man': { dialogue: 'I speak French, Mandija and Gbaya.' },
  's7-green-man':  { dialogue: 'Fulfulde is my mother tongue. I use Hausa for trade, and Arabic for education.' },
  's8-purple-man': { stat: 'TWI, KISWAHILI, WOLOF',          lang: '230M+ SPEAKERS' },
  's8-blue-girl':  { stat: 'FULFULDE, HAUSA, ARABIC',        lang: '300M+ SPEAKERS' },
  's8-lime-man':   { stat: 'KINYARWANDA, GURUNE, ENGLISH',   lang: '270M+ SPEAKERS' },
  's8-green-man':  { stat: 'FRENCH, DAGBANI, TIGRINYA',      lang: '180M+ SPEAKERS' },
  's12-green-man':  { stat: '200M+ SPEAKERS', lang: 'SWAHILI' },
  's12-blue-man':   { stat: '12M+ SPEAKERS',  lang: 'ZULU' },
  's12-pink-lady':  { stat: '45M+ SPEAKERS',  lang: 'YORUBA' },
  's28-kathleen': { stat: 'Kathleen Siminyu', lang: 'Masakane and DAIR' },
  's29-samuel':   { stat: 'Samuel Rutunda',   lang: 'Digital Umuganda' },
  's27-awayly':   { stat: 'Awa Ly',           lang: 'Galsen AI' },
  's28-chris':    { stat: 'Chris Emezue',     lang: 'Lanfrica Labs' },
  's27-asmelash': { stat: 'Asmelash Teka Hadgu', lang: 'Lesan AI' },
  's29-sadik':    { stat: 'Sadik Shahadu',    lang: 'Dagbani Wikimedians User Group' },
};

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

    const data = charMessages[btn.dataset.popup];
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
