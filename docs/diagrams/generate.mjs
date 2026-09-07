#!/usr/bin/env node
// Generates the .excalidraw scene files in this folder from the specs below.
//
//   node docs/diagrams/generate.mjs
//
// The output is a normal Excalidraw scene: open it at excalidraw.com (File →
// Open) or with the "Excalidraw" VS Code extension, drag things around, and
// save. Re-running this script OVERWRITES the files, so if you hand-edit a
// scene either stop regenerating it or fold your change back into the spec
// here. Seeds are deterministic (no Math.random) so re-running with an
// unchanged spec produces a byte-identical file and an empty git diff.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));

// ── deterministic ids/seeds ───────────────────────────────────────────────────

let counter = 0;
function nextSeed() {
  // xorshift-ish: stable across runs, varied enough that roughjs strokes differ
  counter = (counter * 1103515245 + 12345) & 0x7fffffff;
  return counter;
}
function nextId(prefix) {
  return `${prefix}-${(counter = counter + 1).toString(36).padStart(4, '0')}`;
}
function resetIds() {
  counter = 987654321;
}

// ── element builders ──────────────────────────────────────────────────────────

const BASE = {
  angle: 0,
  fillStyle: 'solid',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
};

const FONT = 5; // Excalifont (hand-drawn)
const LINE_HEIGHT = 1.25;

function textEl({ id, text, x, y, fontSize = 16, color = '#1e1e1e', align = 'left', containerId = null, width, height }) {
  const lines = text.split('\n');
  const w = width ?? Math.max(...lines.map((l) => l.length)) * fontSize * 0.52;
  const h = height ?? lines.length * fontSize * LINE_HEIGHT;
  return {
    ...BASE,
    id,
    type: 'text',
    x,
    y,
    width: w,
    height: h,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    strokeColor: color,
    backgroundColor: 'transparent',
    roundness: null,
    text,
    fontSize,
    fontFamily: FONT,
    textAlign: align,
    verticalAlign: containerId ? 'middle' : 'top',
    containerId,
    originalText: text,
    autoResize: true,
    lineHeight: LINE_HEIGHT,
  };
}

// A rectangle with centered bound text.
function box({ id, x, y, w, h, label, stroke = '#1e1e1e', bg = 'transparent', fontSize = 16, dashed = false, radius = true, fillStyle = 'solid' }) {
  const textId = `${id}-t`;
  const rect = {
    ...BASE,
    id,
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    strokeColor: stroke,
    backgroundColor: bg,
    fillStyle,
    strokeStyle: dashed ? 'dashed' : 'solid',
    roundness: radius ? { type: 3 } : null,
    boundElements: [{ id: textId, type: 'text' }],
  };
  const txt = textEl({
    id: textId,
    text: label,
    x: x + 8,
    y: y + h / 2 - (label.split('\n').length * fontSize * LINE_HEIGHT) / 2,
    fontSize,
    color: stroke,
    align: 'center',
    containerId: id,
    width: w - 16,
  });
  return [rect, txt];
}

// Free-floating heading text (not bound to anything).
function heading({ id, x, y, text, fontSize = 28, color = '#1e1e1e' }) {
  return [textEl({ id, text, x, y, fontSize, color })];
}

function edgeAnchor(a, b) {
  const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  const gap = 6;
  if (Math.abs(dx) * a.height > Math.abs(dy) * a.width) {
    // horizontal
    const sx = dx > 0 ? a.x + a.width + gap : a.x - gap;
    const ex = dx > 0 ? b.x - gap : b.x + b.width + gap;
    return [
      { x: sx, y: ac.y },
      { x: ex, y: bc.y },
    ];
  }
  const sy = dy > 0 ? a.y + a.height + gap : a.y - gap;
  const ey = dy > 0 ? b.y - gap : b.y + b.height + gap;
  return [
    { x: ac.x, y: sy },
    { x: bc.x, y: ey },
  ];
}

function arrow({ id, from, to, stroke = '#1e1e1e', label = null, dashed = false, both = false, curve = 0 }) {
  const [s, e] = edgeAnchor(from, to);
  const pts = curve
    ? [
        [0, 0],
        [(e.x - s.x) / 2 + curve, (e.y - s.y) / 2 + curve],
        [e.x - s.x, e.y - s.y],
      ]
    : [
        [0, 0],
        [e.x - s.x, e.y - s.y],
      ];
  const bound = [];
  const els = [];
  const a = {
    ...BASE,
    id,
    type: 'arrow',
    x: s.x,
    y: s.y,
    width: Math.abs(e.x - s.x),
    height: Math.abs(e.y - s.y),
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    strokeColor: stroke,
    backgroundColor: 'transparent',
    strokeStyle: dashed ? 'dashed' : 'solid',
    roundness: { type: 2 },
    points: pts,
    lastCommittedPoint: null,
    startBinding: { elementId: from.id, focus: 0, gap: 6 },
    endBinding: { elementId: to.id, focus: 0, gap: 6 },
    startArrowhead: both ? 'arrow' : null,
    endArrowhead: 'arrow',
    elbowed: false,
    boundElements: bound,
  };
  els.push(a);
  if (label) {
    const tid = `${id}-t`;
    bound.push({ id: tid, type: 'text' });
    els.push(
      textEl({
        id: tid,
        text: label,
        x: s.x + (e.x - s.x) / 2 - 30,
        y: s.y + (e.y - s.y) / 2 - 10,
        fontSize: 14,
        color: stroke,
        align: 'center',
        containerId: id,
      })
    );
  }
  // record binding on the endpoints
  for (const el of [from, to]) {
    el.boundElements = el.boundElements ?? [];
    el.boundElements.push({ id, type: 'arrow' });
  }
  return els;
}

// A translucent "zone" behind a cluster of boxes.
function zone({ id, x, y, w, h, label, stroke = '#868e96', bg = '#f8f9fa' }) {
  const rect = {
    ...BASE,
    id,
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    strokeColor: stroke,
    backgroundColor: bg,
    fillStyle: 'solid',
    strokeStyle: 'dashed',
    strokeWidth: 1,
    roundness: { type: 3 },
  };
  return [rect, ...heading({ id: `${id}-h`, x: x + 16, y: y + 12, text: label, fontSize: 18, color: stroke })];
}

// ── scene assembly ────────────────────────────────────────────────────────────

function scene(elements) {
  return JSON.stringify(
    {
      type: 'excalidraw',
      version: 2,
      source: 'https://excalidraw.com',
      elements,
      appState: { gridSize: 20, gridStep: 5, gridModeEnabled: false, viewBackgroundColor: '#ffffff' },
      files: {},
    },
    null,
    2
  );
}

function write(name, elements) {
  const file = join(OUT_DIR, name);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(file, scene(elements) + '\n');
  console.log(`wrote ${name} (${elements.length} elements)`);
}

// Layout helper: a vertical stack of boxes inside a column.
function stack({ prefix, x, y, w, gap = 14, h = 46, items, stroke, bg, fontSize = 15 }) {
  const els = [];
  const refs = {};
  items.forEach((item, i) => {
    const label = typeof item === 'string' ? item : item.label;
    const key = typeof item === 'string' ? item : item.key;
    const height = (typeof item === 'object' && item.h) || h;
    const id = `${prefix}-${i}`;
    const made = box({
      id,
      x,
      y: y + i * (h + gap),
      w,
      h: height,
      label,
      stroke: (typeof item === 'object' && item.stroke) || stroke,
      bg: (typeof item === 'object' && item.bg) || bg,
      fontSize,
    });
    els.push(...made);
    refs[key ?? label] = made[0];
  });
  return { els, refs };
}

const C = {
  blue: { stroke: '#1971c2', bg: '#a5d8ff' },
  green: { stroke: '#2f9e44', bg: '#b2f2bb' },
  red: { stroke: '#e03131', bg: '#ffc9c9' },
  yellow: { stroke: '#f08c00', bg: '#ffec99' },
  violet: { stroke: '#9c36b5', bg: '#eebefa' },
  cyan: { stroke: '#0c8599', bg: '#99e9f2' },
  gray: { stroke: '#495057', bg: '#e9ecef' },
  plain: { stroke: '#1e1e1e', bg: 'transparent' },
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. System architecture
// ═══════════════════════════════════════════════════════════════════════════

function systemArchitecture() {
  resetIds();
  const els = [];

  els.push(...heading({ id: 'h', x: 40, y: 20, text: 'Grittt — System Architecture', fontSize: 34 }));
  els.push(
    ...heading({
      id: 'h2',
      x: 42,
      y: 66,
      text: 'Expo/React Native iOS client  ·  Express 5 API  ·  Postgres  ·  OpenAI',
      fontSize: 16,
      color: '#868e96',
    })
  );

  // ── device zone
  els.push(...zone({ id: 'z-device', x: 40, y: 120, w: 400, h: 700, label: 'iOS Device', stroke: '#1971c2', bg: '#e7f5ff' }));

  const app = stack({
    prefix: 'app',
    x: 70,
    y: 170,
    w: 340,
    h: 54,
    gap: 16,
    ...C.blue,
    items: [
      { key: 'router', label: 'expo-router\n(auth) · (tabs) · modals', h: 60 },
      { key: 'auth', label: 'lib/auth.tsx\nAuthProvider · session context' },
      { key: 'api', label: 'lib/api.ts\ntyped fetch client + Bearer token' },
      { key: 'storage', label: 'AsyncStorage\ngrittt_token · user · onboarding' },
      { key: 'hk', label: 'lib/healthKit.ts\n@kingstinct/react-native-healthkit' },
      { key: 'usage', label: 'modules/usage-access\nScreen Time / FamilyControls' },
      { key: 'updates', label: 'expo-updates\nOTA check on every launch' },
    ],
  });
  els.push(...app.els);

  // ── native services (right of device, outside)
  els.push(...zone({ id: 'z-os', x: 480, y: 470, w: 300, h: 350, label: 'Apple OS APIs', stroke: '#0c8599', bg: '#e3fafc' }));
  const os = stack({
    prefix: 'os',
    x: 505,
    y: 520,
    w: 250,
    h: 60,
    gap: 20,
    ...C.cyan,
    items: [
      { key: 'healthkit', label: 'HealthKit\nsteps · HR · sleep · workouts' },
      { key: 'screentime', label: 'FamilyControls\nDeviceActivity authorization' },
      { key: 'appleauth', label: 'Sign in with Apple\nidentity token' },
    ],
  });
  els.push(...os.els);

  // ── server zone
  els.push(...zone({ id: 'z-api', x: 840, y: 120, w: 460, h: 830, label: 'API — Express 5 / Node 20', stroke: '#2f9e44', bg: '#ebfbee' }));

  const mw = box({ id: 'mw', x: 870, y: 170, w: 400, h: 76, label: 'middleware\ncors(credentials) · json 10mb · cookie-parser\nexpress-session (OAuth only) · passport', ...C.green, fontSize: 14 });
  els.push(...mw);

  const jwt = box({ id: 'jwt', x: 870, y: 268, w: 400, h: 50, label: 'middleware/auth.ts — requireAuth (JWT Bearer)', ...C.green, fontSize: 14 });
  els.push(...jwt);

  const routes = box({
    id: 'routes',
    x: 870,
    y: 340,
    w: 400,
    h: 210,
    label:
      'routes/\n\n/api/auth      /api/users     /api/tasks\n/api/habits    /api/strength  /api/fuel\n/api/score     /api/ai        /api/challenges\n/api/onboarding  /api/mirror\n/api/future-mirror   /api/health',
    ...C.green,
    fontSize: 14,
  });
  els.push(...routes);

  const services = box({ id: 'svc', x: 870, y: 578, w: 400, h: 76, label: 'services/\nscore.ts · fuelService.ts · strength.ts\n(scoring + aggregation rules)', ...C.green, fontSize: 14 });
  els.push(...services);

  const dbl = box({ id: 'dbl', x: 870, y: 682, w: 400, h: 66, label: 'db/\npool.ts (pg Pool) · users.ts · identity.ts\nmigrate*.ts (12 migration scripts)', ...C.green, fontSize: 14 });
  els.push(...dbl);

  const ops = box({ id: 'ops', x: 870, y: 778, w: 400, h: 66, label: 'ops endpoints\n/health · /api/version · /api/__deploycheck\nSERVER_VERSION build fingerprint', ...C.gray, fontSize: 14 });
  els.push(...ops);

  const statics = box({ id: 'static', x: 870, y: 870, w: 400, h: 46, label: '/static → public/ (3D models, assets)', ...C.gray, fontSize: 14 });
  els.push(...statics);

  // ── external zone
  els.push(...zone({ id: 'z-ext', x: 1350, y: 120, w: 330, h: 560, label: 'External services', stroke: '#9c36b5', bg: '#f8f0fc' }));
  const ext = stack({
    prefix: 'ext',
    x: 1375,
    y: 170,
    w: 280,
    h: 66,
    gap: 22,
    ...C.violet,
    items: [
      { key: 'openai', label: 'OpenAI\ngpt-4.1-mini\nfood coach · workout · snap-track' },
      { key: 'google', label: 'Google OAuth 2.0\npassport-google-oauth20' },
      { key: 'apple', label: 'Apple ID token verify\njose (JWKS)' },
      { key: 'eas', label: 'Expo EAS\nOTA update channel' },
    ],
  });
  els.push(...ext.els);

  // ── database
  const pg = box({
    id: 'pg',
    x: 1350,
    y: 720,
    w: 330,
    h: 230,
    label:
      'PostgreSQL\n\nusers · user_identity · sessions\ntasks · habit_completions\ndaily_scores · daily_discipline_scores\nworkout_logs · food_logs\nfuel_daily_scores · streak_shields\nbad_day_logs · challenges\nuser_challenges',
    ...C.red,
    fontSize: 14,
  });
  els.push(...pg);

  // ── edges
  els.push(...arrow({ id: 'e1', from: app.refs.api, to: mw[0], stroke: '#1971c2', label: 'HTTPS\nJSON' }));
  els.push(...arrow({ id: 'e2', from: app.refs.hk, to: os.refs.healthkit, stroke: '#0c8599' }));
  els.push(...arrow({ id: 'e3', from: app.refs.usage, to: os.refs.screentime, stroke: '#0c8599' }));
  els.push(...arrow({ id: 'e4', from: app.refs.auth, to: app.refs.storage, stroke: '#1971c2' }));
  els.push(...arrow({ id: 'e5', from: mw[0], to: jwt[0], stroke: '#2f9e44' }));
  els.push(...arrow({ id: 'e6', from: jwt[0], to: routes[0], stroke: '#2f9e44' }));
  els.push(...arrow({ id: 'e7', from: routes[0], to: services[0], stroke: '#2f9e44' }));
  els.push(...arrow({ id: 'e8', from: services[0], to: dbl[0], stroke: '#2f9e44' }));
  els.push(...arrow({ id: 'e9', from: dbl[0], to: pg[0], stroke: '#e03131', label: 'SQL' }));
  els.push(...arrow({ id: 'e10', from: routes[0], to: ext.refs.openai, stroke: '#9c36b5', label: 'chat\ncompletions' }));
  els.push(...arrow({ id: 'e11', from: mw[0], to: ext.refs.google, stroke: '#9c36b5', dashed: true }));
  els.push(...arrow({ id: 'e12', from: jwt[0], to: ext.refs.apple, stroke: '#9c36b5', dashed: true }));
  els.push(...arrow({ id: 'e13', from: app.refs.updates, to: ext.refs.eas, stroke: '#9c36b5', dashed: true }));

  return els;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Feature / screen map
// ═══════════════════════════════════════════════════════════════════════════

function featureMap() {
  resetIds();
  const els = [];
  els.push(...heading({ id: 'h', x: 40, y: 20, text: 'Grittt — Feature & Screen Map', fontSize: 34 }));
  els.push(...heading({ id: 'h2', x: 42, y: 66, text: 'expo-router file tree → what each surface does', fontSize: 16, color: '#868e96' }));

  const root = box({ id: 'root', x: 60, y: 130, w: 260, h: 86, label: 'app/_layout.tsx\nAuthProvider · ThemeContext\nfonts · OTA update check', ...C.gray, fontSize: 14 });
  els.push(...root);

  // auth group
  els.push(...zone({ id: 'z-auth', x: 40, y: 270, w: 300, h: 330, label: 'app/(auth)', stroke: '#1971c2', bg: '#e7f5ff' }));
  const auth = stack({
    prefix: 'auth',
    x: 65,
    y: 320,
    w: 250,
    h: 66,
    gap: 20,
    ...C.blue,
    items: [
      { key: 'login', label: 'login\nemail · Google · Apple' },
      { key: 'signup', label: 'signup\naccount creation' },
      { key: 'onboarding', label: 'onboarding\ngoals · body · habits\nfuel questions step' },
    ],
  });
  els.push(...auth.els);

  // tabs
  els.push(...zone({ id: 'z-tabs', x: 400, y: 130, w: 640, h: 830, label: 'app/(tabs)', stroke: '#2f9e44', bg: '#ebfbee' }));

  const tabsLeft = stack({
    prefix: 'tl',
    x: 430,
    y: 190,
    w: 280,
    h: 74,
    gap: 20,
    ...C.green,
    items: [
      { key: 'index', label: 'index — Today\ndiscipline score · habits\nstreaks · shields · bad day' },
      { key: 'strength', label: 'strength\nworkout logs · leaderboard\nidentity score' },
      { key: 'fuel', label: 'fuel\nfood logs · macros\ndaily fuel score' },
      { key: 'fuelan', label: 'fuel-analysis\nmonthly analysis · AI food\nbreakdown' },
      { key: 'building', label: 'building-you\nprogress over time' },
    ],
  });
  els.push(...tabsLeft.els);

  const tabsRight = stack({
    prefix: 'tr',
    x: 740,
    y: 190,
    w: 280,
    h: 74,
    gap: 20,
    ...C.green,
    items: [
      { key: 'challenges', label: 'challenges\njoin · percentile · repair\nduration stats' },
      { key: 'mirror', label: 'mirror\nidentity reflection\npremium tier' },
      { key: 'ai', label: 'ai\nfood coach · workout\nsnap-track (photo)' },
      { key: 'profile', label: 'profile\naccount · goals · privacy\ndata deletion' },
    ],
  });
  els.push(...tabsRight.els);

  // standalone
  els.push(...zone({ id: 'z-mod', x: 1100, y: 130, w: 300, h: 520, label: 'app/ (stack screens)', stroke: '#f08c00', bg: '#fff9db' }));
  const modals = stack({
    prefix: 'md',
    x: 1125,
    y: 180,
    w: 250,
    h: 58,
    gap: 20,
    ...C.yellow,
    items: [
      { key: 'fq', label: 'fuel-questions\ncatalog · custom · weights' },
      { key: 'ep', label: 'edit-profile' },
      { key: 'fw', label: 'first-win\npost-onboarding hook' },
      { key: 'pp', label: 'privacy-policy' },
      { key: 'nf', label: '+not-found' },
    ],
  });
  els.push(...modals.els);

  // shared components
  els.push(...zone({ id: 'z-comp', x: 1100, y: 700, w: 300, h: 260, label: 'components/', stroke: '#9c36b5', bg: '#f8f0fc' }));
  const comps = box({
    id: 'comps',
    x: 1125,
    y: 750,
    w: 250,
    h: 190,
    label:
      'Gauge · ProgressBar\nHawkEye · DarkBackground\nDaySelector · DateSwipe\nDayCompleteCelebration\nAiAnalysisCard · QuickTrendCard\nMovementGoalCard\nApple/GoogleSignInButton\nUsageAccessGate · theme.ts',
    ...C.violet,
    fontSize: 14,
  });
  els.push(...comps);

  els.push(...arrow({ id: 'f1', from: root[0], to: auth.refs.login, stroke: '#1971c2', label: 'signed out' }));
  els.push(...arrow({ id: 'f2', from: root[0], to: tabsLeft.refs.index, stroke: '#2f9e44', label: 'signed in' }));
  els.push(...arrow({ id: 'f3', from: auth.refs.onboarding, to: modals.refs.fw, stroke: '#f08c00', dashed: true }));
  els.push(...arrow({ id: 'f4', from: tabsRight.refs.profile, to: modals.refs.fq, stroke: '#f08c00', dashed: true }));
  els.push(...arrow({ id: 'f5', from: tabsRight.refs.profile, to: modals.refs.ep, stroke: '#f08c00', dashed: true }));
  els.push(...arrow({ id: 'f6', from: tabsLeft.refs.fuel, to: tabsLeft.refs.fuelan, stroke: '#2f9e44' }));

  return els;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. API surface — routes → services → tables
// ═══════════════════════════════════════════════════════════════════════════

function apiSurface() {
  resetIds();
  const els = [];
  els.push(...heading({ id: 'h', x: 40, y: 20, text: 'Grittt API — Routes → Services → Tables', fontSize: 34 }));
  els.push(
    ...heading({ id: 'h2', x: 42, y: 66, text: 'every route module mounted in src/index.ts, with its endpoints', fontSize: 16, color: '#868e96' })
  );

  els.push(...zone({ id: 'z-r', x: 40, y: 120, w: 520, h: 1180, label: 'routes/', stroke: '#2f9e44', bg: '#ebfbee' }));

  const routes = stack({
    prefix: 'r',
    x: 65,
    y: 175,
    w: 470,
    gap: 16,
    ...C.green,
    fontSize: 13,
    items: [
      { key: 'auth', label: '/api/auth\nsignup · login · logout · me · apple\ngoogle/verify-token · google/callback\ngoogle/mobile (+ /callback, /poll/:session)', h: 96 },
      { key: 'users', label: '/api/users\nme · profile · macro-targets · PATCH me\nonboarding · DELETE me/data · DELETE me', h: 78 },
      { key: 'onboarding', label: '/api/onboarding\nquestions · answers · submit · recommendations', h: 58 },
      { key: 'habits', label: '/api/habits\nhistory · all/status · :name/stats · :name/score\n:name/ranking · :name/completions (GET/POST/DELETE)\ndiscipline/day · discipline/range · score/day\nshields · shields/use · bad-day (POST/DELETE)\nai/weekly-debrief · ai/recovery-nudge · ai/patterns\n:name/ai/analysis', h: 132 },
      { key: 'strength', label: '/api/strength\nsubmit-day · log · logs · history\nidentity · leaderboard', h: 78 },
      { key: 'fuel', label: '/api/fuel\nsubmit-day · log · logs · history · identity\nitems (GET/POST/PUT/DELETE)\nanalysis/monthly · analysis/monthly/food\nquestions/catalog · questions/selection\nquestions/custom · questions/:id (PUT/DELETE)\nquestions/responses (GET/POST) · questions/score\nquestions/:id/history · questions/:id/ai/analysis\nquestions/ai/suggest-weight', h: 160 },
      { key: 'health', label: '/api/health\nmetrics · metrics/sync · scores\nworkouts (GET/POST sync/:id/DELETE)', h: 78 },
      { key: 'challenges', label: '/api/challenges\nlist · create · :id/join (POST/DELETE)\n:id/duration-stats · :id/repair · :id/percentile', h: 78 },
      { key: 'score', label: '/api/score\nsubmit-day', h: 46 },
      { key: 'tasks', label: '/api/tasks\nCRUD', h: 46 },
      { key: 'mirror', label: '/api/mirror\nget · premium', h: 46 },
      { key: 'fm', label: '/api/future-mirror\ngenerate', h: 46 },
      { key: 'ai', label: '/api/ai\nfood-coach · workout · snap-track', h: 58 },
    ],
  });
  els.push(...routes.els);

  els.push(...zone({ id: 'z-s', x: 640, y: 300, w: 330, h: 400, label: 'services/', stroke: '#f08c00', bg: '#fff9db' }));
  const svc = stack({
    prefix: 's',
    x: 665,
    y: 355,
    w: 280,
    h: 90,
    gap: 30,
    ...C.yellow,
    items: [
      { key: 'score', label: 'score.ts\ndaily discipline score\nstreaks · shields · bad-day' },
      { key: 'fuel', label: 'fuelService.ts\nmacro targets · fuel score\nquestion weighting' },
      { key: 'strength', label: 'strength.ts\nworkout scoring\nidentity + leaderboard' },
    ],
  });
  els.push(...svc.els);

  const openai = box({ id: 'oai', x: 665, y: 760, w: 280, h: 90, label: 'OpenAI gpt-4.1-mini\nfood-coach · workout\nsnap-track (vision)', ...C.violet, fontSize: 14 });
  els.push(...openai);

  const dbmod = box({ id: 'dbm', x: 665, y: 900, w: 280, h: 90, label: 'db/\npool.ts · users.ts\nidentity.ts', ...C.red, fontSize: 14 });
  els.push(...dbmod);

  els.push(...zone({ id: 'z-t', x: 1050, y: 200, w: 340, h: 900, label: 'PostgreSQL tables', stroke: '#e03131', bg: '#fff5f5' }));
  const tables = stack({
    prefix: 't',
    x: 1075,
    y: 255,
    w: 290,
    h: 44,
    gap: 14,
    ...C.red,
    fontSize: 14,
    items: [
      'users',
      'user_identity',
      'sessions',
      'tasks',
      'habit_completions',
      'daily_scores',
      'daily_discipline_scores',
      'streak_shields',
      'bad_day_logs',
      'workout_logs',
      'food_logs',
      'fuel_daily_scores',
      'challenges',
      'user_challenges',
    ],
  });
  els.push(...tables.els);

  els.push(...arrow({ id: 'a1', from: routes.refs.habits, to: svc.refs.score, stroke: '#f08c00' }));
  els.push(...arrow({ id: 'a2', from: routes.refs.fuel, to: svc.refs.fuel, stroke: '#f08c00' }));
  els.push(...arrow({ id: 'a3', from: routes.refs.strength, to: svc.refs.strength, stroke: '#f08c00' }));
  els.push(...arrow({ id: 'a4', from: routes.refs.ai, to: openai[0], stroke: '#9c36b5' }));
  els.push(...arrow({ id: 'a5', from: svc.refs.fuel, to: dbmod[0], stroke: '#e03131' }));
  els.push(...arrow({ id: 'a6', from: dbmod[0], to: tables.refs.users, stroke: '#e03131', label: 'pg Pool' }));
  els.push(...arrow({ id: 'a7', from: routes.refs.auth, to: tables.refs.user_identity, stroke: '#e03131', dashed: true }));
  els.push(...arrow({ id: 'a8', from: routes.refs.challenges, to: tables.refs.user_challenges, stroke: '#e03131', dashed: true }));
  els.push(...arrow({ id: 'a9', from: routes.refs.health, to: tables.refs.workout_logs, stroke: '#e03131', dashed: true }));

  return els;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Auth flows
// ═══════════════════════════════════════════════════════════════════════════

function authFlows() {
  resetIds();
  const els = [];
  els.push(...heading({ id: 'h', x: 40, y: 20, text: 'Grittt — Authentication Flows', fontSize: 34 }));
  els.push(...heading({ id: 'h2', x: 42, y: 66, text: 'three entry points, one JWT + user_identity row', fontSize: 16, color: '#868e96' }));

  // lanes
  const laneY = [150, 470, 790];
  const laneTitles = [
    { t: 'A · Email + password', c: '#1971c2', bg: '#e7f5ff' },
    { t: 'B · Google (mobile: browser + poll)', c: '#2f9e44', bg: '#ebfbee' },
    { t: 'C · Sign in with Apple', c: '#9c36b5', bg: '#f8f0fc' },
  ];
  laneTitles.forEach((l, i) => {
    els.push(...zone({ id: `z${i}`, x: 40, y: laneY[i], w: 1560, h: 270, label: l.t, stroke: l.c, bg: l.bg }));
  });

  const rowY = (i) => laneY[i] + 70;

  // Lane A
  const a = stack({
    prefix: 'la',
    x: 70,
    y: rowY(0),
    w: 0,
    items: [],
  });
  els.push(...a.els);
  const aBoxes = [];
  ['login.tsx\nemail + password', 'POST /api/auth/login', 'bcryptjs compare\nusers table', 'sign JWT\njsonwebtoken', 'AsyncStorage\ngrittt_token', 'AuthProvider\n→ (tabs)'].forEach((label, i) => {
    const made = box({ id: `a${i}`, x: 70 + i * 260, y: rowY(0), w: 220, h: 80, label, ...C.blue, fontSize: 14 });
    els.push(...made);
    aBoxes.push(made[0]);
  });
  aBoxes.slice(0, -1).forEach((b, i) => els.push(...arrow({ id: `aa${i}`, from: b, to: aBoxes[i + 1], stroke: '#1971c2' })));

  // Lane B
  const bBoxes = [];
  [
    'GoogleSignInButton\nexpo-web-browser',
    'GET /api/auth/\ngoogle/mobile',
    'Google OAuth 2.0\nconsent',
    'GET google/\nmobile/callback',
    'sessions row\nkeyed by session id',
    'GET google/mobile/\npoll/:session',
    'JWT + user\n→ AsyncStorage',
  ].forEach((label, i) => {
    const made = box({ id: `b${i}`, x: 70 + i * 220, y: rowY(1), w: 190, h: 80, label, ...C.green, fontSize: 13 });
    els.push(...made);
    bBoxes.push(made[0]);
  });
  bBoxes.slice(0, -1).forEach((b, i) => els.push(...arrow({ id: `bb${i}`, from: b, to: bBoxes[i + 1], stroke: '#2f9e44' })));

  // Lane C
  const cBoxes = [];
  [
    'AppleSignInButton\nexpo-apple-authentication',
    'identity token\n+ name (first login only)',
    'POST /api/auth/apple',
    'verify via jose\nApple JWKS',
    'upsert user_identity\nprovider=apple',
    'sign JWT → client',
  ].forEach((label, i) => {
    const made = box({ id: `c${i}`, x: 70 + i * 260, y: rowY(2), w: 220, h: 80, label, ...C.violet, fontSize: 13 });
    els.push(...made);
    cBoxes.push(made[0]);
  });
  cBoxes.slice(0, -1).forEach((b, i) => els.push(...arrow({ id: `cc${i}`, from: b, to: cBoxes[i + 1], stroke: '#9c36b5' })));

  // shared outcome
  const shared = box({
    id: 'shared',
    x: 600,
    y: 1100,
    w: 460,
    h: 120,
    label: 'Every path ends the same way\n\nusers + user_identity row · JWT in AsyncStorage\nrequireAuth reads Bearer token on every /api call',
    ...C.gray,
    fontSize: 15,
  });
  els.push(...shared);
  els.push(...arrow({ id: 'sa', from: aBoxes[aBoxes.length - 1], to: shared[0], stroke: '#868e96', dashed: true }));
  els.push(...arrow({ id: 'sb', from: bBoxes[bBoxes.length - 1], to: shared[0], stroke: '#868e96', dashed: true }));
  els.push(...arrow({ id: 'sc', from: cBoxes[cBoxes.length - 1], to: shared[0], stroke: '#868e96', dashed: true }));

  return els;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Data model
// ═══════════════════════════════════════════════════════════════════════════

function dataModel() {
  resetIds();
  const els = [];
  els.push(...heading({ id: 'h', x: 40, y: 20, text: 'Grittt — Data Model', fontSize: 34 }));
  els.push(...heading({ id: 'h2', x: 42, y: 66, text: 'Postgres tables created by src/db/migrate*.ts', fontSize: 16, color: '#868e96' }));

  const users = box({
    id: 'users',
    x: 560,
    y: 400,
    w: 320,
    h: 200,
    label:
      'users\n\nid · email · name · avatar_url\nage · height_cm · weight_kg\ngoals · priority_mode · coaching_tone\nis_premium · premium_until\nonboarding_done · start_date\nstep_goal · calorie_goal',
    ...C.red,
    fontSize: 14,
  });
  els.push(...users);

  const identity = box({ id: 'ident', x: 150, y: 400, w: 280, h: 110, label: 'user_identity\n\nuser_id · provider (google|apple|local)\nprovider_user_id · email', ...C.blue, fontSize: 13 });
  const sessions = box({ id: 'sess', x: 150, y: 560, w: 280, h: 90, label: 'sessions\n\nOAuth mobile poll handshake', ...C.blue, fontSize: 13 });
  els.push(...identity, ...sessions);

  // habit / discipline cluster
  els.push(...zone({ id: 'z-hab', x: 60, y: 720, w: 640, h: 380, label: 'Discipline', stroke: '#2f9e44', bg: '#ebfbee' }));
  const hab = stack({
    prefix: 'hb',
    x: 90,
    y: 775,
    w: 270,
    h: 100,
    gap: 24,
    ...C.green,
    fontSize: 13,
    items: [
      { key: 'hc', label: 'habit_completions\n\nuser_id · habit_name\ncompleted_on' },
      { key: 'dds', label: 'daily_discipline_scores\n\nuser_id · day · score\ncomponents' },
      { key: 'ds', label: 'daily_scores\n\nuser_id · day\ncombined score' },
    ],
  });
  els.push(...hab.els);
  const hab2 = stack({
    prefix: 'hb2',
    x: 390,
    y: 775,
    w: 270,
    h: 100,
    gap: 24,
    ...C.green,
    fontSize: 13,
    items: [
      { key: 'shield', label: 'streak_shields\n\nuser_id · earned_on\nused_on' },
      { key: 'bad', label: 'bad_day_logs\n\nuser_id · day\nreason' },
      { key: 'tasks', label: 'tasks\n\nuser_id · title\ndone' },
    ],
  });
  els.push(...hab2.els);

  // fuel cluster
  els.push(...zone({ id: 'z-fuel', x: 1020, y: 200, w: 340, h: 400, label: 'Fuel', stroke: '#f08c00', bg: '#fff9db' }));
  const fuel = stack({
    prefix: 'fu',
    x: 1045,
    y: 255,
    w: 290,
    h: 110,
    gap: 26,
    ...C.yellow,
    fontSize: 13,
    items: [
      { key: 'food', label: 'food_logs\n\nuser_id · logged_at · item\ncalories · protein · fat · carbs' },
      { key: 'fds', label: 'fuel_daily_scores\n\nuser_id · day · score\nquestion responses' },
    ],
  });
  els.push(...fuel.els);

  // strength cluster
  els.push(...zone({ id: 'z-str', x: 1020, y: 660, w: 340, h: 230, label: 'Strength / Health', stroke: '#0c8599', bg: '#e3fafc' }));
  const str = box({ id: 'wl', x: 1045, y: 715, w: 290, h: 140, label: 'workout_logs\n\nuser_id · type · duration\ncalories · distance · source\n(manual | HealthKit sync)', ...C.cyan, fontSize: 13 });
  els.push(...str);

  // challenges
  els.push(...zone({ id: 'z-ch', x: 1020, y: 950, w: 340, h: 280, label: 'Challenges', stroke: '#9c36b5', bg: '#f8f0fc' }));
  const ch = stack({
    prefix: 'ch',
    x: 1045,
    y: 1005,
    w: 290,
    h: 96,
    gap: 26,
    ...C.violet,
    fontSize: 13,
    items: [
      { key: 'chal', label: 'challenges\n\nid · name · duration\nrules · created_by' },
      { key: 'uc', label: 'user_challenges\n\nuser_id · challenge_id\njoined_on · progress' },
    ],
  });
  els.push(...ch.els);

  const u = users[0];
  els.push(...arrow({ id: 'd1', from: identity[0], to: u, stroke: '#1971c2', label: 'user_id' }));
  els.push(...arrow({ id: 'd2', from: sessions[0], to: u, stroke: '#1971c2', dashed: true }));
  els.push(...arrow({ id: 'd3', from: u, to: hab.refs.dds, stroke: '#2f9e44' }));
  els.push(...arrow({ id: 'd4', from: u, to: hab2.refs.shield, stroke: '#2f9e44' }));
  els.push(...arrow({ id: 'd5', from: u, to: fuel.refs.food, stroke: '#f08c00' }));
  els.push(...arrow({ id: 'd6', from: u, to: str[0], stroke: '#0c8599' }));
  els.push(...arrow({ id: 'd7', from: u, to: ch.refs.uc, stroke: '#9c36b5' }));
  els.push(...arrow({ id: 'd8', from: ch.refs.chal, to: ch.refs.uc, stroke: '#9c36b5' }));
  els.push(...arrow({ id: 'd9', from: hab.refs.hc, to: hab.refs.dds, stroke: '#2f9e44', dashed: true, label: 'rolls up' }));
  els.push(...arrow({ id: 'd10', from: hab.refs.dds, to: hab.refs.ds, stroke: '#2f9e44', dashed: true }));
  els.push(...arrow({ id: 'd11', from: fuel.refs.food, to: fuel.refs.fds, stroke: '#f08c00', dashed: true, label: 'rolls up' }));

  return els;
}

// ── run ───────────────────────────────────────────────────────────────────────

write('01-system-architecture.excalidraw', systemArchitecture());
write('02-feature-map.excalidraw', featureMap());
write('03-api-surface.excalidraw', apiSurface());
write('04-auth-flows.excalidraw', authFlows());
write('05-data-model.excalidraw', dataModel());
