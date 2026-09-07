/**
 * Generates assets/lottie/boot.json — the cold-start logo animation.
 *
 * Hand-authoring a 200KB Lottie by hand is not editable by anyone, so the
 * animation is described here as a timeline and compiled. Change the numbers
 * below and re-run:
 *
 *   node scripts/build-boot-lottie.mjs
 *
 * The real brand mark (assets/logo-g.png) is downscaled to 256px and embedded
 * in the JSON as a base64 image asset, so the Lottie is self-contained — no
 * imageAssetsFolder wiring on Android, no second file to keep in sync. The
 * tile, glow and rings around it are vector shape layers.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Brand constants (sampled from the mark, not the UI palette) ─────────────
const GREEN = [0.2745, 0.6941, 0.3176];
const CREAM = [0.9647, 0.9373, 0.8941];

// ── Timing, in frames at 60fps ──────────────────────────────────────────────
const FPS = 60;
const OUT = 104;              // 1.73s
const GLYPH_LANDS = 34;       // the beat the haptic and the wordmark hang off

const SIZE = 512;             // composition (design) space
const C = SIZE / 2;
const TILE = 232;             // rounded tile edge
const GLYPH = 256;            // embedded PNG edge
const GLYPH_ON_TILE = 148;    // how big the G sits inside the tile

// ── Lottie property helpers ─────────────────────────────────────────────────
const EASE_OUT = { i: { x: [0.16], y: [1] }, o: { x: [0.3], y: [0] } };
const EASE_IN_OUT = { i: { x: [0.4], y: [1] }, o: { x: [0.4], y: [0] } };

/** Static property. */
const k = (v) => ({ a: 0, k: Array.isArray(v) ? v : [v] });
/** Static, non-array (radius, width, opacity on shape items). */
const n = (v) => ({ a: 0, k: v });

/**
 * Animated property from [frame, value, easing?] tuples. Values may be numbers
 * or arrays; the last tuple is the hold value.
 */
function anim(frames) {
  return {
    a: 1,
    k: frames.map(([t, v, ease], idx) => {
      const s = Array.isArray(v) ? v : [v];
      if (idx === frames.length - 1) return { t, s };
      const e = ease ?? EASE_OUT;
      const dims = s.length;
      const fan = (arr) => (dims === 1 ? arr : Array(dims).fill(arr[0]));
      return { t, s, i: { x: fan(e.i.x), y: fan(e.i.y) }, o: { x: fan(e.o.x), y: fan(e.o.y) } };
    }),
  };
}

const group = (items) => ({
  ty: 'gr',
  it: [...items, { ty: 'tr', p: k([0, 0]), a: k([0, 0]), s: k([100, 100]), r: n(0), o: n(100), nm: 'tr' }],
  nm: 'g',
});

const layer = (ind, nm, extra) => ({
  ddd: 0, ind, nm, sr: 1, ao: 0, ip: 0, op: OUT, st: 0, bm: 0, ...extra,
});

// ── The mark, downscaled and inlined ────────────────────────────────────────
const tmp = join(mkdtempSync(join(tmpdir(), 'grittt-lottie-')), 'g.png');
execFileSync('sips', ['-z', String(GLYPH), String(GLYPH), join(ROOT, 'assets/logo-g.png'), '--out', tmp], {
  stdio: 'ignore',
});
const glyphData = `data:image/png;base64,${readFileSync(tmp).toString('base64')}`;

// ── Layers (index 1 renders on top) ─────────────────────────────────────────
const layers = [
  // 1. The G. Arrives small and slightly rotated, overshoots, settles. This is
  //    the moment the whole launch screen exists for.
  layer(1, 'glyph', {
    ty: 2,
    refId: 'glyph',
    ks: {
      o: anim([[18, 0], [26, 100]]),
      r: anim([[18, -12], [GLYPH_LANDS, 2], [46, 0]]),
      p: k([C, C, 0]),
      a: k([GLYPH / 2, GLYPH / 2, 0]),
      s: (() => {
        const fit = (GLYPH_ON_TILE / GLYPH) * 100;
        return anim([
          [18, [fit * 0.42, fit * 0.42], EASE_OUT],
          [GLYPH_LANDS, [fit * 1.1, fit * 1.1], EASE_IN_OUT],
          [48, [fit, fit]],
        ]);
      })(),
    },
  }),

  // 2. Cream tile. Pops first so the G has something to land on, then takes a
  //    small hit at GLYPH_LANDS — the mark lands with weight rather than fading.
  layer(2, 'tile', {
    ty: 4,
    ks: {
      o: anim([[0, 0], [12, 100]]),
      r: n(0),
      p: k([C, C, 0]),
      a: k([0, 0, 0]),
      s: anim([
        [2, [80, 80], EASE_OUT],
        [20, [104, 104], EASE_IN_OUT],
        [30, [100, 100], EASE_IN_OUT],
        [GLYPH_LANDS + 4, [104.5, 104.5], EASE_IN_OUT],
        [52, [100, 100]],
      ]),
    },
    shapes: [
      group([
        { ty: 'rc', d: 1, s: k([TILE, TILE]), p: k([0, 0]), r: n(64), nm: 'tile' },
        { ty: 'fl', c: k([...CREAM, 1]), o: n(100), r: 1, nm: 'fill' },
      ]),
    ],
  }),

  // 3. Impact ring — one expanding pulse off the landing, then gone.
  layer(3, 'pulse', {
    ty: 4,
    ks: {
      o: anim([[GLYPH_LANDS, 0], [GLYPH_LANDS + 3, 52], [62, 0]]),
      r: n(0),
      p: k([C, C, 0]),
      a: k([0, 0, 0]),
      s: anim([[GLYPH_LANDS, [92, 92]], [62, [176, 176]]]),
    },
    shapes: [
      group([
        { ty: 'el', s: k([TILE, TILE]), p: k([0, 0]), nm: 'ring' },
        { ty: 'st', c: k([...GREEN, 1]), o: n(100), w: n(3), lc: 2, lj: 1, nm: 'stroke' },
      ]),
    ],
  }),

  // 4. Orbit sweep — a stroke that draws itself around the mark while the tile
  //    settles, then dissolves. Gives the hold a sense of progress.
  layer(4, 'sweep', {
    ty: 4,
    ks: {
      o: anim([[8, 0], [20, 100], [76, 100], [88, 0]]),
      r: n(-90),
      p: k([C, C, 0]),
      a: k([0, 0, 0]),
      s: k([100, 100, 100]),
    },
    shapes: [
      group([
        { ty: 'el', s: k([322, 322]), p: k([0, 0]), nm: 'orbit' },
        {
          ty: 'tm',
          // Start chases end so the stroke swallows its own tail and leaves
          // cleanly, instead of a lone crescent cut off by the opacity fade.
          s: anim([[26, 0], [82, 100]]),
          e: anim([[8, 0], [56, 100]]),
          o: n(0),
          m: 1,
          nm: 'trim',
        },
        { ty: 'st', c: k([...GREEN, 1]), o: n(100), w: n(5), lc: 2, lj: 1, nm: 'stroke' },
      ]),
    ],
  }),

  // 5. Radial glow behind everything. Real gradient rather than a flat disc —
  //    a flat one reads as a green circle on a dark screen.
  layer(5, 'glow', {
    ty: 4,
    ks: {
      o: anim([[0, 0], [30, 100], [OUT, 78]]),
      r: n(0),
      p: k([C, C, 0]),
      a: k([0, 0, 0]),
      s: anim([[0, [55, 55]], [46, [100, 100]]]),
    },
    shapes: [
      group([
        { ty: 'el', s: k([460, 460]), p: k([0, 0]), nm: 'halo' },
        {
          ty: 'gf',
          o: n(100),
          r: 1,
          t: 2, // radial
          s: k([0, 0]),
          e: k([230, 0]),
          g: {
            p: 3,
            k: k([
              // colour stops: pos, r, g, b
              0, ...GREEN,
              0.55, ...GREEN,
              1, ...GREEN,
              // alpha stops: pos, alpha
              0, 0.34,
              0.55, 0.12,
              1, 0,
            ]),
          },
          nm: 'glowfill',
        },
      ]),
    ],
  }),
];

const doc = {
  v: '5.9.0',
  fr: FPS,
  ip: 0,
  op: OUT,
  w: SIZE,
  h: SIZE,
  nm: 'Grittt Boot',
  ddd: 0,
  assets: [{ id: 'glyph', w: GLYPH, h: GLYPH, u: '', p: glyphData, e: 1 }],
  layers,
};

const dest = join(ROOT, 'assets/lottie/boot.json');
writeFileSync(dest, JSON.stringify(doc));
console.log(`wrote ${dest} (${(JSON.stringify(doc).length / 1024).toFixed(0)} KB) — ${OUT} frames @ ${FPS}fps`);
