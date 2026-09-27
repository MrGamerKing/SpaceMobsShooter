/* =========================================================================
   SPACE MOBS SHOOTER — game engine
   Rendering, entities, enemy AI, waves, particles and the main loop.
   The ten bosses live in bosses.js and plug in through the `api` object below.
   ========================================================================= */
const Game = (() => {
  'use strict';

  // ================================================================ utils
  const TAU = Math.PI * 2;
  const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const turnToward = (a, target, max) => {
    let d = target - a;
    d = ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    return a + clamp(d, -max, max);
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  const weighted = (list) => {
    let total = 0;
    for (const [, w] of list) total += w;
    let r = Math.random() * total;
    for (const [name, w] of list) { r -= w; if (r < 0) return name; }
    return list[0][0];
  };
  const compact = (arr) => {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
    arr.length = j;
  };

  // ================================================================ canvas + view
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const FONT = '"Press Start 2P", ui-monospace, monospace';
  // k = size scale, vs = vertical speed scale (keeps screen-crossing time equal on every device)
  const view = { w: 1, h: 1, dpr: 1, k: 1, vs: 1 };
  let camX = 0;
  let camY = 0;

  // ================================================================ palette
  const col = (r, g, b) => { const c = [r, g, b]; c.s = `rgb(${r},${g},${b})`; return c; };
  const C = {
    white: col(255, 255, 255), cyan: col(62, 230, 255), blue: col(80, 140, 255), purple: col(170, 100, 255),
    pink: col(255, 80, 216), gold: col(255, 210, 63), orange: col(255, 140, 40), red: col(255, 60, 80),
    green: col(90, 240, 120), teal: col(25, 210, 190), grey: col(150, 160, 180), smoke: col(46, 50, 70),
  };
  const PAL = {
    zombie: [col(74, 125, 58), col(98, 160, 74), col(45, 80, 35), col(118, 170, 90)],
    skeleton: [col(210, 210, 210), col(165, 165, 165), col(110, 110, 110), col(235, 235, 235)],
    creeper: [col(80, 200, 70), col(40, 130, 40), col(200, 210, 200), col(25, 60, 25), col(110, 220, 90)],
    vex: [col(140, 160, 185), col(220, 235, 250), col(95, 112, 130)],
    evoker: [col(150, 155, 155), col(100, 105, 105), col(50, 110, 60), col(235, 235, 235)],
    warden: [col(20, 90, 100), col(30, 45, 55), col(90, 210, 210), col(12, 18, 24), col(60, 160, 170)],
    wither: [col(38, 38, 38), col(58, 58, 58), col(26, 26, 26), col(143, 176, 255)],
    tnt: [col(230, 70, 40), col(245, 245, 245), col(40, 40, 40), col(255, 160, 60)],
    player: [col(62, 110, 200), col(40, 70, 160), col(200, 200, 210), col(62, 230, 255)],
    blaze: [col(255, 217, 59), col(243, 178, 28), col(224, 120, 15), col(255, 77, 0)],
    ender: [col(22, 22, 22), col(44, 44, 44), col(214, 91, 242), col(155, 31, 192)],
    slime: [col(111, 195, 90), col(143, 224, 122), col(79, 158, 64)],
    ghast: [col(244, 244, 244), col(222, 222, 222), col(140, 140, 140), col(217, 64, 64)],
    shulker: [col(154, 106, 154), col(127, 83, 127), col(232, 224, 154)],
    wskel: [col(60, 60, 60), col(35, 35, 35), col(95, 95, 95)],
    shrieker: [col(15, 58, 63), col(41, 223, 235), col(232, 225, 200)],
    elder: [col(207, 201, 180), col(170, 163, 140), col(192, 122, 60), col(125, 58, 154)],
    guardian: [col(95, 165, 150), col(70, 125, 113), col(210, 123, 51)],
    dragon: [col(27, 27, 31), col(44, 44, 52), col(227, 123, 255), col(163, 58, 214)],
    ravager: [col(110, 109, 103), col(90, 89, 83), col(217, 207, 174), col(61, 32, 32)],
    magma: [col(110, 26, 8), col(166, 51, 16), col(255, 122, 20), col(255, 194, 26), col(30, 7, 3)],
    illusion: [col(44, 79, 158), col(163, 169, 168), col(59, 111, 224)],
    phantom: [col(160, 30, 40), col(90, 20, 30), col(255, 214, 64)],
    crystal: [col(255, 106, 213), col(255, 200, 240), col(170, 100, 255)],
    fire: [col(255, 140, 40), col(255, 210, 63), col(230, 70, 20)],
    acid: [col(200, 80, 255), col(255, 106, 213), col(120, 40, 180)],
    bskull: [col(61, 111, 214), col(90, 140, 240), col(223, 233, 255)],
    gold: [col(255, 210, 63), col(255, 240, 154), col(196, 138, 20), col(63, 212, 107)],
  };
  const MULT_COL = [null, '#ffffff', '#7ff0ff', '#6dff9a', '#ffe066', '#ffab40', '#ff6ad5', '#c78bff', '#ff4d5e'];
  const ZONES = [
    { name: 'VOID OUTSKIRTS', base: '#04050d', neb: [col(50, 70, 210), col(130, 60, 220), col(30, 140, 220)] },
    { name: 'END NEBULA', base: '#07040f', neb: [col(170, 60, 220), col(230, 70, 190), col(90, 50, 200)] },
    { name: 'NETHER RIFT', base: '#0c0406', neb: [col(220, 70, 40), col(255, 120, 40), col(160, 30, 70)] },
    { name: 'THE DEEP DARK', base: '#02080a', neb: [col(20, 160, 150), col(20, 90, 140), col(60, 200, 170)] },
  ];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  // bosses change colour each time they come back (MK II red, MK III gold...)
  const MARK_TINT = [null, null, 'red', 'gold', 'cyan', 'purple'];
  const MARK_GLOW = [null, null, C.red, C.gold, C.cyan, C.purple];

  // ================================================================ game data
  const TYPES = {
    zombie: { img: 'zombie', w: 54, h: 54, hp: 3, score: 100, pal: PAL.zombie, glow: C.green, name: 'ZOMBIE' },
    skeleton: { img: 'skeleton', w: 50, h: 50, hp: 2, score: 150, pal: PAL.skeleton, glow: C.white, name: 'SKELETON' },
    creeper: { img: 'creeper', w: 58, h: 58, hp: 4, score: 200, pal: PAL.creeper, glow: C.green, name: 'CREEPER' },
    vex: { img: 'vex', w: 38, h: 38, hp: 1, score: 120, pal: PAL.vex, glow: C.blue, name: 'VEX' },
    evoker: { img: 'evoker', w: 66, h: 66, hp: 12, score: 500, pal: PAL.evoker, glow: C.purple, name: 'EVOKER' },
    slime: { img: 'slime', w: 64, h: 64, hp: 6, score: 150, pal: PAL.slime, glow: C.green, name: 'SLIME' },
    blaze: { img: 'blaze', w: 52, h: 52, hp: 6, score: 300, pal: PAL.blaze, glow: C.orange, name: 'BLAZE' },
    enderman: { img: 'enderman', w: 50, h: 50, hp: 7, score: 350, pal: PAL.ender, glow: C.purple, name: 'ENDERMAN' },
    shulker: { img: 'shulker', w: 54, h: 54, hp: 9, score: 400, pal: PAL.shulker, glow: C.purple, name: 'SHULKER' },
    ghast: { img: 'ghast', w: 84, h: 84, hp: 16, score: 700, pal: PAL.ghast, glow: C.white, name: 'GHAST' },
    // boss minions
    wskel: { img: 'skeleton', tint: 'shade', w: 54, h: 54, hp: 5, score: 250, pal: PAL.wskel, glow: C.purple, name: 'WITHER SKELETON' },
    shrieker: { img: 'shrieker', w: 44, h: 44, hp: 10, score: 150, pal: PAL.shrieker, glow: C.cyan, name: 'SHRIEKER' },
    guardian: { img: 'guardian', w: 50, h: 50, hp: 5, score: 200, pal: PAL.guardian, glow: C.teal, name: 'GUARDIAN' },
    crystal: { img: 'crystal', w: 42, h: 42, hp: 14, score: 300, pal: PAL.crystal, glow: C.pink, name: 'END CRYSTAL', persist: true },
    magmacube: { img: 'magma', w: 64, h: 64, hp: 6, score: 150, pal: PAL.magma, glow: C.orange, name: 'MAGMA CUBE' },
    illusion: { img: 'illusioner', w: 150, h: 150, hp: 3, score: 60, pal: PAL.illusion, glow: C.blue, name: 'ILLUSION', persist: true, fixedHp: true },
    phantom: { img: 'phantomlord', w: 70, h: 42, hp: 3, score: 150, pal: PAL.phantom, glow: C.red, name: 'PHANTOM' },
  };
  const DEBUT = new Set(['slime', 'blaze', 'enderman', 'shulker', 'ghast']);
  const SLIME_F = [0, 0.45, 0.7, 1];
  const SLIME_HP = [0, 1, 3, 6];
  const SLIME_SCORE = [0, 40, 80, 150];

  // enemy projectiles — hp: can be shot down, homing: turn rate (rad/s)
  const EB = {
    arrow: { r: 5, c: C.white },
    orb: { r: 8, c: C.teal },
    magic: { r: 8, c: C.purple },
    sonic: { r: 12, c: C.teal },
    fire: { r: 9, c: C.orange },
    shard: { r: 6, c: C.orange },
    spike: { r: 6, c: C.orange },
    tear: { r: 7, c: C.blue },
    rock: { r: 12, c: C.grey },
    lavab: { r: 12, c: C.orange },
    dfire: { r: 15, c: C.pink },
    wskull: { r: 11, c: C.purple },
    tnt: { r: 14, c: C.orange, hp: 1 },
    ghastball: { r: 20, c: C.orange, hp: 3 },
    shulk: { r: 9, c: C.white, hp: 1, homing: 2.4, life: 6 },
    hfire: { r: 10, c: C.orange, hp: 1, homing: 1.3, life: 6 },
    bskull: { r: 13, c: C.blue, hp: 2, homing: 1.4, life: 7 },
  };
  const PK = {
    gem: { img: 'gem', c: C.green, ar: 1 },
    potion: { img: 'potion', c: C.gold, ar: 1 },
    booster: { img: 'booster', c: C.purple, ar: 1 },
    shield: { img: 'shield', c: C.cyan, ar: 1 },
    magnet: { img: 'magnet', c: C.red, ar: 1 },
    heart: { img: 'heart', c: C.red, ar: 237 / 280 },
    star: { img: 'star', c: C.gold, ar: 1826 / 1920 },
    clock: { img: 'clock', c: C.cyan, ar: 1 },
    totem: { img: 'totem', c: C.gold, ar: 1 },
    trident: { img: 'trident', c: C.teal, ar: 1 },
    allay: { img: 'allay', c: C.blue, ar: 1 },
  };
  const POWER_POOL = ['booster', 'shield', 'magnet', 'potion', 'clock', 'trident', 'allay'];
  const BUFF_MAX = { overdrive: 8, shield: 10, magnet: 12, double: 12, timewarp: 7, storm: 8, drones: 14, fatigue: 6 };
  const DIFF = {
    easy: { ehp: 0.8, bspd: 0.8, fire: 0.75, score: 0.75 },
    normal: { ehp: 1, bspd: 1, fire: 1, score: 1 },
    hard: { ehp: 1.3, bspd: 1.15, fire: 1.3, score: 1.5 },
  };
  const MAX_HEARTS = 10;
  const WEAPONS = [null,
    { img: 'b1', size: 22, rate: 0.14, c: C.orange },
    { img: 'b2', size: 22, rate: 0.13, c: C.orange },
    { img: 'b3', size: 24, rate: 0.12, c: C.orange },
    { img: 'b4', size: 24, rate: 0.115, c: C.gold },
    { img: 'b4', size: 27, rate: 0.105, c: C.gold },
  ];
  // [x offset, angle] per bullet for each weapon level
  const PATTERNS = [null,
    [[0, 0]],
    [[-9, 0], [9, 0]],
    [[0, 0], [-12, -0.1], [12, 0.1]],
    [[-8, 0], [8, 0], [-18, -0.14], [18, 0.14]],
    [[0, 0], [-10, -0.07], [10, 0.07], [-20, -0.18], [20, 0.18]],
  ];
  const WEAPON_KILLS = [0, 18, 45, 85, 140]; // kills needed before the next weapon star drops
  const COMBO_TIME = 2.6;
  const DASH_CD = 0.9;
  const DASH_TIME = 0.16;

  // ================================================================ assets
  const SRC = {
    player: 'player.png', zombie: 'zombie.png', skeleton: 'skeleton.png', creeper: 'creeper.png', evoker: 'evoker.png',
    vex: 'vex.png', warden: 'warden.png', tnt: 'tnt.png', sonic: 'wardenbullet.png', b1: 'bullet.png', b2: 'upcharge.png',
    b3: 'upcharge3.png', b4: 'upcharge4.png', missile: 'upcharge2.png', star: 'newbullet.png', heart: 'heart.png',
    gem: 'scoreinc.png', potion: 'scoreinc2.png', booster: 'booster.png', space: 'void2.png',
    blaze: 'blaze.png', enderman: 'enderman.png', slime: 'slime.png', ghast: 'ghast.png', shulker: 'shulker.png',
    shrieker: 'shrieker.png', wither: 'wither.png', wskull: 'wskull.png', bskull: 'bskull.png',
    clock: 'clock.png', totem: 'totem.png', trident: 'trident.png', allay: 'allay.png',
    elder: 'elder.png', guardian: 'guardian.png', dragon: 'dragon.png', ravager: 'ravager.png', magma: 'magma.png',
    illusioner: 'illusioner.png', crown: 'crown.png', phantomlord: 'phantomlord.png',
  };
  const IMG = {};
  function load(onProgress) {
    const keys = Object.keys(SRC);
    let done = 0;
    return Promise.all(keys.map((key) => new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        done += 1;
        if (onProgress) onProgress(done / keys.length);
        resolve();
      };
      img.src = SRC[key];
      IMG[key] = img;
    })));
  }

  // ---- sprite cache: every image is pre-scaled once to its exact on-screen size
  const cache = new Map();
  const TINT = { white: '#ffffff', red: '#ff2a3a', cyan: '#3ee6ff', gold: '#ffd23f', purple: '#a36bff' };
  const PAINTERS = { shield: paintShield, magnet: paintMagnet, crystal: paintCrystal };

  function sprite(name, w, h, tint) {
    const pw = Math.max(2, Math.round(w * view.dpr));
    const ph = Math.max(2, Math.round(h * view.dpr));
    const key = `${name}|${pw}|${ph}|${tint || ''}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = pw;
    c.height = ph;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const img = IMG[name];
    if (PAINTERS[name]) {
      PAINTERS[name](g, pw, ph);
    } else if (img && img.naturalWidth) {
      if (name === 'tnt') { roundRect(g, pw * 0.03, ph * 0.03, pw * 0.94, ph * 0.94, pw * 0.12); g.clip(); }
      drawDownscaled(g, img, pw, ph);
    } else {
      g.fillStyle = '#c040ff';
      g.fillRect(0, 0, pw, ph);
    }
    if (tint === 'shade') {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(14,10,22,0.72)';
      g.fillRect(0, 0, pw, ph);
    } else if (tint) {
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = TINT[tint];
      g.fillRect(0, 0, pw, ph);
    }
    cache.set(key, c);
    return c;
  }
  function drawDownscaled(g, img, pw, ph) {
    let src = img;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    while (sw > pw * 2.5 && sh > ph * 2.5) {
      const nw = Math.max(pw, Math.round(sw / 2));
      const nh = Math.max(ph, Math.round(sh / 2));
      const t = document.createElement('canvas');
      t.width = nw;
      t.height = nh;
      const tg = t.getContext('2d');
      tg.imageSmoothingQuality = 'high';
      tg.drawImage(src, 0, 0, nw, nh);
      src = t;
      sw = nw;
      sh = nh;
    }
    g.drawImage(src, 0, 0, pw, ph);
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function paintShield(g, w, h) {
    g.save();
    g.scale(w / 100, h / 100);
    g.beginPath();
    g.moveTo(50, 8); g.lineTo(86, 21); g.lineTo(82, 55);
    g.quadraticCurveTo(74, 82, 50, 94); g.quadraticCurveTo(26, 82, 18, 55);
    g.lineTo(14, 21); g.closePath();
    const f = g.createLinearGradient(0, 8, 0, 94);
    f.addColorStop(0, '#b8fbff');
    f.addColorStop(1, '#1f7fd6');
    g.fillStyle = f;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#eafeff';
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.fillRect(45, 20, 10, 62);
    g.fillRect(26, 40, 48, 10);
    g.restore();
  }
  function paintMagnet(g, w, h) {
    g.save();
    g.scale(w / 100, h / 100);
    g.lineWidth = 22;
    g.strokeStyle = '#ff3b4f';
    g.beginPath();
    g.moveTo(24, 16); g.lineTo(24, 52);
    g.arc(50, 52, 26, Math.PI, 0, true);
    g.lineTo(76, 16);
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.beginPath();
    g.moveTo(18, 22); g.lineTo(18, 52);
    g.arc(50, 52, 32, Math.PI, Math.PI * 0.62, true);
    g.stroke();
    g.fillStyle = '#e6ecf7';
    g.fillRect(13, 6, 22, 16);
    g.fillRect(65, 6, 22, 16);
    g.restore();
  }
  function paintCrystal(g, w, h) {
    // End Crystal: a pink core inside a glass frame
    g.save();
    g.scale(w / 100, h / 100);
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(220,235,255,.85)';
    g.strokeRect(10, 10, 80, 80);
    g.save();
    g.translate(50, 50);
    g.rotate(Math.PI / 4);
    const f = g.createLinearGradient(-26, -26, 26, 26);
    f.addColorStop(0, '#ffd0f4');
    f.addColorStop(0.5, '#ff6ad5');
    f.addColorStop(1, '#8a2be2');
    g.fillStyle = f;
    g.fillRect(-26, -26, 52, 52);
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.fillRect(-10, -10, 20, 20);
    g.restore();
    g.restore();
  }

  // ---- glow textures (cached on the color array itself)
  function glowTex(c) {
    if (c.g) return c.g;
    const t = document.createElement('canvas');
    t.width = t.height = 64;
    const g = t.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(c, 1));
    gr.addColorStop(0.18, rgba(c, 0.65));
    gr.addColorStop(0.45, rgba(c, 0.2));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    c.g = t;
    return t;
  }
  function softTex(c) {
    if (c.n) return c.n;
    const t = document.createElement('canvas');
    t.width = t.height = 128;
    const g = t.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(c, 0.8));
    gr.addColorStop(0.35, rgba(c, 0.4));
    gr.addColorStop(0.7, rgba(c, 0.1));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    c.n = t;
    return t;
  }
  function orbTex(c) {
    if (c.o) return c.o;
    const t = document.createElement('canvas');
    t.width = t.height = 32;
    const g = t.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.32, '#ffffff');
    gr.addColorStop(0.52, rgba(c, 1));
    gr.addColorStop(0.8, rgba(c, 0.45));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    c.o = t;
    return t;
  }

  // ---- draw helpers (every helper sets its own transform, including camera shake)
  function at(x, y, sx = 1, sy = 1, rot = 0) {
    const d = view.dpr;
    if (rot) {
      const cs = Math.cos(rot);
      const sn = Math.sin(rot);
      ctx.setTransform(d * cs * sx, d * sn * sx, -d * sn * sy, d * cs * sy, d * (x + camX), d * (y + camY));
    } else {
      ctx.setTransform(d * sx, 0, 0, d * sy, d * (x + camX), d * (y + camY));
    }
  }
  function blit(c, x, y, w, h, rot, sx, sy) {
    at(x, y, sx, sy, rot);
    ctx.drawImage(c, -w / 2, -h / 2, w, h);
  }
  function glow(c, x, y, r, a) {
    if (r <= 0 || a <= 0) return;
    ctx.globalAlpha = Math.min(1, a);
    at(x, y);
    ctx.drawImage(glowTex(c), -r, -r, r * 2, r * 2);
  }
  function world() {
    const d = view.dpr;
    ctx.setTransform(d, 0, 0, d, d * camX, d * camY);
  }

  // ================================================================ state
  let state = 'loading'; // loading | menu | playing | paused | dying | over
  let player = null;
  const enemies = [];
  const bullets = [];
  const ebullets = [];
  const pickups = [];
  const hazards = [];
  const parts = [];
  const pool = [];
  const popups = [];
  const ghosts = [];
  const decor = [];
  const meteors = [];
  const bolts = [];
  const drones = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  let score = 0;
  let combo = 0;
  let comboT = 0;
  let lastMult = 1;
  let nova = 0;
  let novaReadyShown = false;
  let novaLock = 0;     // > 0 while the Nova is doing damage — those kills never recharge it
  const buffs = { overdrive: 0, shield: 0, magnet: 0, double: 0, timewarp: 0, storm: 0, drones: 0 };
  const debuffs = { fatigue: 0 };
  let stats = null;
  const wave = { n: 0, cycle: 0, boss: false, state: 'clear', breakT: 0, spawned: 0, budget: 0, cleared: 0, timer: 0, interval: 1, hpMul: 1, spdMul: 1, fireMul: 1, hurt: false, bossT: 0 };
  let diff = DIFF.normal;
  let diffKey = 'normal';
  let heartMul = 1;
  let boss = null;
  let bossLevel = 0;
  let BK = null;        // boss definitions from bosses.js
  let novaFx = null;
  let novaId = 0;
  let starOut = false;
  let totemOut = false;
  let seen = new Set();
  let time = 0;
  let runTime = 0;
  let trauma = 0;
  let hitstop = 0;
  let slowT = 0;
  let slowScale = 1;
  let dieT = 0;
  let ets = 1;          // enemy time scale (Time Warp)
  let dark = 0;         // darkness / blindness intensity
  let darkT = 0;
  let stormT = 0;
  let droneA = 0;
  let droneFire = 0;
  let tickT = 0;
  let hbT = 0;
  let blastDepth = 0;
  let blastKills = 0;
  let fps = 60;
  let fpsAcc = 0;
  let fpsFrames = 0;
  let engineAcc = 0;
  let hiQ = true;
  let maxParts = 1400;
  let godMode = false;
  let lastT = 0;
  const hud = {
    score: 0, combo: 0, mult: 1, comboT: 0, hp: 5, maxHp: 5, weapon: 1, power: 1, nova: 0, dash: 1, wave: 0, buffs, debuffs,
    boss: -1, bossPhase: 1, bossArmor: false, alive: true, fps: 60, totem: false, waveProg: -1,
  };

  // ================================================================ resize
  function resize() {
    hiQ = Settings.get('quality') === 'high';
    maxParts = hiQ ? 1400 : 450;
    const w = window.innerWidth;
    const h = window.innerHeight;
    view.w = w;
    view.h = h;
    view.dpr = Math.min(window.devicePixelRatio || 1, hiQ ? 2 : 1.25);
    view.k = clamp(Math.min(w, h) / 720, 0.55, 1.25);
    view.vs = clamp(h / 900, 0.6, 1.4);
    canvas.width = Math.round(w * view.dpr);
    canvas.height = Math.round(h * view.dpr);
    cache.clear();
    initBackground();
    if (player) {
      player.w = 96 * view.k;
      player.h = player.w * (197 / 331);
      player.r = Math.max(4, 6.5 * view.k);
      clampPlayer();
    }
    if (state === 'paused') render();
  }

  // ================================================================ background
  const bg = { stars: [], neb: [], scroll: 0, warp: 0, warpT: 0, zone: 0, from: 0, mix: 1, meteorT: 3 };
  const STAR_COLS = ['#ffffff', '#d2e4ff', '#a8c8ff', '#ffe9c9', '#ffc9f0'];

  function initBackground() {
    const n = Math.round((view.w * view.h) / (hiQ ? 4200 : 9000));
    bg.stars = [];
    for (let i = 0; i < n; i++) {
      const z = Math.random();
      bg.stars.push({ x: rand(view.w), y: rand(view.h), z, s: 0.7 + z * z * 2.3, tw: rand(TAU), c: STAR_COLS[i % STAR_COLS.length] });
    }
    bg.stars.sort((a, b) => (a.c < b.c ? -1 : a.c > b.c ? 1 : 0));
    bg.neb = [];
    for (let i = 0; i < 5; i++) {
      bg.neb.push({ x: rand(view.w), y: rand(-0.2, 1.1) * view.h, r: rand(0.35, 0.7) * Math.max(view.w, view.h), ci: i % 3, sp: rand(5, 14), a: rand(0.16, 0.3) });
    }
  }
  function setZone(i) {
    if (i === bg.zone) return;
    bg.from = bg.zone;
    bg.zone = i;
    bg.mix = 0;
  }
  function updateBackground(dt) {
    bg.warpT = Math.max(0, bg.warpT - dt);
    const want = bg.warpT > 0 || (buffs.overdrive > 0 && state === 'playing') ? 1 : 0;
    bg.warp = damp(bg.warp, want, want ? 4 : 2.5, dt);
    bg.mix = Math.min(1, bg.mix + dt * 0.4);
    const spd = (1 + bg.warp * 7) * (0.35 + 0.65 * ets);
    bg.scroll += 14 * view.vs * spd * dt;
    for (const s of bg.stars) {
      s.y += (16 + s.z * s.z * 150) * view.vs * spd * dt;
      if (s.y > view.h + 20) { s.y -= view.h + 40; s.x = rand(view.w); }
    }
    for (const n of bg.neb) {
      n.y += n.sp * view.vs * (1 + bg.warp * 3) * dt;
      if (n.y - n.r > view.h) { n.y = -n.r; n.x = rand(view.w); n.ci = randi(0, 2); }
    }
    bg.meteorT -= dt;
    if (bg.meteorT <= 0) {
      bg.meteorT = rand(2.5, 6);
      const left = Math.random() < 0.5;
      meteors.push({ x: left ? rand(-50, view.w * 0.5) : rand(view.w * 0.5, view.w + 50), y: rand(-40, view.h * 0.4), vx: (left ? 1 : -1) * rand(500, 800) * view.k, vy: rand(250, 420) * view.k, life: rand(0.6, 1), len: rand(80, 160) * view.k, dead: false });
    }
    for (const m of meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
      if (m.life <= 0) m.dead = true;
    }
    compact(meteors);
  }
  function drawBackground() {
    const d = view.dpr;
    const W = view.w;
    const H = view.h;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = ZONES[bg.zone].base;
    ctx.fillRect(0, 0, W, H);

    // star texture: alternating mirrored tiles make the vertical loop seamless
    const tex = IMG.space;
    if (tex && tex.naturalWidth) {
      const tw = tex.naturalWidth;
      const th = tex.naturalHeight - 14; // skip the watermark strip at the bottom of the image
      const s = Math.max(W / tw, H / th);
      const iw = tw * s;
      const ih = th * s;
      const x0 = (W - iw) / 2;
      const y = bg.scroll % (ih * 2);
      ctx.globalAlpha = 0.42;
      for (let i = 0, ty = y - 2 * ih; ty < H; i++, ty += ih) {
        if (ty + ih <= 0) continue;
        if (i % 2 === 0) ctx.setTransform(d, 0, 0, d, 0, d * ty);
        else ctx.setTransform(d, 0, 0, -d, 0, d * (ty + ih));
        ctx.drawImage(tex, 0, 0, tw, th, x0, 0, iw, ih);
      }
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    // nebula clouds (cross-fade between zones)
    ctx.globalCompositeOperation = 'lighter';
    const Z = ZONES[bg.zone];
    const F = ZONES[bg.from];
    for (const n of bg.neb) {
      if (bg.mix < 1) {
        ctx.globalAlpha = n.a * (1 - bg.mix);
        ctx.drawImage(softTex(F.neb[n.ci]), n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      }
      ctx.globalAlpha = n.a * bg.mix;
      ctx.drawImage(softTex(Z.neb[n.ci]), n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }

    // parallax stars (streak into warp lines when boosting)
    const warp = bg.warp > 0.04;
    let cur = '';
    ctx.lineCap = 'round';
    for (const s of bg.stars) {
      if (s.c !== cur) { cur = s.c; ctx.fillStyle = cur; ctx.strokeStyle = cur; }
      ctx.globalAlpha = (0.3 + 0.7 * s.z) * (0.65 + 0.35 * Math.sin(time * 2.2 + s.tw));
      if (warp) {
        ctx.lineWidth = s.s * 0.8;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y - (4 + s.z * 70) * bg.warp * view.vs);
        ctx.stroke();
      } else {
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
    }

    // shooting stars
    ctx.lineWidth = 2;
    for (const m of meteors) {
      const a = Math.min(1, m.life * 2);
      const sp = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / sp) * m.len;
      const ty = m.y - (m.vy / sp) * m.len;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ================================================================ menu decor
  const DECOR = ['zombie', 'skeleton', 'creeper', 'vex', 'evoker', 'player', 'blaze', 'slime', 'enderman', 'ghast', 'shulker', 'magma', 'guardian'];
  function updateDecor(dt) {
    if (decor.length < 10 && Math.random() < dt * 1.3) {
      const nm = pick(DECOR);
      const s = pick([30, 42, 56]) * view.k;
      decor.push({ nm, x: rand(view.w), y: -s, s, vy: rand(18, 50) * view.vs * (s / (56 * view.k)), rot: rand(TAU), vr: rand(-0.5, 0.5), a: rand(0.18, 0.4), dead: false });
    }
    for (const d of decor) {
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      if (d.y > view.h + d.s * 2) d.dead = true;
    }
    compact(decor);
  }
  function drawDecor() {
    for (const d of decor) {
      const w = d.nm === 'player' ? d.s * 1.68 : d.s;
      ctx.globalAlpha = d.a;
      blit(sprite(d.nm, w, d.s), d.x, d.y, w, d.s, d.rot);
    }
    ctx.globalAlpha = 1;
  }

  // ================================================================ particles
  const SPARK = 0;
  const CUBE = 1;
  const GLOW = 2;
  const RING = 3;
  const SMOKE = 4;
  const SHARD = 5;

  function P(x, y, vx, vy, life, size, c, kind, drag = 3, grav = 0) {
    if (parts.length >= maxParts) return null;
    const p = pool.pop() || {};
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.c = c; p.kind = kind;
    p.rot = Math.random() * TAU; p.vr = rand(-10, 10); p.drag = drag; p.grav = grav;
    p.img = null;
    parts.push(p);
    return p;
  }
  function spark(x, y, c, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const sp = rand(120, 360) * view.k;
      P(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.12, 0.25), rand(1.4, 2.4) * view.k, c, SPARK, 4);
    }
  }
  function burst(x, y, c, n, speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const sp = rand(0.3, 1) * speed * view.k;
      P(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.6), rand(6, 11) * view.k, c, GLOW, 3);
    }
  }
  function explode(x, y, pal, s = 1, gc = C.orange) {
    const k = view.k;
    const q = hiQ ? 1 : 0.45;
    P(x, y, 0, 0, 0.22, 60 * k * s, C.white, GLOW);
    P(x, y, 0, 0, 0.36, 90 * k * s, gc, GLOW);
    P(x, y, 0, 0, 0.45, 80 * k * s, gc, RING);
    const nc = Math.round((10 + 10 * s) * q);
    for (let i = 0; i < nc; i++) {
      const a = rand(TAU);
      const sp = rand(60, 340) * k * Math.sqrt(s);
      P(x + rand(-8, 8) * k, y + rand(-8, 8) * k, Math.cos(a) * sp, Math.sin(a) * sp - 40 * k, rand(0.5, 1.1), rand(4, 9) * k * Math.min(1.6, Math.sqrt(s)), pick(pal), CUBE, 2.2, 260 * k);
    }
    const ns = Math.round((8 + 8 * s) * q);
    for (let i = 0; i < ns; i++) {
      const a = rand(TAU);
      const sp = rand(200, 650) * k * Math.sqrt(s);
      P(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.18, 0.42), rand(1.5, 3) * k, i % 2 ? gc : C.gold, SPARK, 4);
    }
    if (hiQ) {
      for (let i = 0; i < 3; i++) {
        P(x + rand(-10, 10) * k, y + rand(-10, 10) * k, rand(-30, 30) * k, rand(-30, 10) * k, rand(0.6, 1), 30 * k * s, C.smoke, SMOKE, 1.5);
      }
    }
  }
  /** Break a mob's sprite into tumbling pieces. */
  function shatter(e) {
    const c = sprite(e.T.img, e.w, e.h, e.T.tint);
    const n = hiQ ? 3 : 2;
    const cw = e.w / n;
    const ch = e.h / n;
    const sw = c.width / n;
    const sh = c.height / n;
    const k = view.k;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const ox = (i + 0.5) * cw - e.w / 2;
        const oy = (j + 0.5) * ch - e.h / 2;
        const a = Math.atan2(oy, ox) + rand(-0.3, 0.3);
        const sp = rand(140, 320) * k;
        const p = P(e.x + ox, e.y + oy, Math.cos(a) * sp, Math.sin(a) * sp - rand(60, 160) * k, rand(0.7, 1.1), cw, C.white, SHARD, 1.2, 700 * k);
        if (!p) return;
        p.img = c;
        p.sx = i * sw;
        p.sy = j * sh;
        p.sw = sw;
        p.sh = sh;
        p.ph = ch;
        p.vr = rand(-9, 9);
      }
    }
  }
  function updateParticles(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.img = null;
        pool.push(p);
        parts[i] = parts[parts.length - 1];
        parts.pop();
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }
  function drawParticles() {
    ctx.globalCompositeOperation = 'source-over';
    for (const p of parts) {
      if (p.kind === CUBE) {
        const t = p.life / p.max;
        const s = p.size * (t < 0.35 ? t / 0.35 : 1);
        ctx.globalAlpha = Math.min(1, t * 2.5);
        at(p.x, p.y, 1, 1, p.rot);
        ctx.fillStyle = p.c.s;
        ctx.fillRect(-s / 2, -s / 2, s, s);
      } else if (p.kind === SHARD) {
        const t = p.life / p.max;
        ctx.globalAlpha = t < 0.3 ? t / 0.3 : 1;
        at(p.x, p.y, 1, 1, p.rot);
        ctx.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, -p.size / 2, -p.ph / 2, p.size, p.ph);
      } else if (p.kind === SMOKE) {
        const t = p.life / p.max;
        const r = p.size * (1.6 - t * 0.8);
        ctx.globalAlpha = t * 0.3;
        at(p.x, p.y);
        ctx.drawImage(glowTex(p.c), -r, -r, r * 2, r * 2);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of parts) {
      const t = p.life / p.max;
      if (p.kind === GLOW) {
        const r = p.size * (0.4 + 0.6 * t);
        ctx.globalAlpha = t;
        at(p.x, p.y);
        ctx.drawImage(glowTex(p.c), -r, -r, r * 2, r * 2);
      } else if (p.kind === SPARK) {
        ctx.globalAlpha = t;
        world();
        ctx.strokeStyle = p.c.s;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === RING) {
        ctx.globalAlpha = t * 0.9;
        world();
        ctx.strokeStyle = p.c.s;
        ctx.lineWidth = Math.max(0.5, 5 * view.k * t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.size * easeOutCubic(1 - t)), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ---- lightning bolts (Trident storm)
  function bolt(x0, y0, x1, y1) {
    const pts = [];
    const segs = 9;
    const k = view.k;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const j = i && i < segs ? rand(-20, 20) * k : 0;
      pts.push(lerp(x0, x1, u) + j, lerp(y0, y1, u));
    }
    bolts.push({ pts, life: 0.24, max: 0.24, dead: false });
  }
  function updateBolts(dt) {
    for (const b of bolts) { b.life -= dt; if (b.life <= 0) b.dead = true; }
    compact(bolts);
  }
  function drawBolts() {
    if (!bolts.length) return;
    const k = view.k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    world();
    for (const b of bolts) {
      const a = b.life / b.max;
      for (const [w, style] of [[9 * k, `rgba(90,200,255,${0.35 * a})`], [3 * k, `rgba(255,255,255,${a})`]]) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = style;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(b.pts[0], b.pts[1]);
        for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ---- hazards: acid clouds, lava pools, evoker fangs (they warn first, then hurt)
  function addHazard(kind, x, y, r, life, warn = 0) {
    hazards.push({ kind, x, y, r, life, max: life, warn, warnMax: warn, t: 0, dead: false });
  }
  function updateHazards(dt) {
    const p = player;
    const k = view.k;
    for (const h of hazards) {
      h.t += dt;
      if (h.warn > 0) { h.warn -= dt; continue; }
      h.life -= dt;
      if (h.life <= 0) { h.dead = true; continue; }
      if (hiQ && h.kind !== 'fang' && Math.random() < dt * 10) {
        P(h.x + rand(-0.7, 0.7) * h.r, h.y + rand(-0.4, 0.4) * h.r, 0, -rand(20, 60) * k, rand(0.4, 0.8), rand(6, 12) * k, h.kind === 'acid' ? pick([C.purple, C.pink]) : pick([C.orange, C.gold]), GLOW, 1);
      }
      if (p && p.alive && p.intro === 0) {
        const dx = (p.x - h.x) / h.r;
        const dy = (p.y - h.y) / (h.r * (h.kind === 'fang' ? 1 : 0.7));
        if (dx * dx + dy * dy < 1) hurtPlayer();
      }
    }
    compact(hazards);
  }
  function drawHazards() {
    const k = view.k;
    for (const h of hazards) {
      const c = h.kind === 'acid' ? C.purple : h.kind === 'lava' ? C.orange : C.white;
      world();
      if (h.warn > 0) {
        const u = 1 - h.warn / Math.max(0.01, h.warnMax);
        ctx.globalAlpha = 0.35 + 0.5 * (Math.sin(h.t * 25) > 0 ? 1 : 0.4);
        ctx.strokeStyle = h.kind === 'fang' ? '#ff4d5e' : c.s;
        ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r * (0.4 + 0.6 * u), h.r * (h.kind === 'fang' ? 1 : 0.7) * (0.4 + 0.6 * u), 0, 0, TAU);
        ctx.stroke();
        continue;
      }
      const fade = Math.min(1, h.life / 0.4, (h.max - h.life) / 0.15 + 0.2);
      if (h.kind === 'fang') {
        // evoker fangs snap up out of the floor
        const up = Math.min(1, (h.max - h.life) / 0.08);
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#e8e2cf';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(h.x + i * h.r * 0.6 - h.r * 0.28, h.y + h.r * 0.5);
          ctx.lineTo(h.x + i * h.r * 0.6, h.y + h.r * 0.5 - h.r * 1.4 * up);
          ctx.lineTo(h.x + i * h.r * 0.6 + h.r * 0.28, h.y + h.r * 0.5);
          ctx.closePath();
          ctx.fill();
        }
        continue;
      }
      ctx.globalCompositeOperation = 'lighter';
      glow(c, h.x, h.y, h.r * 1.5, 0.55 * fade);
      ctx.globalCompositeOperation = 'source-over';
      world();
      ctx.globalAlpha = 0.45 * fade;
      ctx.fillStyle = h.kind === 'acid' ? '#7a2cb8' : '#b8360c';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r * (1 + Math.sin(h.t * 4) * 0.05), h.r * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.7 * fade;
      ctx.strokeStyle = h.kind === 'acid' ? '#ff6ad5' : '#ffc21a';
      ctx.lineWidth = 2 * k;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- floating text
  function popup(x, y, text, color = '#fff', size = 10, life = 0.9) {
    if (popups.length > 40) popups.shift();
    popups.push({ x, y, text, color, size: Math.round(size * clamp(view.k * 1.1, 0.8, 1.3)), life, max: life, vy: -55 * view.k, dead: false });
  }
  function updatePopups(dt) {
    for (const p of popups) {
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy *= Math.exp(-2.5 * dt);
      if (p.life <= 0) p.dead = true;
    }
    compact(popups);
  }
  function drawPopups() {
    const d = view.dpr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of popups) {
      const age = p.max - p.life;
      const t = p.life / p.max;
      const sc = age < 0.14 ? Math.max(0.01, easeOutBack(age / 0.14)) : 1;
      ctx.globalAlpha = t < 0.3 ? t / 0.3 : 1;
      ctx.setTransform(d * sc, 0, 0, d * sc, d * (p.x + camX), d * (p.y + camY));
      ctx.font = `${p.size}px ${FONT}`;
      ctx.lineWidth = Math.max(3, p.size * 0.4);
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
    }
    ctx.globalAlpha = 1;
  }

  // ---- screen feel + scoring
  const shake = (a) => { trauma = Math.min(1, trauma + a); };
  const slowmo = (dur, scale) => { slowT = Math.max(slowT, dur); slowScale = scale; };
  /** Every point goes through here so difficulty, hearts bonus and 2x-score apply everywhere. */
  function addScore(v) {
    const s = Math.round(v * diff.score * heartMul * (buffs.double > 0 ? 2 : 1));
    score += s;
    return s;
  }

  // ================================================================ player
  function makePlayer(hearts) {
    const w = 96 * view.k;
    return {
      x: view.w / 2, y: view.h + w, w, h: w * (197 / 331), r: Math.max(4, 6.5 * view.k),
      vx: 0, vy: 0, tilt: 0, hp: hearts, maxHp: hearts, invuln: 0, weapon: 1, power: 1, fireT: 0.3,
      dashT: 0, dashCd: 0, dvx: 0, dvy: 0, knockT: 0, kvx: 0, kvy: 0, ghostT: 0, recoil: 0, alive: true, volley: 0, intro: 1, totem: false,
    };
  }
  function bounds() {
    const p = player;
    const mx = p ? p.w * 0.35 : 30;
    const my = p ? p.h * 0.55 : 30;
    return { minX: mx, maxX: view.w - mx, minY: view.h * 0.2, maxY: view.h - my - 4 };
  }
  function clampPlayer() {
    if (player.intro > 0) return;
    const b = bounds();
    player.x = clamp(player.x, b.minX, b.maxX);
    player.y = clamp(player.y, b.minY, b.maxY);
  }
  const maxSpeed = () => 0.62 * Math.sqrt(view.w * view.h);

  function updatePlayer(dt) {
    const p = player;
    if (!p.alive) return;
    const k = view.k;
    const tired = debuffs.fatigue > 0;
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.recoil = Math.max(0, p.recoil - dt * 8);

    if (p.intro > 0) {
      // warp-in: fly up from below the screen
      p.intro = Math.max(0, p.intro - dt * 0.9);
      p.y = lerp(view.h + p.h, view.h * 0.78, easeOutCubic(1 - p.intro));
      p.x = damp(p.x, view.w / 2, 6, dt);
      if (p.intro === 0) Input.rebase();
    } else if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dvx * dt;
      p.y += p.dvy * dt;
      p.ghostT -= dt;
      if (p.ghostT <= 0) { p.ghostT = 0.018; ghosts.push({ x: p.x, y: p.y, rot: p.tilt * 0.28, a: 0.55, dead: false }); }
      if (p.dashT <= 0) { p.vx = p.dvx * 0.25; p.vy = p.dvy * 0.25; Input.rebase(); }
    } else if (p.knockT > 0) {
      // shoved by a boss roar
      p.knockT -= dt;
      p.x += p.kvx * dt;
      p.y += p.kvy * dt;
      p.kvx *= Math.exp(-5 * dt);
      p.kvy *= Math.exp(-5 * dt);
      if (p.knockT <= 0) Input.rebase();
    } else {
      const t = Input.target;
      if (t) {
        // direct steering (touch drag / mouse): smooth but near-instant follow
        const rate = tired ? 6 : 26;
        const nx = damp(p.x, t.x, rate, dt);
        const ny = damp(p.y, t.y, rate, dt);
        p.vx = (nx - p.x) / dt;
        p.vy = (ny - p.y) / dt;
        p.x = nx;
        p.y = ny;
      } else {
        // analog steering (keys / stick / pad) with acceleration + friction
        const ms = maxSpeed() * (buffs.overdrive > 0 ? 1.25 : 1) * (tired ? 0.55 : 1);
        const ix = Input.x;
        const iy = Input.y;
        p.vx = damp(p.vx, ix * ms, ix ? 14 : 10, dt);
        p.vy = damp(p.vy, iy * ms, iy ? 14 : 10, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    if (p.intro === 0) {
      const b = bounds();
      if (p.x < b.minX || p.x > b.maxX) { p.x = clamp(p.x, b.minX, b.maxX); p.vx = 0; }
      if (p.y < b.minY || p.y > b.maxY) { p.y = clamp(p.y, b.minY, b.maxY); p.vy = 0; }
    }
    p.tilt = damp(p.tilt, clamp(p.vx / maxSpeed(), -1, 1), 10, dt);

    // soul-fire engine trail
    const od = buffs.overdrive > 0;
    engineAcc += dt * (hiQ ? 70 : 28) * (od ? 1.6 : 1);
    while (engineAcc >= 1) {
      engineAcc -= 1;
      P(p.x + rand(-4, 4) * k, p.y + p.h * 0.38, rand(-25, 25) * k - p.vx * 0.1, rand(170, 280) * view.vs, rand(0.16, 0.3), rand(5, 10) * k, od ? pick([C.purple, C.pink]) : pick([C.cyan, C.blue]), GLOW, 2);
    }
    if (p.totem && hiQ && Math.random() < dt * 5) P(p.x + rand(-0.4, 0.4) * p.w, p.y + rand(-0.3, 0.3) * p.h, 0, -40 * k, 0.6, 7 * k, C.gold, GLOW, 1);
    if (tired && hiQ && Math.random() < dt * 8) P(p.x + rand(-0.4, 0.4) * p.w, p.y, 0, 30 * k, 0.6, 8 * k, C.purple, GLOW, 1);

    // shooting
    p.fireT -= dt;
    if (p.fireT < -0.1) p.fireT = 0;
    const wantFire = Settings.get('autoFire') || Input.firing;
    if (wantFire && p.intro === 0 && p.fireT <= 0) {
      fire();
      p.fireT += WEAPONS[p.weapon].rate * (od ? 0.55 : 1) * (tired ? 1.6 : 1);
    }
  }

  function fire() {
    const p = player;
    const lv = p.weapon;
    const wp = WEAPONS[lv];
    const k = view.k;
    const od = buffs.overdrive > 0;
    const sp = 1150 * view.vs;
    const x = p.x;
    const y = p.y - p.h * 0.42;
    const size = wp.size * k * (od ? 1.25 : 1);
    const c = sprite(wp.img, size, size);
    const dmg = (od ? 1.5 : 1) * p.power;
    for (const [dx, ang] of PATTERNS[lv]) {
      bullets.push({ x: x + dx * k, y, vx: Math.sin(ang) * sp, vy: -Math.cos(ang) * sp, r: size * 0.42, s: size, c, col: wp.c, dmg, pierce: od ? 1 : 0, rot: rand(TAU), spin: rand(8, 14), life: 1.6, homing: false, src: 'bullet', last: null, dead: false });
    }
    if (lv >= 5 && p.volley++ % 3 === 0) {
      missile(x - p.w * 0.34, y + p.h * 0.35, -1);
      missile(x + p.w * 0.34, y + p.h * 0.35, 1);
      Sfx.play('missile');
    }
    P(x, y, 0, 0, 0.07, 22 * k, wp.c, GLOW);
    p.recoil = 1;
    Sfx.play('shoot', lv);
  }
  function missile(x, y, side) {
    const k = view.k;
    const s = 26 * k;
    bullets.push({ x, y, vx: side * 280 * k, vy: -160 * view.vs, r: 10 * k, s, c: sprite('missile', s, s), col: C.green, dmg: 2 * player.power, pierce: 0, rot: 0, spin: 0, life: 2.4, homing: true, turn: 7, speed: 900 * view.vs, trail: 0, src: 'missile', last: null, dead: false });
  }

  function tryDash(fx, fy) {
    const p = player;
    if (!p || !p.alive || p.intro > 0 || p.dashCd > 0 || p.dashT > 0) return;
    let dx = fx;
    let dy = fy;
    if (dx == null) {
      if (Input.x || Input.y) { dx = Input.x; dy = Input.y; }
      else if (Math.hypot(p.vx, p.vy) > 60 * view.k) { dx = p.vx; dy = p.vy; }
      else { dx = 0; dy = -1; }
    }
    const m = Math.hypot(dx, dy) || 1;
    dx /= m;
    dy /= m;
    const sp = 1500 * view.k;
    p.dvx = dx * sp;
    p.dvy = dy * sp;
    p.dashT = DASH_TIME;
    p.dashCd = DASH_CD;
    p.knockT = 0;
    p.invuln = Math.max(p.invuln, DASH_TIME + 0.12);
    p.ghostT = 0;
    stats.dashes += 1;
    const back = Math.atan2(-dy, -dx);
    for (let i = 0; i < (hiQ ? 14 : 6); i++) {
      const a = back + rand(-0.6, 0.6);
      const s = rand(150, 420) * view.k;
      P(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, rand(0.2, 0.4), rand(1.5, 3) * view.k, C.cyan, SPARK, 4);
    }
    P(p.x, p.y, 0, 0, 0.3, 50 * view.k, C.cyan, RING);
    Sfx.play('dash');
    Input.vibrate(12);
  }
  function knockPlayer(x, y, force) {
    const p = player;
    if (!p || !p.alive || p.dashT > 0 || p.intro > 0) return;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy) || 1;
    p.knockT = 0.3;
    p.kvx = (dx / d) * force;
    p.kvy = (dy / d) * force;
    Input.vibrate(40);
  }

  function useNova() {
    const p = player;
    if (state !== 'playing' || !p || !p.alive || p.intro > 0) return;
    if (nova < 100) { UI.denied('nova'); return; }
    nova = 0;
    novaReadyShown = false;
    stats.novas += 1;
    startNova(p.x, p.y);
    p.invuln = Math.max(p.invuln, 1.2);
    P(p.x, p.y, 0, 0, 0.5, 160 * view.k, C.pink, GLOW);
    Sfx.play('nova');
    shake(0.9);
    slowmo(0.45, 0.35);
    UI.flash('white');
    Input.vibrate([30, 40, 90]);
  }
  function startNova(x, y) {
    novaFx = { id: ++novaId, x, y, r: 0, max: Math.hypot(view.w, view.h) * 1.05 };
  }
  function updateNova(dt) {
    if (!novaFx) return;
    const n = novaFx;
    n.r += (1500 * view.k + n.r * 1.5) * dt;
    const r2 = n.r * n.r;
    // kills made by the Nova (and any explosions it sets off) never recharge it
    novaLock += 1;
    for (const e of enemies) {
      if (e.dead || e.novaId === n.id || dist2(e.x, e.y, n.x, n.y) > r2) continue;
      e.novaId = n.id;
      hurtEnemy(e, (e.T.boss ? 45 : 30) * player.power, e.x, e.y, 'nova');
    }
    novaLock -= 1;
    for (const b of ebullets) {
      if (b.dead || dist2(b.x, b.y, n.x, n.y) > r2) continue;
      b.dead = true;
      score += 5;
      P(b.x, b.y, 0, -40 * view.k, 0.5, 10 * view.k, C.gold, GLOW);
    }
    if (n.r > n.max) novaFx = null;
  }
  function drawNova() {
    if (!novaFx) return;
    const n = novaFx;
    const k = view.k;
    const fade = Math.max(0, 1 - n.r / n.max);
    ctx.globalCompositeOperation = 'lighter';
    world();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#ff6ad5';
    ctx.lineWidth = 26 * k;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8 * k;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = fade * 0.6;
    ctx.strokeStyle = '#3ee6ff';
    ctx.lineWidth = 14 * k;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.82, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function hurtPlayer() {
    const p = player;
    if (!p.alive || p.intro > 0) return 0;
    if (buffs.shield > 0) { Sfx.play('shield'); return 1; }
    if (p.invuln > 0 || p.dashT > 0 || godMode) return 0;
    p.hp -= 1;
    p.invuln = 1.7;
    wave.hurt = true;
    stats.damage += 1;
    if (combo >= 3) popup(p.x, p.y - p.h, 'COMBO LOST', '#ff4d5e', 10, 1);
    resetCombo();
    shake(0.65);
    hitstop = 0.07;
    explode(p.x, p.y, PAL.player, 0.8, C.cyan);
    // mercy: wipe bullets right next to the ship
    const R = 140 * view.k;
    for (const b of ebullets) {
      if (!b.dead && dist2(b.x, b.y, p.x, p.y) < R * R) { b.dead = true; spark(b.x, b.y, b.c, 3); }
    }
    Sfx.play('hurt');
    Input.vibrate([60, 30, 60]);
    UI.flash('hurt');
    if (p.hp <= 0) {
      if (p.totem) useTotem();
      else playerDie();
    }
    return 2;
  }
  function useTotem() {
    const p = player;
    const k = view.k;
    p.totem = false;
    p.hp = Math.min(3, p.maxHp);
    p.invuln = 3;
    stats.totems += 1;
    Trophies.unlock('immortal');
    for (let i = 0; i < (hiQ ? 40 : 18); i++) {
      const a = rand(TAU);
      const sp = rand(120, 520) * k;
      P(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp - 80 * k, rand(0.7, 1.3), rand(5, 10) * k, pick(PAL.gold), CUBE, 1.8, 300 * k);
    }
    P(p.x, p.y, 0, 0, 0.9, 260 * k, C.gold, RING);
    P(p.x, p.y, 0, 0, 0.7, 180 * k, C.green, RING);
    P(p.x, p.y, 0, 0, 0.6, 200 * k, C.gold, GLOW);
    popup(p.x, p.y - p.h, 'TOTEM OF UNDYING!', '#ffe066', 14, 2);
    for (const b of ebullets) if (!b.dead) { b.dead = true; spark(b.x, b.y, C.gold, 2); }
    startNova(p.x, p.y);
    Sfx.play('totem');
    UI.flash('gold');
    slowmo(1, 0.3);
    shake(0.6);
    Input.vibrate([60, 40, 120]);
  }
  function playerDie() {
    const p = player;
    p.alive = false;
    state = 'dying';
    dieT = 0;
    explode(p.x, p.y, PAL.player, 2.6, C.cyan);
    P(p.x, p.y, 0, 0, 0.9, 260 * view.k, C.cyan, RING);
    P(p.x, p.y, 0, 0, 0.6, 200 * view.k, C.white, GLOW);
    Sfx.play('bigExplode');
    Sfx.music(null);
    shake(1);
    slowmo(1.4, 0.25);
    Input.vibrate([120, 60, 240]);
    UI.flash('white');
  }

  // ---- power-up effects: lightning storm + allay drones
  function updateStorm(dt) {
    if (buffs.storm <= 0) return;
    stormT -= dt;
    if (stormT > 0) return;
    stormT = 0.42;
    const targets = enemies.filter((e) => !e.dead && !e.inv && e.y > 0 && e.y < view.h && e.mode !== 'dying' && e.mode !== 'enter');
    if (!targets.length) return;
    const n = Math.min(3, targets.length);
    for (let i = 0; i < n; i++) {
      const j = i + randi(0, targets.length - 1 - i);
      const t = targets[j];
      targets[j] = targets[i];
      targets[i] = t;
      bolt(t.x + rand(-70, 70) * view.k, -20, t.x, t.y);
      P(t.x, t.y, 0, 0, 0.25, 70 * view.k, C.cyan, GLOW);
      spark(t.x, t.y, C.white, 4);
      hurtEnemy(t, (t.T.boss ? 8 : 5) * player.power, t.x, t.y, 'storm');
    }
    Sfx.play('thunder');
    shake(0.15);
  }
  function resetDrones() {
    for (const d of drones) { d.x = player.x; d.y = player.y; }
  }
  function updateDrones(dt) {
    if (buffs.drones <= 0 || !player.alive) return;
    const k = view.k;
    droneA += dt * 2.2;
    droneFire -= dt;
    const shoot = droneFire <= 0;
    if (shoot) droneFire = 0.36;
    for (let i = 0; i < 2; i++) {
      const d = drones[i];
      const a = droneA + i * Math.PI;
      d.x = damp(d.x, player.x + Math.cos(a) * 60 * k, 12, dt);
      d.y = damp(d.y, player.y + Math.sin(a) * 26 * k - 12 * k, 12, dt);
      if (shoot) {
        const t = nearestEnemy(d.x, d.y);
        if (t) {
          const ang = Math.atan2(t.y - d.y, t.x - d.x);
          const sp = 760 * view.vs;
          bullets.push({ x: d.x, y: d.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 7 * k, s: 14 * k, orb: C.cyan, col: C.cyan, dmg: player.power, pierce: 0, rot: 0, spin: 0, life: 1.6, homing: true, turn: 9, speed: 860 * view.vs, trail: 0, src: 'missile', last: null, dead: false });
        }
      }
      if (hiQ && Math.random() < dt * 12) P(d.x, d.y, rand(-20, 20) * k, rand(20, 60) * k, 0.4, 6 * k, C.cyan, GLOW, 2);
    }
  }
  function drawDrones() {
    if (buffs.drones <= 0 || !player.alive) return;
    const k = view.k;
    const s = 28 * k;
    const blink = buffs.drones < 2 && Math.sin(time * 25) > 0;
    ctx.globalCompositeOperation = 'lighter';
    for (const d of drones) glow(C.cyan, d.x, d.y, s * 1.1, 0.4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = blink ? 0.4 : 1;
    const c = sprite('allay', s, s);
    for (let i = 0; i < 2; i++) {
      const d = drones[i];
      blit(c, d.x, d.y + Math.sin(time * 6 + i * 2) * 3 * k, s, s, Math.sin(time * 3 + i) * 0.15, 1 + Math.sin(time * 22 + i) * 0.12, 1);
    }
    ctx.globalAlpha = 1;
  }

  function updateGhosts(dt) {
    for (const g of ghosts) { g.a -= dt * 3; if (g.a <= 0) g.dead = true; }
    compact(ghosts);
  }
  function drawPlayer() {
    const p = player;
    if (!p || !p.alive) return;
    const k = view.k;
    const pc = sprite('player', p.w, p.h);
    if (ghosts.length) {
      const gc = sprite('player', p.w, p.h, 'cyan');
      for (const g of ghosts) { ctx.globalAlpha = g.a; blit(gc, g.x, g.y, p.w, p.h, g.rot); }
    }
    const od = buffs.overdrive > 0;
    ctx.globalCompositeOperation = 'lighter';
    glow(od ? C.purple : C.cyan, p.x, p.y + p.h * 0.1, p.w * 0.9, 0.33 + 0.08 * Math.sin(time * 6));
    if (p.weapon >= 5) glow(C.gold, p.x, p.y, p.w * 1.1, 0.16 + 0.08 * Math.sin(time * 5));
    ctx.globalCompositeOperation = 'source-over';
    const blink = p.invuln > 0 && p.dashT <= 0 && Math.floor(time * 20) % 2 === 0;
    ctx.globalAlpha = blink ? 0.3 : 1;
    const flap = 1 + Math.sin(time * 9) * 0.045;
    blit(pc, p.x, p.y + p.recoil * 3 * k, p.w, p.h, p.tilt * 0.28, (1 - Math.abs(p.tilt) * 0.2) * flap, 1);
    if (debuffs.fatigue > 0) {
      ctx.globalAlpha = 0.3;
      blit(sprite('player', p.w, p.h, 'purple'), p.x, p.y + p.recoil * 3 * k, p.w, p.h, p.tilt * 0.28, (1 - Math.abs(p.tilt) * 0.2) * flap, 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    // wing-tip lights grow with weapon level
    if (p.weapon >= 3) {
      const a = 0.5 + 0.3 * Math.sin(time * 8);
      glow(C.gold, p.x - p.w * 0.46, p.y - p.h * 0.05, 11 * k, a);
      glow(C.gold, p.x + p.w * 0.46, p.y - p.h * 0.05, 11 * k, a);
    }
    // shmup-style hitbox core
    glow(C.white, p.x, p.y, 9 * k, 0.9);
    ctx.globalCompositeOperation = 'source-over';

    if (buffs.shield > 0) {
      const R = p.w * 0.62;
      const a = buffs.shield < 2 ? (Math.sin(time * 25) > 0 ? 0.9 : 0.3) : 1;
      ctx.globalCompositeOperation = 'lighter';
      glow(C.cyan, p.x, p.y, R * 1.35, 0.22 * a);
      world();
      ctx.globalAlpha = 0.75 * a;
      ctx.strokeStyle = '#3ee6ff';
      ctx.lineWidth = 2.5 * k;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3.5 * k;
      ctx.strokeStyle = '#baf7ff';
      for (let i = 0; i < 3; i++) {
        const a0 = time * 2.4 + (i * TAU) / 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, R + 5 * k, a0, a0 + 0.7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    drawDrones();
  }

  // ================================================================ enemies
  function spawnEnemy(type, x, y, o) {
    const T = TYPES[type];
    const k = view.k;
    const vs = view.vs;
    const w = T.w * k;
    const h = T.h * k;
    const hp = T.fixedHp ? T.hp : Math.max(1, Math.round(T.hp * wave.hpMul));
    const e = {
      type, T, x, y, w, h, r: Math.min(w, h) * 0.46, hp, maxHp: hp, score: T.score, t: 0, spawn: 1, flash: 0, rot: 0, scale: 1, grow: 1,
      ph: rand(TAU), vx: 0, vy: 0, mode: 0, t2: 0, fire: 0, charge: 0, fr: 1, inv: false, elite: false, novaId: 0, dead: false,
    };
    switch (type) {
      case 'zombie':
        e.vy = rand(70, 95) * vs * wave.spdMul;
        break;
      case 'skeleton':
      case 'wskel':
        e.ty = rand(0.1, 0.36) * view.h;
        e.bx = x;
        e.amp = rand(50, 110) * k * (Math.random() < 0.5 ? -1 : 1);
        e.fire = rand(0.8, 1.6);
        e.stay = rand(7, 10);
        if (type === 'wskel') e.fr = 1.3;
        break;
      case 'creeper':
        e.base = e.vy = rand(55, 75) * vs * wave.spdMul;
        e.fire = rand(1.5, 3);
        e.fuse = 0;
        break;
      case 'vex':
      case 'phantom':
        e.base = e.vy = rand(90, 120) * vs * wave.spdMul;
        e.bx = clamp(x, 40 * k, view.w - 40 * k);
        e.dive = rand(1.2, 2.6);
        e.trail = [];
        e.trailT = 0;
        break;
      case 'evoker':
        e.ty = rand(0.08, 0.2) * view.h;
        e.bx = x;
        e.cast = rand(1.5, 2.5);
        e.fire = rand(1.5, 2.5);
        e.life = rand(16, 22);
        e.casting = false;
        break;
      case 'slime':
      case 'magmacube': {
        const sz = (o && o.size) || (type === 'magmacube' ? 2 : 3);
        const f = SLIME_F[sz];
        e.size = sz;
        e.w *= f;
        e.h *= f;
        e.r *= f;
        e.hp = e.maxHp = Math.max(1, Math.round(SLIME_HP[sz] * wave.hpMul));
        e.score = SLIME_SCORE[sz];
        e.gy = y;
        e.vy = rand(38, 52) * vs * wave.spdMul;
        e.t2 = rand(0.1, 0.5);
        e.hop = 0;
        e.hdur = 0.6;
        e.hh = 0;
        e.hx0 = x;
        e.hx1 = x;
        e.sq = 0;
        break;
      }
      case 'blaze':
        e.ty = rand(0.1, 0.34) * view.h;
        e.bx = x;
        e.amp = rand(60, 120) * k * (Math.random() < 0.5 ? -1 : 1);
        e.fire = rand(1.2, 2);
        e.stay = rand(10, 13);
        e.rodA = rand(TAU);
        e.heat = 0;
        e.burst = 0;
        e.burstT = 0;
        break;
      case 'enderman':
        e.t2 = rand(1, 1.8);
        e.life = rand(14, 18);
        e.dodgeCd = 0;
        e.lx = x;
        e.ly = y;
        break;
      case 'shulker':
        e.ty = rand(0.1, 0.32) * view.h;
        e.bx = x;
        e.cyc = rand(0, 1.2);
        e.open = 0;
        e.shot = false;
        e.life = rand(16, 20);
        break;
      case 'ghast':
        e.ty = rand(0.08, 0.22) * view.h;
        e.bx = x;
        e.fire = rand(1.5, 2.5);
        e.life = rand(18, 24);
        break;
      case 'shrieker':
        e.tx = x;
        e.ty = y;
        e.fire = 1.6;
        e.life = 10;
        break;
      case 'guardian':
        e.ty = rand(0.25, 0.45) * view.h;
        e.fire = rand(1, 1.8);
        e.life = 14;
        break;
      case 'crystal':
      case 'illusion':
        e.tx = x;
        e.bx = x;
        e.ty = y;
        break;
      default:
        break;
    }
    if (!(o && o.noElite) && wave.n >= 7 && Math.random() < Math.min(0.15, 0.04 + (wave.n - 7) * 0.01)) {
      e.elite = true;
      e.w *= 1.2;
      e.h *= 1.2;
      e.r *= 1.2;
      e.hp = e.maxHp = Math.round(e.maxHp * 3);
      e.score *= 3;
      e.fr *= 1.3;
    }
    if (DEBUT.has(type) && !seen.has(type)) {
      seen.add(type);
      UI.toast(`NEW MOB · ${T.name}`);
    }
    enemies.push(e);
    return e;
  }
  const countType = (t) => { let n = 0; for (const e of enemies) if (!e.dead && e.type === t) n++; return n; };

  function eShoot(x, y, vx, vy, kind, c) {
    const d = EB[kind];
    const spin = kind === 'tnt' || kind === 'ghastball' || kind === 'rock';
    const b = {
      x, y, vx, vy, kind, r: d.r * view.k, c: c || d.c, t: 0, hp: d.hp || 0, life: d.life || 14, fuse: 0, g: 0, home: 0,
      rot: spin ? rand(-0.3, 0.3) : Math.atan2(vy, vx), spin: spin ? rand(-4, 4) : 0, grazed: false, dead: false,
    };
    ebullets.push(b);
    return b;
  }
  const bulletSpeed = (base) => base * view.vs * (1 + wave.cycle * 0.06) * diff.bspd;
  const aimAt = (x, y) => Math.atan2(player.y - y, player.x - x);
  /** n bullets in a ring around (x, y). */
  function ring(x, y, n, speed, kind, c, off = rand(TAU)) {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      eShoot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, kind, c);
    }
  }
  /** n bullets in a fan aimed at the player. */
  function fan(x, y, n, spread, speed, kind, c) {
    const base = aimAt(x, y);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      eShoot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, kind, c);
    }
  }

  function enderTeleport(e, away) {
    const k = view.k;
    burst(e.x, e.y, C.purple, hiQ ? 14 : 6);
    P(e.x, e.y, 0, 0, 0.35, 60 * k, C.purple, RING);
    Sfx.play('teleport');
    if (away) { e.dead = true; return; }
    const p = player;
    const nx = clamp(p.x + rand(-230, 230) * k, e.w, view.w - e.w);
    let ny = clamp(p.y - rand(170, 300) * k, view.h * 0.08, view.h * 0.6);
    if (dist2(nx, ny, p.x, p.y) < (150 * k) * (150 * k)) ny = Math.max(view.h * 0.08, p.y - 220 * k);
    e.x = nx;
    e.y = ny;
    e.spawn = 0.3;
    e.mode = 0;
    e.t2 = rand(0.9, 1.6);
    e.vx = 0;
    e.vy = 0;
    e.charge = 0;
    burst(e.x, e.y, C.purple, hiQ ? 14 : 6, 180);
  }
  function fuseBurst(b) {
    b.dead = true;
    if (b.kind === 'dfire') {
      explode(b.x, b.y, PAL.acid, 1, C.pink);
      addHazard('acid', b.x, b.y, 70 * view.k, 4);
      Sfx.play('explode', 1.2);
      return;
    }
    explode(b.x, b.y, PAL.fire, b.big ? 2 : 1.2, C.orange);
    const n = b.big ? 18 : 10;
    const sp = bulletSpeed(230);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.1, 0.1);
      eShoot(b.x, b.y, Math.cos(a) * sp, Math.sin(a) * sp, 'shard');
    }
    Sfx.play('explode', 1.3);
  }

  const BEHAVIOR = {
    zombie(e, dt) {
      e.y += e.vy * dt;
      e.x += Math.sin(e.t * 1.6 + e.ph) * 22 * view.k * dt;
      e.rot = Math.sin(e.t * 3 + e.ph) * 0.07;
    },

    skeleton(e, dt) {
      const k = view.k;
      if (e.mode === 0) {
        e.y = damp(e.y, e.ty, 2.4, dt);
        if (Math.abs(e.y - e.ty) < 3 * k) { e.mode = 1; e.t2 = 0; }
      } else if (e.mode === 1) {
        e.t2 += dt;
        e.x = clamp(e.bx + Math.sin(e.t2 * 1.3) * e.amp, e.w, view.w - e.w);
        e.y = e.ty + Math.sin(e.t2 * 2.1) * 6 * k;
        e.fire -= dt * wave.fireMul * e.fr;
        e.charge = e.fire < 0.4 ? clamp(1 - e.fire / 0.4, 0, 1) : 0;
        if (e.fire <= 0 && player.alive) {
          const sp = bulletSpeed(360);
          const a = aimAt(e.x, e.y);
          const spread = wave.n >= 8 || e.type === 'wskel' || e.elite ? [-0.18, 0, 0.18] : [0];
          for (const s of spread) eShoot(e.x, e.y + e.h * 0.3, Math.cos(a + s) * sp, Math.sin(a + s) * sp, 'arrow');
          e.fire = rand(1.5, 2.3);
          Sfx.play('eshoot');
        }
        if (e.t2 > e.stay) { e.mode = 2; e.vy = 0; }
      } else {
        e.charge = 0;
        e.vy = Math.min(e.vy + 320 * view.vs * dt, 280 * view.vs);
        e.y += e.vy * dt;
      }
    },

    creeper(e, dt) {
      const p = player;
      const k = view.k;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (p.alive && d < 300 * k && e.y > 0) {
        const acc = 260 * k;
        e.vx += (dx / d) * acc * dt;
        e.vy += (dy / d) * acc * dt;
        const sp = Math.hypot(e.vx, e.vy);
        const max = 190 * k * wave.spdMul;
        if (sp > max) { e.vx *= max / sp; e.vy *= max / sp; }
      } else {
        e.vx = damp(e.vx, 0, 2, dt);
        e.vy = damp(e.vy, e.base, 2, dt);
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (p.alive && d < 105 * k) {
        if (e.fuse === 0) Sfx.play('fuse');
        e.fuse += dt;
      } else {
        e.fuse = Math.max(0, e.fuse - dt * 0.8);
      }
      e.scale = 1 + e.fuse * 0.35;
      if (e.fuse >= 0.85) { creeperBlast(e, false); return; }
      e.fire -= dt * wave.fireMul * e.fr;
      if (e.fire <= 0 && e.y > 0 && e.y < view.h * 0.6) {
        eShoot(e.x, e.y + e.h * 0.4, 0, 170 * view.vs * diff.bspd, 'tnt');
        e.fire = rand(2.6, 3.6);
      }
    },

    vex(e, dt) {
      const k = view.k;
      e.trailT -= dt;
      if (e.trailT <= 0) {
        e.trailT = 0.04;
        e.trail.push({ x: e.x, y: e.y });
        if (e.trail.length > 4) e.trail.shift();
      }
      if (e.mode === 0) {
        e.y += e.vy * dt;
        e.x = e.bx + Math.sin(e.t * 3.2 + e.ph) * 60 * k;
        e.dive -= dt;
        e.rot = damp(e.rot, 0, 6, dt);
        if (e.dive <= 0 && player.alive && e.y > 0 && e.y < player.y - 60 * k) { e.mode = 1; e.t2 = 0.35; }
      } else if (e.mode === 1) {
        e.t2 -= dt;
        e.x += rand(-1, 1) * 2 * k;
        if (e.t2 <= 0) {
          const sp = 420 * view.vs * wave.spdMul;
          const a = aimAt(e.x, e.y);
          e.vx = Math.cos(a) * sp;
          e.vy = Math.sin(a) * sp;
          e.rot = a - Math.PI / 2;
          e.mode = 2;
          e.t2 = 0.7;
          Sfx.play('vex');
        }
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.t2 -= dt;
        if (e.t2 <= 0) {
          e.mode = 0;
          e.vy = e.base;
          e.bx = clamp(e.x - Math.sin(e.t * 3.2 + e.ph) * 60 * k, 40 * k, view.w - 40 * k);
          e.dive = rand(1.6, 2.8);
        }
      }
    },

    evoker(e, dt) {
      const k = view.k;
      if (e.mode === 0) {
        e.y = damp(e.y, e.ty, 2, dt);
        if (Math.abs(e.y - e.ty) < 3 * k) { e.mode = 1; e.t2 = 0; }
      } else if (e.mode === 1) {
        e.t2 += dt;
        e.x = clamp(e.bx + Math.sin(e.t2 * 0.6) * 90 * k, e.w, view.w - e.w);
        e.y = e.ty + Math.sin(e.t2 * 1.5) * 8 * k;
        e.cast -= dt * wave.fireMul * e.fr;
        if (e.cast <= 0.9 && !e.casting) { e.casting = true; Sfx.play('cast'); }
        if (e.casting && hiQ && Math.random() < dt * 30) {
          const a = rand(TAU);
          P(e.x + Math.cos(a) * 44 * k, e.y + e.h * 0.1 + Math.sin(a) * 16 * k, 0, -60 * k, 0.5, 8 * k, C.purple, GLOW, 1);
        }
        if (e.cast <= 0) {
          e.cast = rand(4.5, 6);
          e.casting = false;
          if (countType('vex') < 10) {
            for (const s of [-1, 1]) {
              const v = spawnEnemy('vex', e.x + s * 50 * k, e.y + 10 * k, { noElite: true });
              v.spawn = 0;
              P(v.x, v.y, 0, 0, 0.4, 50 * k, C.purple, RING);
            }
          }
        }
        e.fire -= dt * wave.fireMul * e.fr;
        if (e.fire <= 0 && player.alive) {
          fan(e.x, e.y + e.h * 0.3, 5, 0.2, bulletSpeed(220), 'magic');
          e.fire = rand(2.4, 3.2);
          Sfx.play('eshoot');
        }
        e.life -= dt;
        if (e.life <= 0) e.mode = 2;
      } else {
        // retreat upward (no penalty)
        e.casting = false;
        e.y -= 120 * view.vs * dt;
        if (e.y < -e.h) e.dead = true;
      }
    },

    slime(e, dt) {
      const k = view.k;
      e.gy += e.vy * dt;
      if (e.mode === 0) {
        // grounded: squash down before the next hop
        e.t2 -= dt;
        e.y = e.gy;
        e.sq = damp(e.sq, e.t2 < 0.18 ? 0.9 : 0.1, 10, dt);
        if (e.t2 <= 0) {
          e.mode = 1;
          e.hop = 0;
          e.hdur = rand(0.5, 0.7);
          e.hh = rand(55, 95) * k * (0.6 + SLIME_F[e.size] * 0.5);
          e.hx0 = e.x;
          const toward = player.alive && Math.random() < 0.65 ? player.x : rand(e.w, view.w - e.w);
          e.hx1 = clamp(e.x + clamp(toward - e.x, -130 * k, 130 * k), e.w / 2, view.w - e.w / 2);
        }
      } else {
        e.hop += dt / e.hdur;
        const u = Math.min(1, e.hop);
        e.x = lerp(e.hx0, e.hx1, u);
        e.y = e.gy - Math.sin(u * Math.PI) * e.hh;
        e.sq = damp(e.sq, -0.5 * (1 - u), 12, dt);
        if (u >= 1) {
          e.mode = 0;
          e.t2 = rand(0.35, 0.6);
          e.sq = 1.1;
          for (let i = 0; i < (hiQ ? 5 : 2); i++) P(e.x + rand(-0.4, 0.4) * e.w, e.y + e.h * 0.4, rand(-80, 80) * k, -rand(40, 120) * k, 0.45, rand(3, 6) * k, pick(e.T.pal), CUBE, 2, 400 * k);
          if (e.type === 'magmacube' && e.y > 0) ring(e.x, e.y, 6, bulletSpeed(180), 'shard');
          if (e.y > 0) Sfx.play('slime');
        }
      }
    },

    blaze(e, dt) {
      const k = view.k;
      e.rodA += dt * (2 + e.heat * 7);
      if (e.mode === 0) {
        e.y = damp(e.y, e.ty, 2.2, dt);
        if (Math.abs(e.y - e.ty) < 3 * k) { e.mode = 1; e.t2 = 0; }
      } else if (e.mode === 1) {
        e.t2 += dt;
        e.x = clamp(e.bx + Math.sin(e.t2 * 0.9) * e.amp, e.w, view.w - e.w);
        e.y = e.ty + Math.sin(e.t2 * 2.4) * 10 * k;
        if (e.burst > 0) {
          e.burstT -= dt;
          if (e.burstT <= 0 && player.alive) {
            const a = aimAt(e.x, e.y) + rand(-0.06, 0.06);
            const sp = bulletSpeed(300);
            eShoot(e.x, e.y + e.h * 0.2, Math.cos(a) * sp, Math.sin(a) * sp, 'fire');
            e.burst -= 1;
            e.burstT = 0.14;
            Sfx.play('blaze');
            if (e.burst === 0) e.fire = rand(2.2, 3);
          }
        } else {
          e.fire -= dt * wave.fireMul * e.fr;
          e.heat = e.fire < 0.7 ? clamp(1 - e.fire / 0.7, 0, 1) : damp(e.heat, 0, 4, dt);
          if (e.fire <= 0) { e.burst = 3 + (e.elite || wave.n >= 12 ? 1 : 0); e.burstT = 0; }
        }
        if (hiQ && Math.random() < dt * 8) P(e.x + rand(-0.3, 0.3) * e.w, e.y + e.h * 0.4, rand(-10, 10) * k, rand(-60, -20) * k, rand(0.5, 0.9), 16 * k, C.smoke, SMOKE, 1);
        if (e.t2 > e.stay) { e.mode = 2; e.vy = 0; }
      } else {
        e.heat = 0;
        e.vy = Math.min(e.vy + 300 * view.vs * dt, 260 * view.vs);
        e.y += e.vy * dt;
      }
    },

    enderman(e, dt) {
      const k = view.k;
      const p = player;
      e.dodgeCd -= dt;
      if (hiQ && Math.random() < dt * 14) P(e.x + rand(-0.5, 0.5) * e.w, e.y + rand(-0.5, 0.5) * e.h, rand(-10, 10) * k, -rand(20, 60) * k, rand(0.5, 0.9), rand(3, 5) * k, C.purple, GLOW, 1);
      e.life -= dt;
      if (e.life <= 0 && e.mode !== 2) { enderTeleport(e, true); return; }
      if (e.mode === 0) {
        // stalk
        e.t2 -= dt;
        e.x = damp(e.x, p.x, 0.8, dt);
        e.y += Math.sin(e.t * 3) * 8 * k * dt;
        if (e.t2 <= 0 && p.alive) { e.mode = 1; e.t2 = 0.55; e.lx = p.x; e.ly = p.y; Sfx.play('stare'); }
      } else if (e.mode === 1) {
        // stare — telegraph the lunge
        e.t2 -= dt;
        e.charge = clamp(1 - e.t2 / 0.55, 0, 1);
        e.x += rand(-1, 1) * 1.5 * k;
        if (e.t2 <= 0) {
          const a = Math.atan2(e.ly - e.y, e.lx - e.x);
          const sp = 560 * view.vs * wave.spdMul;
          e.vx = Math.cos(a) * sp;
          e.vy = Math.sin(a) * sp;
          e.mode = 2;
          e.t2 = 0.5;
          e.charge = 0;
        }
      } else if (e.mode === 2) {
        // lunge
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.t2 -= dt;
        if (hiQ) P(e.x, e.y, 0, 0, 0.25, e.w * 0.5, C.purple, GLOW, 2);
        if (e.t2 <= 0 || e.y > view.h - 40 * k) { e.mode = 3; e.t2 = 0.45; }
      } else {
        // recover, then blink somewhere new
        e.vx = damp(e.vx, 0, 6, dt);
        e.vy = damp(e.vy, 0, 6, dt);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.t2 -= dt;
        if (e.t2 <= 0) enderTeleport(e, false);
      }
      e.x = clamp(e.x, e.w * 0.5, view.w - e.w * 0.5);
      e.y = Math.min(e.y, view.h - 30 * k);
    },

    shulker(e, dt) {
      const k = view.k;
      if (e.mode === 0) {
        e.y = damp(e.y, e.ty, 2.5, dt);
        if (Math.abs(e.y - e.ty) < 3 * k) e.mode = 1;
      } else if (e.mode === 1) {
        e.y = e.ty + Math.sin(e.t * 2) * 3 * k;
        e.cyc += dt * e.fr;
        const c = e.cyc % 3.6;
        e.open = damp(e.open, c > 1.8 ? 1 : 0, 10, dt);
        if (c > 2.05 && !e.shot && player.alive) {
          e.shot = true;
          const n = e.elite || wave.n >= 14 ? 3 : 2;
          const sp = bulletSpeed(170);
          for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.9;
            eShoot(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, 'shulk');
          }
          Sfx.play('shulker');
        }
        if (c < 1.8) e.shot = false;
        e.life -= dt;
        if (e.life <= 0) { e.mode = 2; e.vy = 0; }
      } else {
        e.open = damp(e.open, 0, 10, dt);
        e.vy = Math.min(e.vy + 260 * view.vs * dt, 240 * view.vs);
        e.y += e.vy * dt;
      }
    },

    ghast(e, dt) {
      const k = view.k;
      if (e.mode === 0) {
        e.y = damp(e.y, e.ty, 1.5, dt);
        if (Math.abs(e.y - e.ty) < 3 * k) { e.mode = 1; e.t2 = 0; }
      } else if (e.mode === 1) {
        e.t2 += dt;
        e.x = clamp(e.bx + Math.sin(e.t2 * 0.45) * 110 * k, e.w * 0.6, view.w - e.w * 0.6);
        e.y = e.ty + Math.sin(e.t2 * 1.1) * 12 * k;
        e.fire -= dt * wave.fireMul * e.fr;
        e.charge = e.fire < 0.8 ? clamp(1 - e.fire / 0.8, 0, 1) : 0;
        if (e.fire <= 0 && player.alive) {
          const a = aimAt(e.x, e.y);
          const sp = bulletSpeed(170);
          const b = eShoot(e.x, e.y + e.h * 0.25, Math.cos(a) * sp, Math.sin(a) * sp, 'ghastball');
          b.fuse = 1.9;
          e.fire = rand(3.2, 4.2);
          Sfx.play('ghast');
        }
        e.life -= dt;
        if (e.life <= 0) e.mode = 2;
      } else {
        e.charge = 0;
        e.y -= 110 * view.vs * dt;
        if (e.y < -e.h) e.dead = true;
      }
    },

    // ---- boss minions
    shrieker(e, dt) {
      const k = view.k;
      e.x = damp(e.x, e.tx, 2.5, dt);
      e.y = damp(e.y, e.ty, 2.5, dt);
      e.fire -= dt * e.fr;
      e.charge = e.fire < 0.5 ? clamp(1 - e.fire / 0.5, 0, 1) : 0;
      if (e.fire <= 0) {
        ring(e.x, e.y, 12, bulletSpeed(170), 'orb');
        P(e.x, e.y, 0, 0, 0.5, 90 * k, C.cyan, RING);
        Sfx.play('shriek');
        e.fire = 2.4;
      }
      e.life -= dt;
      if (e.life <= 0) { explode(e.x, e.y, PAL.shrieker, 0.7, C.cyan); e.dead = true; }
    },
    guardian(e, dt) {
      const k = view.k;
      if (e.mode === 0) {
        e.y = damp(e.y, e.ty, 2.5, dt);
        if (Math.abs(e.y - e.ty) < 3 * k) { e.mode = 1; e.t2 = 0; e.bx = e.x; }
      } else if (e.mode === 1) {
        e.t2 += dt;
        e.x = clamp(e.bx + Math.sin(e.t2 * 1.1) * 70 * k, e.w, view.w - e.w);
        e.rot = Math.sin(e.t2 * 2) * 0.1;
        e.fire -= dt * wave.fireMul * e.fr;
        e.charge = e.fire < 0.4 ? clamp(1 - e.fire / 0.4, 0, 1) : 0;
        if (e.fire <= 0 && player.alive) {
          fan(e.x, e.y, 2, 0.14, bulletSpeed(280), 'spike');
          e.fire = rand(1.8, 2.4);
          Sfx.play('eshoot');
        }
        e.life -= dt;
        if (e.life <= 0) { e.mode = 2; e.vy = 0; }
      } else {
        e.vy = Math.min(e.vy + 300 * view.vs * dt, 260 * view.vs);
        e.y += e.vy * dt;
      }
    },
    crystal(e, dt) {
      e.x = damp(e.x, e.tx, 3, dt);
      e.y = damp(e.y, e.ty + Math.sin(e.t * 2 + e.ph) * 8 * view.k, 3, dt);
      e.rot += dt * 1.6;
      // End Crystals slowly heal the Ender Dragon while they live
      if (boss && boss.kind === 'dragon' && boss.mode === 'fight' && boss.hp < boss.maxHp) {
        boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.01 * dt);
      }
    },
    illusion(e, dt) {
      e.x = damp(e.x, e.bx, 3, dt);
      e.y = damp(e.y, e.ty + Math.sin(e.t * 1.4 + e.ph) * 12 * view.k, 3, dt);
    },
  };
  BEHAVIOR.wskel = BEHAVIOR.skeleton;
  BEHAVIOR.phantom = BEHAVIOR.vex;
  BEHAVIOR.magmacube = BEHAVIOR.slime;

  // ================================================================ bosses (engine side)
  // Boss definitions are in bosses.js. Every fight is a higher boss level:
  // more HP, faster attacks; each lap through all ten unlocks new moves (MK II, MK III...).
  const bossTypes = {};
  const bossPace = (e) => (e.phase === 3 ? 1.35 : 1) * (1 + (e.level - 1) * 0.08);
  const bossF = (e) => 1 + (e.level - 1) * 0.05;
  const nextBossDef = () => BK.ALL[BK.ORDER[bossLevel % BK.ORDER.length]];

  function spawnBoss() {
    bossLevel += 1;
    const kind = BK.ORDER[(bossLevel - 1) % BK.ORDER.length];
    const def = BK.ALL[kind];
    const mark = Math.ceil(bossLevel / BK.ORDER.length);
    const k = view.k;
    const big = 1 + Math.min(0.24, (mark - 1) * 0.08);
    const w = def.w * k * big;
    const h = def.h * k * big;
    const ty = Math.max(view.h * 0.12, view.w <= 640 ? 150 : 70) + h * 0.5;
    if (!bossTypes[kind]) bossTypes[kind] = { img: def.img, w: def.w, h: def.h, hp: def.hp, score: def.score, pal: def.pal, glow: def.glow, boss: true, name: def.name };
    const hp = Math.round(def.hp * (1 + (bossLevel - 1) * 0.3) * diff.ehp);
    const e = {
      type: kind, kind, def, T: bossTypes[kind], x: view.w / 2, y: def.entry === 'drop' ? -h : ty, w, h, r: h * 0.45,
      hp, maxHp: hp, score: def.score, t: 0, spawn: 1, flash: 0, rot: 0, scale: 1, grow: def.entry === 'grow' ? 0 : 1, ph: 0,
      vx: 0, vy: 0, mode: 'enter', enterT: 0, inv: true, invT: 0, ty, phase: 1, atk: 2, mt: 0, mouth: 0, last: '',
      beams: [], queue: [], spiral: null, armor: false, dieT: 0, boomT: 0, level: bossLevel, mark, fr: 1, elite: false, novaId: 0, dead: false,
    };
    e.title = def.name + (mark > 1 ? ` MK ${ROMAN[mark - 1] || mark}` : '');
    if (def.init) def.init(e);
    enemies.push(e);
    boss = e;
    UI.bossBar(true, `${e.title} · LV ${bossLevel}`);
    UI.letterbox(true);
    Sfx.play(bossLevel % 2 ? 'roar' : 'wither');
    shake(0.5);
  }
  /** Shared entrance + death sequence. Returns true while the boss is busy with them. */
  function bossIntro(e, dt) {
    const k = view.k;
    const def = e.def;
    if (e.mode === 'enter') {
      e.enterT += dt / 3.2;
      const u = Math.min(1, e.enterT);
      if (def.entry === 'drop') {
        e.y = lerp(-e.h, e.ty, easeOutCubic(u));
        e.x = damp(e.x, view.w / 2, 3, dt);
      } else {
        // charges up in place, swelling with energy
        e.grow = easeOutCubic(u);
        e.flash = Math.sin(e.enterT * 40) > 0.6 ? 0.1 : 0;
        if (Math.random() < dt * 25) P(e.x + rand(-0.5, 0.5) * e.w, e.y + rand(-0.5, 0.5) * e.h, 0, -30 * k, 0.5, 18 * k, def.glow, GLOW, 1);
      }
      if (Math.random() < dt * 8) shake(0.05);
      if (u >= 1) {
        e.mode = 'fight';
        e.inv = false;
        e.atk = 1.4;
        e.grow = 1;
        Sfx.play(bossLevel % 2 ? 'roar' : 'wither');
        shake(0.8);
        P(e.x, e.y, 0, 0, 0.8, 320 * k, MARK_GLOW[e.mark] || def.glow, RING);
        if (def.onFight) def.onFight(e);
        UI.letterbox(false);
        UI.banner(e.title, def.intro[e.mark - 1] || `MK ${ROMAN[e.mark - 1] || e.mark} · ALL MOVES EMPOWERED`, 'bosscard', 3000);
      }
      return true;
    }
    if (e.mode === 'dying') {
      e.dieT += dt;
      e.x += rand(-2, 2) * k;
      e.flash = Math.sin(e.dieT * 40) > 0 ? 0.1 : 0;
      e.boomT -= dt;
      if (e.boomT <= 0) {
        e.boomT = 0.11;
        explode(e.x + rand(-0.4, 0.4) * e.w, e.y + rand(-0.35, 0.35) * e.h, e.T.pal, 0.8, def.glow);
        Sfx.play('explode', 1);
        shake(0.25);
      }
      if (e.dieT > 2.1) bossFinale(e);
      return true;
    }
    return false;
  }
  function bossUpdate(e, dt) {
    if (bossIntro(e, dt)) return;
    const def = e.def;
    const hpR = e.hp / e.maxHp;
    const ph = hpR > def.phases[0] ? 1 : hpR > def.phases[1] ? 2 : 3;
    if (ph !== e.phase) bossPhase(e, ph);
    if (e.invT > 0) { e.invT -= dt; if (e.invT <= 0) e.inv = false; }
    const pace = bossPace(e);
    e.mt += dt * pace;
    if (e.mouth > 0) e.mouth -= dt;
    def.tick(e, dt);
    if (e.queue.length) {
      e.queue[0].t -= dt;
      while (e.queue.length && e.queue[0].t <= 0) e.queue.shift().fn(e);
    }
    updateBeams(e, dt);
    updateSpiral(e, dt);
    if (!e.queue.length && !e.beams.length && !e.spiral && !def.busy(e) && !e.inv) {
      e.atk -= dt * pace;
      if (e.atk <= 0) {
        const list = def.moves(e);
        let a = pick(list);
        if (a === e.last) a = pick(list);
        e.last = a;
        def.attack(e, a);
      }
    }
  }
  function bossPhase(e, ph) {
    const def = e.def;
    e.phase = ph;
    e.inv = true;
    e.invT = 1;
    e.beams.length = 0;
    e.queue.length = 0;
    e.spiral = null;
    for (const key of ['charge', 'dash', 'swoop', 'rush', 'hop']) if (e[key]) e[key] = null;
    if (e.lasers) e.lasers.length = 0;
    Sfx.play(bossLevel % 2 ? 'roar' : 'wither');
    shake(0.7);
    const txt = def.phaseText && def.phaseText[ph];
    if (txt) UI.banner(txt[0], txt[1], 'phase', 1700);
    P(e.x, e.y, 0, 0, 0.9, 380 * view.k, ph === 3 ? C.red : MARK_GLOW[e.mark] || def.glow, RING);
    if (def.onPhase) def.onPhase(e, ph);
  }
  function spiral(e, o) {
    e.spiral = { t: o.time, arms: o.arms, twin: !!o.twin, kind: o.kind, speed: o.speed, oy: o.oy || 0, rate: o.rate || 0.1, cd: 0, a: rand(TAU) };
  }
  function updateSpiral(e, dt) {
    const s = e.spiral;
    if (!s) return;
    s.t -= dt;
    if (s.t <= 0) { e.spiral = null; return; }
    s.cd -= dt;
    if (s.cd > 0) return;
    s.cd = s.twin ? s.rate * 1.5 : s.rate;
    s.a += 0.32;
    const v = bulletSpeed(s.speed) * bossF(e);
    const ox = e.x;
    const oy = e.y + e.h * s.oy;
    for (let i = 0; i < s.arms; i++) {
      const a = s.a + (i * TAU) / s.arms;
      eShoot(ox, oy, Math.cos(a) * v, Math.sin(a) * v, s.kind);
      if (s.twin) {
        const b = -s.a + (i * TAU) / s.arms + Math.PI / s.arms;
        eShoot(ox, oy, Math.cos(b) * v, Math.sin(b) * v, s.kind);
      }
    }
  }
  function makeBeam(x, track, sky, pal = 'teal') {
    return { t: 0, x, x0: x, warn: 1.05, fire: 0.65, w: 70 * view.k, track, sky, pal, sweep: false, vx: 0, fired: false, done: false };
  }
  function updateBeams(e, dt) {
    if (!e.beams.length) return;
    const k = view.k;
    const p = player;
    for (const b of e.beams) {
      b.t += dt;
      if (b.track && b.t < b.warn * 0.7 && p.alive) b.x = damp(b.x, p.x, 2.5, dt);
      if (b.t >= b.warn && b.t < b.warn + b.fire) {
        if (!b.fired) { b.fired = true; Sfx.play('beam'); shake(0.5); Input.vibrate(40); }
        if (b.sweep) b.x += b.vx * dt;
        const top = b.sky ? 0 : e.y;
        if (p.alive && Math.abs(p.x - b.x) < b.w * 0.45 + p.r && p.y > top) hurtPlayer();
        if (hiQ || Math.random() < 0.5) P(b.x + rand(-b.w / 2, b.w / 2), view.h, rand(-100, 100) * k, -rand(100, 420) * k, 0.4, rand(2, 3.5) * k, b.pal === 'fire' ? C.orange : C.cyan, SPARK, 2);
      } else if (b.t >= b.warn + b.fire) {
        b.done = true;
      }
    }
    for (let i = e.beams.length - 1; i >= 0; i--) if (e.beams[i].done) e.beams.splice(i, 1);
  }
  const BEAM_PAL = {
    teal: { edge: '25,210,190', core: '160,255,250', a: C.cyan, b: C.teal },
    fire: { edge: '255,120,30', core: '255,235,160', a: C.gold, b: C.orange },
  };
  function drawBeam(e, b) {
    const k = view.k;
    const pal = BEAM_PAL[b.pal] || BEAM_PAL.teal;
    const top = b.sky ? -10 : e.y + e.h * 0.2;
    const bottom = view.h + 20;
    world();
    if (b.t < b.warn) {
      const blink = Math.sin(b.t * 30) > 0 ? 0.85 : 0.35;
      ctx.globalAlpha = 1;
      if (b.sweep) {
        // danger area covers the whole sweep, with chevrons showing its direction
        const x1 = b.x0 + b.vx * b.fire;
        const lo = Math.min(b.x0, x1) - b.w / 2;
        const hi = Math.max(b.x0, x1) + b.w / 2;
        ctx.fillStyle = 'rgba(255,60,80,0.1)';
        ctx.fillRect(lo, top, hi - lo, bottom - top);
        ctx.fillStyle = `rgba(255,90,110,${blink})`;
        const dir = Math.sign(b.vx);
        for (let i = 0; i < 6; i++) {
          const x = lerp(b.x0, x1, i / 5);
          const y = view.h * 0.5;
          ctx.beginPath();
          ctx.moveTo(x + dir * 14 * k, y);
          ctx.lineTo(x - dir * 6 * k, y - 12 * k);
          ctx.lineTo(x - dir * 6 * k, y + 12 * k);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = 'rgba(255,60,80,0.1)';
        ctx.fillRect(b.x - b.w / 2, top, b.w, bottom - top);
      }
      ctx.strokeStyle = `rgba(255,80,100,${blink})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -b.t * 120;
      ctx.beginPath();
      ctx.moveTo(b.x - b.w / 2, top); ctx.lineTo(b.x - b.w / 2, bottom);
      ctx.moveTo(b.x + b.w / 2, top); ctx.lineTo(b.x + b.w / 2, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!b.sky) {
        ctx.globalCompositeOperation = 'lighter';
        glow(pal.b, e.x, top, (40 + (b.t / b.warn) * 90) * k, 0.9);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      const f = (b.t - b.warn) / b.fire;
      const wm = f < 0.15 ? f / 0.15 : f > 0.8 ? (1 - f) / 0.2 : 1;
      const w = b.w * (0.9 + Math.sin(time * 60) * 0.1) * Math.max(0, wm);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(b.x - w, 0, b.x + w, 0);
      g.addColorStop(0, `rgba(${pal.edge},0)`);
      g.addColorStop(0.3, `rgba(${pal.edge},0.55)`);
      g.addColorStop(0.45, `rgba(${pal.core},0.95)`);
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, `rgba(${pal.core},0.95)`);
      g.addColorStop(0.7, `rgba(${pal.edge},0.55)`);
      g.addColorStop(1, `rgba(${pal.edge},0)`);
      ctx.fillStyle = g;
      ctx.globalAlpha = 1;
      ctx.fillRect(b.x - w, top, w * 2, bottom - top);
      if (!b.sky) glow(pal.a, b.x, top, 120 * k * wm, 1);
      glow(pal.b, b.x, view.h, 140 * k * wm, 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
  function drawBossFx(e) {
    for (const b of e.beams) drawBeam(e, b);
    if (e.def.drawFx && e.mode === 'fight') e.def.drawFx(e);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  function startBossDeath(e) {
    e.mode = 'dying';
    e.dieT = 0;
    e.boomT = 0;
    e.beams.length = 0;
    e.queue.length = 0;
    e.spiral = null;
    e.inv = true;
    darkT = 0;
    if (e.def.onDeath) e.def.onDeath(e);
    for (const m of enemies) {
      if ((m.type === 'crystal' || m.type === 'shrieker') && !m.dead) { m.dead = true; explode(m.x, m.y, m.T.pal, 0.8, m.T.glow); }
    }
    for (const b of ebullets) {
      if (b.dead) continue;
      b.dead = true;
      P(b.x, b.y, 0, -40 * view.k, 0.5, 10 * view.k, C.gold, GLOW);
    }
    hazards.length = 0;
    slowmo(1.6, 0.3);
    Sfx.play(bossLevel % 2 ? 'roar' : 'wither');
    shake(0.8);
    UI.bossBar(false);
  }
  function bossFinale(e) {
    const k = view.k;
    e.dead = true;
    boss = null;
    explode(e.x, e.y, e.T.pal, 4, e.def.glow);
    P(e.x, e.y, 0, 0, 1.1, 420 * k, MARK_GLOW[e.mark] || e.def.glow, RING);
    P(e.x, e.y, 0, 0, 0.8, 300 * k, C.white, RING);
    P(e.x, e.y, 0, 0, 0.6, 320 * k, C.white, GLOW);
    Sfx.play('bigExplode');
    shake(1);
    UI.flash('white');
    Input.vibrate([80, 40, 160]);
    stats.bosses += 1;
    stats.kills += 1;
    Trophies.boss(e.kind);
    if (!wave.hurt) Trophies.unlock('flawless');
    const pts = addScore(e.score * e.level);
    popup(e.x, e.y, '+' + fmt(pts), '#ffe066', 18, 2);
    // every boss you beat makes your guns hit harder, keeping pace with tougher mobs
    player.power = Math.round((player.power + 0.12) * 100) / 100;
    popup(player.x, player.y - player.h * 1.4, `POWER ${Math.round(player.power * 100)}%`, '#ffe066', 12, 1.8);
    nova = 100;
    checkNovaReady();
    if (player.weapon < 5) { spawnPickup('star', e.x, e.y); starOut = true; }
    spawnPickup('heart', e.x - 40 * k, e.y);
    if (!player.totem && !totemOut) { spawnPickup('totem', e.x + 40 * k, e.y); totemOut = true; }
    else spawnPickup(pick(POWER_POOL), e.x + 40 * k, e.y);
    for (let i = 0; i < 8; i++) spawnPickup('gem', e.x + rand(-60, 60) * k, e.y + rand(-30, 30) * k, rand(-160, 160) * k, rand(-260, -80) * view.vs);
  }

  // ---- hits, kills, drops
  function hits(e, x, y, r) {
    const dx = x - e.x;
    const dy = y - e.y;
    if (e.T.boss) {
      const g = e.grow || 0.01;
      const ax = e.w * 0.42 * g + r;
      const ay = e.h * 0.4 * g + r;
      return (dx * dx) / (ax * ax) + (dy * dy) / (ay * ay) < 1;
    }
    const rr = e.r * e.scale + r;
    return dx * dx + dy * dy < rr * rr;
  }
  function comboMult() { return Math.min(8, 1 + Math.floor(Math.sqrt(combo / 2.2))); }
  function resetCombo() { combo = 0; comboT = 0; lastMult = 1; }
  function checkNovaReady() {
    if (nova >= 100 && !novaReadyShown && player && player.alive) {
      novaReadyShown = true;
      popup(player.x, player.y - player.h * 1.1, 'NOVA READY', '#ff6ad5', 11, 1.3);
      Sfx.play('ready');
    }
  }
  const chargesNova = (src) => novaLock === 0 && src !== 'nova';

  function hurtEnemy(e, dmg, hx, hy, src = 'bullet') {
    if (e.dead || e.inv || e.mode === 'dying' || e.mode === 'enter') return;
    if (e.type === 'enderman' && src === 'bullet' && e.dodgeCd <= 0 && e.mode !== 2 && Math.random() < 0.3) {
      popup(e.x, e.y - e.h * 0.6, 'DODGE', '#d65bf2', 9, 0.7);
      e.dodgeCd = 1.4;
      enderTeleport(e, false);
      return;
    }
    let armored = false;
    if (e.type === 'shulker' && e.open < 0.5 && src !== 'nova' && src !== 'storm') { dmg *= 0.25; armored = true; }
    if (e.armor && src === 'bullet') { dmg *= 0.5; armored = true; }
    e.hp -= dmg;
    if (!e.T.boss) e.flash = 0.1;
    else if (!(e.flashCd > 0)) { e.flash = 0.06; e.flashCd = 0.16; } // bosses blink briefly instead of staying white under fire
    if (!e.T.boss && e.type !== 'slime' && e.type !== 'magmacube' && !e.T.persist) e.y -= 3 * view.k;
    const n = hiQ ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.2, 1.2);
      const sp = rand(120, 380) * view.k;
      P(hx, hy, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.12, 0.25), rand(1.5, 2.6) * view.k, armored ? C.grey : pick(e.T.pal), SPARK, 4);
    }
    Sfx.play(armored ? 'armor' : 'hit');
    if (e.T.boss && chargesNova(src)) nova = Math.min(100, nova + 0.12);
    if (e.hp <= 0) killEnemy(e, src);
  }
  function killEnemy(e, src) {
    if (e.T.boss) { startBossDeath(e); return; }
    e.dead = true;
    const k = view.k;
    if (e.type === 'illusion') {
      burst(e.x, e.y, C.blue, 14);
      P(e.x, e.y, 0, 0, 0.4, 90 * k, C.blue, RING);
      popup(e.x, e.y, 'FAKE!', '#8fb0ff', 11, 0.9);
      Sfx.play('pop');
      return;
    }
    const s = e.type === 'evoker' || e.type === 'ghast' ? 1.7 : e.type === 'vex' || e.type === 'phantom' ? 0.75 : 1.1;
    if (e.type !== 'creeper') {
      explode(e.x, e.y, e.T.pal, s * (e.elite ? 1.4 : 0.85), e.elite ? C.gold : e.T.glow);
      shatter(e);
      Sfx.play('explode', s);
      shake(0.1 * s);
    }
    if (blastDepth > 0) blastKills += 1;
    stats.kills += 1;
    if (stats.kills === 1) Trophies.unlock('first');
    if (src === 'storm') { stats.storm += 1; if (stats.storm >= 15) Trophies.unlock('storm'); }
    combo += 1;
    comboT = COMBO_TIME;
    if (combo > stats.maxCombo) stats.maxCombo = combo;
    const mult = comboMult();
    if (mult > lastMult && player.alive) {
      popup(player.x, player.y - player.h * 0.9, `x${mult} COMBO!`, MULT_COL[mult], 12, 1.1);
      Sfx.play('combo', mult);
      if (mult >= 8) Trophies.unlock('combo');
    }
    lastMult = mult;
    const pts = addScore(e.score * mult);
    popup(e.x, e.y - e.h * 0.2, (e.elite ? 'ELITE +' : '+') + fmt(pts), e.elite ? '#ffe066' : MULT_COL[mult], mult > 3 || e.elite ? 12 : 10);
    if (chargesNova(src)) {
      nova = Math.min(100, nova + (e.type === 'evoker' || e.type === 'ghast' || e.elite ? 8 : 3.5));
      checkNovaReady();
    }
    if (e.elite) { stats.elites += 1; Trophies.add('elites'); }
    if (e.type === 'crystal') {
      popup(e.x, e.y, 'CRYSTAL SHATTERED!', '#ff6ad5', 11, 1.2);
      explode(e.x, e.y, PAL.crystal, 1.8, C.pink);
      if (boss && boss.kind === 'dragon') hurtEnemy(boss, boss.maxHp * 0.04, boss.x, boss.y, 'blast');
    }
    if (!e.T.persist && e.type !== 'shrieker') rollDrops(e);
    if (e.type === 'creeper') creeperBlast(e, true);
    if (e.type === 'slime' || e.type === 'magmacube') {
      Trophies.add('slimes');
      if (e.size > 1) {
        for (const side of [-1, 1]) {
          const c = spawnEnemy(e.type, e.x + side * 14 * k, e.y, { size: e.size - 1, noElite: true });
          c.spawn = 0.2;
          c.gy = e.y;
          c.mode = 1;
          c.hop = 0;
          c.hdur = 0.45;
          c.hh = 50 * k;
          c.hx0 = c.x;
          c.hx1 = clamp(c.x + side * 80 * k, c.w / 2, view.w - c.w / 2);
        }
      }
    }
  }
  /** Generic explosion that hurts mobs and sets off other shootable projectiles. */
  function blast(x, y, R, dmg, pal, gc, byPlayer, label, pts) {
    blastDepth += 1;
    explode(x, y, pal, R / (80 * view.k), gc);
    P(x, y, 0, 0, 0.45, R, gc, RING);
    Sfx.play('explode', 1.5);
    shake(0.3);
    for (const o of enemies) {
      if (o.dead) continue;
      const rr = R + o.r;
      if (dist2(o.x, o.y, x, y) < rr * rr) hurtEnemy(o, dmg, o.x, o.y, 'blast');
    }
    for (const o of ebullets) {
      if (!o.dead && o.hp && dist2(o.x, o.y, x, y) < R * R) popShootable(o, byPlayer);
    }
    if (byPlayer && pts) { const v = addScore(pts); popup(x, y, `${label} +${v}`, '#ffab40', 10); }
    blastDepth -= 1;
    if (blastDepth === 0) {
      if (blastKills >= 4) Trophies.unlock('demolition');
      blastKills = 0;
    }
  }
  function popShootable(t, byPlayer) {
    t.dead = true;
    const k = view.k;
    switch (t.kind) {
      case 'tnt': blast(t.x, t.y, 100 * k, 6 * player.power, PAL.tnt, C.orange, byPlayer, 'BOOM!', 50); break;
      case 'ghastball':
        if (byPlayer) blast(t.x, t.y, (t.big ? 170 : 125) * k, (t.big ? 20 : 9) * player.power, PAL.fire, C.orange, true, 'DEFLECTED!', t.big ? 400 : 150);
        else fuseBurst(t);
        break;
      case 'bskull': blast(t.x, t.y, 70 * k, 4 * player.power, PAL.bskull, C.blue, byPlayer, 'SHATTERED!', 60); break;
      default:
        spark(t.x, t.y, t.c, 6);
        P(t.x, t.y, 0, 0, 0.3, 30 * k, t.kind === 'hfire' ? C.orange : C.purple, RING);
        if (byPlayer) { const v = addScore(20); popup(t.x, t.y, '+' + v, '#e8e09a', 8, 0.6); }
        Sfx.play('pop');
        break;
    }
  }
  function creeperBlast(e, byPlayer) {
    e.dead = true;
    const k = view.k;
    const R = 125 * k;
    blastDepth += 1;
    explode(e.x, e.y, PAL.creeper, 2, C.green);
    shatter(e);
    P(e.x, e.y, 0, 0, 0.5, R * 1.1, C.white, RING);
    Sfx.play('explode', 1.8);
    shake(0.45);
    Input.vibrate(30);
    if (!byPlayer && player.alive && dist2(e.x, e.y, player.x, player.y) < (R * 0.8) * (R * 0.8)) hurtPlayer();
    // chain reaction
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const rr = R + o.r;
      if (dist2(o.x, o.y, e.x, e.y) < rr * rr) hurtEnemy(o, 6 * player.power, o.x, o.y, 'blast');
    }
    for (const t of ebullets) {
      if (!t.dead && t.hp && dist2(t.x, t.y, e.x, e.y) < R * R) popShootable(t, true);
    }
    blastDepth -= 1;
    if (blastDepth === 0) {
      if (blastKills >= 4) Trophies.unlock('demolition');
      blastKills = 0;
    }
  }
  function escaped(e) {
    if (state !== 'playing') return;
    stats.escaped += 1;
    if (combo >= 3) popup(e.x, view.h - 40 * view.k, 'COMBO LOST', '#ff4d5e', 10, 1);
    resetCombo();
    P(e.x, view.h, 0, 0, 0.5, 60 * view.k, C.red, GLOW);
  }
  function rollDrops(e) {
    if (player.weapon < 5 && !starOut && stats.kills >= WEAPON_KILLS[player.weapon]) {
      spawnPickup('star', e.x, e.y);
      starOut = true;
      return;
    }
    const luck = e.type === 'evoker' || e.type === 'ghast' ? 3 : 1;
    if (!player.totem && !totemOut && Math.random() < 0.005 * luck) {
      spawnPickup('totem', e.x, e.y);
      totemOut = true;
      return;
    }
    if (e.elite) {
      spawnPickup(Math.random() < 0.7 ? pick(POWER_POOL) : 'gem', e.x, e.y);
      return;
    }
    const r = Math.random();
    const gem = 0.1 * luck;
    const power = gem + 0.024 * luck;
    const heart = power + 0.018 * luck;
    if (r < gem) spawnPickup('gem', e.x, e.y);
    else if (r < power) spawnPickup(pick(POWER_POOL), e.x, e.y);
    else if (r < heart && player.hp < player.maxHp) spawnPickup('heart', e.x, e.y);
  }

  function updateEnemies(dt) {
    const p = player;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead) continue;
      e.t += dt;
      if (e.spawn < 1) e.spawn = Math.min(1, e.spawn + dt * 3.5);
      if (e.flash > 0) e.flash -= dt;
      if (e.flashCd > 0) e.flashCd -= dt;
      if (e.elite && hiQ && Math.random() < dt * 6) P(e.x + rand(-0.5, 0.5) * e.w, e.y + rand(-0.5, 0.5) * e.h, 0, -40 * view.k, 0.5, 6 * view.k, C.gold, GLOW, 1);
      if (e.T.boss) bossUpdate(e, dt);
      else BEHAVIOR[e.type](e, dt);
      if (e.dead) continue;
      if (p.alive && p.intro === 0 && e.mode !== 'dying' && e.mode !== 'enter' && e.type !== 'crystal' && hits(e, p.x, p.y, p.r * 1.8)) {
        if (e.type === 'creeper') {
          creeperBlast(e, false);
          continue;
        }
        const res = hurtPlayer();
        if (res && !e.T.boss) hurtEnemy(e, res === 1 ? 8 : 3, e.x, e.y, 'ram');
      }
      if (e.T.boss || e.dead || e.T.persist) continue;
      if (e.y - e.h / 2 > view.h + 10) { e.dead = true; escaped(e); }
      else if (e.x < -e.w * 2 || e.x > view.w + e.w * 2 || e.t > 45) e.dead = true;
    }
  }

  // ---- per-mob extras
  function drawRods(e, front) {
    const k = view.k;
    const rw = 6 * k;
    const rh = 18 * k;
    world();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 8; i++) {
      const rng = i < 4 ? 0 : 1;
      const a = e.rodA * (rng ? -1 : 1) + (i % 4) * (TAU / 4) + rng * 0.4;
      const depth = Math.sin(a);
      if ((depth > 0) !== front) continue;
      const R = e.w * (rng ? 0.5 : 0.66);
      const x = e.x + Math.cos(a) * R;
      const y = e.y + (rng ? e.h * 0.42 : e.h * 0.05) + depth * R * 0.25;
      ctx.fillStyle = front ? '#ffcf3a' : '#a8741a';
      ctx.fillRect(x - rw / 2, y - rh / 2, rw, rh);
      ctx.fillStyle = front ? '#fff2a8' : '#c99532';
      ctx.fillRect(x - rw / 2, y - rh / 2, rw * 0.4, rh);
    }
  }
  function drawTentacles(e) {
    const k = view.k;
    const n = 7;
    const bw = e.w * 0.09;
    world();
    ctx.globalAlpha = 1;
    for (let i = 0; i < n; i++) {
      const bx = e.x - e.w * 0.4 + (i + 0.5) * ((e.w * 0.8) / n);
      for (let s = 0; s < 3; s++) {
        const sway = Math.sin(e.t * 2.2 + i * 0.9 + s * 0.6) * (s + 1) * 2.2 * k * (e.w / (84 * k));
        ctx.fillStyle = s % 2 ? '#d4d4d4' : '#ececec';
        ctx.fillRect(bx - bw / 2 + sway, e.y + e.h * 0.48 + s * bw, bw, bw);
      }
    }
  }
  function drawShell(e, sx, sy) {
    const closed = 1 - e.open;
    if (closed <= 0.02) return;
    at(e.x, e.y, sx, sy, e.rot);
    ctx.globalAlpha = 1;
    const w = e.w;
    const h = e.h * 0.25 * closed;
    const edge = Math.max(1, h * 0.22);
    ctx.fillStyle = '#8a5d8a';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#b98fb9';
    ctx.fillRect(-w / 2, -h / 2, w, edge);
    ctx.fillStyle = '#5e3b5e';
    ctx.fillRect(-w / 2, h / 2 - edge, w, edge);
  }

  function drawEnemies() {
    const k = view.k;
    ctx.globalCompositeOperation = 'lighter';
    for (const e of enemies) {
      const big = Math.max(e.w, e.h);
      if (e.T.boss) {
        const def = e.def;
        const pulse = def.pulse ? def.pulse(e) : 0.3 + 0.2 * Math.sin(time * 3);
        glow(MARK_GLOW[e.mark] || def.glow, e.x, e.y, big * 0.95 * Math.max(0.2, e.grow), 0.3 + pulse * 0.35);
        if (e.mouth > 0) glow(def.mouthColor || C.white, e.x, e.y + e.h * (def.mouthY || 0), 90 * k, e.mouth * 2);
        if (def.glowFx && e.mode !== 'dying') def.glowFx(e);
        if (e.armor) glow(C.blue, e.x, e.y, big * 0.8, 0.22 + 0.08 * Math.sin(time * 4));
        continue;
      }
      glow(e.T.glow, e.x, e.y, big * 0.8, e.type === 'crystal' ? 0.5 + 0.2 * Math.sin(time * 6) : 0.2);
      if (e.elite) glow(C.gold, e.x, e.y, big * 1.05, 0.28 + 0.14 * Math.sin(time * 6 + e.ph));
      if (e.charge > 0) {
        if (e.type === 'enderman') {
          glow(C.pink, e.x - e.w * 0.28, e.y + e.h * 0.06, 22 * k * e.charge, e.charge);
          glow(C.pink, e.x + e.w * 0.28, e.y + e.h * 0.06, 22 * k * e.charge, e.charge);
        } else if (e.type === 'ghast') {
          glow(C.red, e.x, e.y + e.h * 0.25, 44 * k * e.charge, e.charge);
        } else {
          glow(e.type === 'shrieker' || e.type === 'guardian' ? C.cyan : C.white, e.x, e.y + e.h * 0.3, 26 * k * e.charge, e.charge);
        }
      }
      if (e.type === 'blaze') glow(C.orange, e.x, e.y + e.h * 0.2, big * (0.7 + e.heat * 0.5), 0.15 + e.heat * 0.45);
      if (e.type === 'creeper' && e.fuse > 0) glow(C.white, e.x, e.y, big * (1 + e.fuse), e.fuse * 0.5);
      if (e.type === 'shulker' && e.open > 0.3) glow(C.gold, e.x, e.y, 30 * k, e.open * 0.4);
      if (e.type === 'evoker' && e.casting) {
        glow(C.purple, e.x, e.y + e.h * 0.1, 70 * k, 0.55 + 0.3 * Math.sin(time * 20));
        world();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#c78bff';
        ctx.lineWidth = 2 * k;
        ctx.setLineDash([6 * k, 6 * k]);
        ctx.lineDashOffset = -time * 60;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.h * 0.1, 46 * k, 18 * k, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (const e of enemies) {
      if (e.T.boss) drawBoss(e);
      else drawEnemy(e);
    }
  }
  function drawBoss(e) {
    const def = e.def;
    const k = view.k;
    const s0 = Math.max(0.05, e.grow);
    let sx = s0;
    let sy = s0;
    if (def.scale) {
      const s = def.scale(e, s0);
      sx = s[0];
      sy = s[1];
    } else if (def.pulse) {
      const b = def.pulse(e);
      sx = sy = s0 * (1 + b * 0.035);
    }
    const img = sprite(def.img, e.w, e.h);
    if (def.drawBack) def.drawBack(e, sx, sy);
    ctx.globalAlpha = 1;
    blit(img, e.x, e.y, e.w, e.h, e.rot, sx, sy);
    const tint = MARK_TINT[e.mark];
    if (tint) {
      ctx.globalAlpha = 0.24 + 0.1 * Math.sin(time * 3);
      blit(sprite(def.img, e.w, e.h, tint), e.x, e.y, e.w, e.h, e.rot, sx, sy);
    }
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(1, e.flash / 0.06) * 0.4;
      blit(sprite(def.img, e.w, e.h, 'white'), e.x, e.y, e.w, e.h, e.rot, sx, sy);
    }
    if (e.phase === 3 && e.mode === 'fight') {
      ctx.globalAlpha = 0.16 + 0.12 * Math.sin(time * 8);
      blit(sprite(def.img, e.w, e.h, 'red'), e.x, e.y, e.w, e.h, e.rot, sx, sy);
    }
    ctx.globalAlpha = 1;
    if (def.crown) {
      const cw = e.w * 0.46;
      const ch = cw * (5 / 9);
      blit(sprite('crown', cw, ch), e.x, e.y - (e.h * 0.5 + ch * 0.25) * sy + Math.sin(time * 2) * 3 * k, cw, ch, e.rot, sx, sy);
    }
    if (def.drawFront) def.drawFront(e, sx, sy);
    if (e.armor && e.mode === 'fight') {
      world();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#a8c4ff';
      ctx.lineWidth = 2 * k;
      ctx.setLineDash([14 * k, 10 * k]);
      ctx.lineDashOffset = -time * 40;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.w * 0.56, e.h * 0.6, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }
  function drawEnemy(e) {
    const k = view.k;
    const s0 = (e.spawn < 1 ? Math.max(0.05, easeOutBack(e.spawn)) : 1) * e.scale;
    let sx = s0;
    let sy = s0;
    const img = sprite(e.T.img, e.w, e.h, e.T.tint);
    switch (e.type) {
      case 'vex':
      case 'phantom': {
        sx *= 1 + Math.sin(e.t * 26) * 0.1;
        const gc = sprite(e.T.img, e.w, e.h, e.type === 'vex' ? 'cyan' : 'red');
        for (let i = 0; i < e.trail.length; i++) {
          const tr = e.trail[i];
          ctx.globalAlpha = 0.1 * (i + 1);
          blit(gc, tr.x, tr.y, e.w, e.h, e.rot, sx * 0.9, sy * 0.9);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'slime':
      case 'magmacube':
        sx *= 1 + e.sq * 0.22;
        sy *= 1 - e.sq * 0.22;
        if (e.mode === 1) {
          const lift = clamp((e.gy - e.y) / Math.max(1, e.hh), 0, 1);
          world();
          ctx.globalAlpha = 0.28 * (1 - lift * 0.5);
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.ellipse(e.x, e.gy + e.h * 0.42, e.w * 0.42 * (1 - lift * 0.4), e.h * 0.1, 0, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        break;
      case 'blaze': drawRods(e, false); break;
      case 'ghast': drawTentacles(e); break;
      default: break;
    }
    if (e.elite) {
      ctx.globalAlpha = 0.5 + 0.25 * Math.sin(time * 6 + e.ph);
      blit(sprite(e.T.img, e.w, e.h, 'gold'), e.x, e.y, e.w, e.h, e.rot, sx * 1.14, sy * 1.14);
      ctx.globalAlpha = 1;
    }
    blit(img, e.x, e.y, e.w, e.h, e.rot, sx, sy);
    let fa = e.flash > 0 ? Math.min(1, e.flash / 0.1) * 0.85 : 0;
    if (e.type === 'creeper' && e.fuse > 0 && Math.sin(e.t * (12 + e.fuse * 45)) > 0) fa = Math.max(fa, Math.min(0.85, 0.3 + e.fuse));
    if (fa > 0) {
      ctx.globalAlpha = fa;
      blit(sprite(e.T.img, e.w, e.h, 'white'), e.x, e.y, e.w, e.h, e.rot, sx, sy);
      ctx.globalAlpha = 1;
    }
    if (e.type === 'blaze') drawRods(e, true);
    if (e.type === 'shulker') drawShell(e, sx, sy);
    if (e.type === 'enderman' && e.mode === 1) {
      world();
      ctx.globalAlpha = 0.35 + e.charge * 0.5;
      ctx.strokeStyle = '#d65bf2';
      ctx.lineWidth = 2 * k;
      ctx.setLineDash([8 * k, 8 * k]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.lx, e.ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (e.elite) {
      at(e.x, e.y - e.h * 0.72, 1, 1, Math.PI / 4 + Math.sin(time * 3) * 0.2);
      const d = 6 * k;
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-d / 2, -d / 2, d, d);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(-d / 2, -d / 2, d * 0.4, d * 0.4);
    }
    if (e.type !== 'illusion' && (e.maxHp >= 4 || e.elite) && e.hp < e.maxHp && e.hp > 0) {
      const bw = e.w * 0.8;
      const bh = 4 * k;
      const bx = e.x - bw / 2;
      const by = e.y - e.h * 0.62;
      const r = e.hp / e.maxHp;
      world();
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = r > 0.5 ? '#6dff9a' : r > 0.25 ? '#ffe066' : '#ff4d5e';
      ctx.fillRect(bx, by, bw * r, bh);
    }
  }
  /** Little arrows at the top edge for mobs and boulders about to fly in. */
  function drawIncoming() {
    const k = view.k;
    world();
    const mark = (x, color, ph) => {
      const cx = clamp(x, 14 * k, view.w - 14 * k);
      const y = 6 * k;
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(time * 10 + ph);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - 7 * k, y);
      ctx.lineTo(cx + 7 * k, y);
      ctx.lineTo(cx, y + 8 * k);
      ctx.closePath();
      ctx.fill();
    };
    for (const e of enemies) {
      if (e.T.boss || e.dead || e.y + e.h / 2 > 0 || e.y < -320 * k) continue;
      mark(e.x, e.elite ? '#ffd23f' : e.T.glow.s, e.ph);
    }
    for (const b of ebullets) {
      if ((b.kind === 'rock' || b.kind === 'tear' || b.kind === 'arrow') && b.y < 0 && b.vy > 0) mark(b.x, b.kind === 'rock' ? '#c8cdd8' : '#ff4d5e', b.x);
    }
    ctx.globalAlpha = 1;
  }
  function drawDarkness() {
    if (dark < 0.02 || !player) return;
    const d = view.dpr;
    const k = view.k;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const px = player.x + camX;
    const py = player.y + camY;
    const pulse = 1 + Math.sin(time * 4) * 0.06;
    const g = ctx.createRadialGradient(px, py, 90 * k * pulse, px, py, 250 * k * pulse);
    g.addColorStop(0, 'rgba(1,3,6,0)');
    g.addColorStop(1, `rgba(1,3,6,${0.94 * dark})`);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  // ================================================================ bullets
  function nearestEnemy(x, y) {
    let best = null;
    let bd = Infinity;
    for (const e of enemies) {
      if (e.dead || e.inv || e.y < 0 || e.mode === 'dying') continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function updateBullets(dt) {
    const k = view.k;
    for (const b of bullets) {
      if (b.dead) continue;
      if (b.homing) {
        const t = nearestEnemy(b.x, b.y);
        let ang = Math.atan2(b.vy, b.vx);
        if (t) ang = turnToward(ang, Math.atan2(t.y - b.y, t.x - b.x), b.turn * dt);
        const spd = Math.min(b.speed, Math.hypot(b.vx, b.vy) + 1800 * k * dt);
        b.vx = Math.cos(ang) * spd;
        b.vy = Math.sin(ang) * spd;
        b.rot = ang + Math.PI / 4;
        if (!b.orb) {
          b.trail -= dt;
          if (b.trail <= 0) { b.trail = 0.02; P(b.x, b.y, rand(-20, 20) * k, rand(-20, 20) * k, 0.3, 7 * k, C.green, GLOW); }
        }
      } else {
        b.rot += b.spin * dt;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y < -50 || b.y > view.h + 50 || b.x < -50 || b.x > view.w + 50) { b.dead = true; continue; }
      for (const e of enemies) {
        if (e.dead || e === b.last || e.mode === 'dying') continue;
        // Blaze King's rods physically block shots
        if (e.T.boss && e.def.block && e.mode === 'fight' && dist2(b.x, b.y, e.x, e.y) < e.w * e.w && e.def.block(e, b)) { b.dead = true; break; }
        if (!hits(e, b.x, b.y, b.r)) continue;
        if (e.inv) { b.dead = true; spark(b.x, b.y, C.white, 2); break; }
        hurtEnemy(e, b.dmg, b.x, b.y, b.src);
        if (b.pierce > 0) { b.pierce -= 1; b.last = e; } else { b.dead = true; break; }
      }
      if (b.dead) continue;
      for (const t of ebullets) {
        if (t.dead || !t.hp) continue;
        const rr = t.r + b.r;
        if (dist2(b.x, b.y, t.x, t.y) < rr * rr) {
          b.dead = true;
          t.hp -= b.dmg;
          spark(b.x, b.y, t.c, 3);
          if (t.hp <= 0) popShootable(t, true);
          break;
        }
      }
    }
  }
  function drawBullets() {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of bullets) {
      glow(b.col, b.x, b.y, b.s * 1.2, 0.55);
      // comet tail: a wide faint stroke under a thin bright core
      world();
      ctx.strokeStyle = b.col.s;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = b.s * 0.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = b.s * 0.16;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (const b of bullets) {
      if (b.orb) {
        at(b.x, b.y);
        ctx.drawImage(orbTex(b.orb), -b.s / 2, -b.s / 2, b.s, b.s);
      } else {
        blit(b.c, b.x, b.y, b.s, b.s, b.rot);
      }
    }
  }

  function onGraze(b) {
    const p = player;
    stats.grazes += 1;
    if (stats.grazes === 100) Trophies.unlock('graze');
    nova = Math.min(100, nova + 1.5);
    addScore(10 * comboMult());
    P((b.x + p.x) / 2, (b.y + p.y) / 2, rand(-80, 80) * view.k, rand(-80, 80) * view.k, 0.25, 8 * view.k, C.white, GLOW);
    Sfx.play('graze');
    checkNovaReady();
  }
  function updateEBullets(dt) {
    const p = player;
    const k = view.k;
    const shieldR = p.w * 0.62;
    const grazeR = 26 * k;
    for (const b of ebullets) {
      if (b.dead) continue;
      const d = EB[b.kind];
      b.t += dt;
      b.life -= dt;
      const hom = d.homing || b.home;
      if (hom && p.alive) {
        const sp = Math.hypot(b.vx, b.vy);
        const ang = turnToward(Math.atan2(b.vy, b.vx), Math.atan2(p.y - b.y, p.x - b.x), hom * dt);
        b.vx = Math.cos(ang) * sp;
        b.vy = Math.sin(ang) * sp;
      }
      if (b.g) b.vy += b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.spin) b.rot += b.spin * dt;
      if (b.fuse > 0) {
        b.fuse -= dt;
        if (b.fuse <= 0 || (p.alive && b.y > p.y - 70 * k && Math.abs(b.x - p.x) < 220 * k)) { fuseBurst(b); continue; }
      }
      if (b.kind === 'lavab' && b.vy > 0 && b.y >= b.ty) {
        b.dead = true;
        addHazard('lava', b.x, b.y, 50 * k, 3);
        explode(b.x, b.y, PAL.magma, 0.6, C.orange);
        continue;
      }
      if (b.life <= 0) { b.dead = true; spark(b.x, b.y, b.c, 3); continue; }
      if (b.y > view.h + 40 || b.y < -360 * k || b.x < -60 || b.x > view.w + 60) { b.dead = true; continue; }
      if (!p.alive || p.intro > 0) continue;
      const d2 = dist2(b.x, b.y, p.x, p.y);
      if (buffs.shield > 0) {
        const sr = shieldR + b.r;
        if (d2 < sr * sr) {
          if (b.hp) popShootable(b, true);
          else { b.dead = true; spark(b.x, b.y, C.cyan, 5); }
          Sfx.play('shield');
          continue;
        }
      }
      const hr = b.r + p.r;
      if (d2 < hr * hr) {
        if (hurtPlayer()) {
          b.dead = true;
          if (b.kind === 'tnt') popShootable(b, false);
          else if (b.kind === 'dfire') fuseBurst(b);
          else if (b.kind === 'ghastball' || b.kind === 'wskull' || b.kind === 'bskull' || b.kind === 'rock') explode(b.x, b.y, b.kind === 'bskull' ? PAL.bskull : b.kind === 'rock' ? PAL.ravager : PAL.fire, 0.8, b.c);
        }
      } else if (!b.grazed && d2 < (hr + grazeR) * (hr + grazeR)) {
        b.grazed = true;
        onGraze(b);
      }
    }
  }
  function drawEBullets() {
    const k = view.k;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of ebullets) {
      if (b.kind === 'rock') continue;
      const f = b.kind === 'tnt' ? 2.2 : b.kind === 'ghastball' ? 2.6 : 3.2;
      glow(b.c, b.x, b.y, b.r * f, b.kind === 'arrow' ? 0.35 : b.kind === 'wskull' ? 0.45 : 0.6);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (const b of ebullets) {
      switch (b.kind) {
        case 'orb':
        case 'magic':
        case 'shard':
        case 'tear':
        case 'lavab':
        case 'dfire': {
          const r = b.r * (b.kind === 'magic' || b.kind === 'dfire' ? 1.25 + 0.15 * Math.sin(b.t * 18) : 1.3);
          at(b.x, b.y);
          ctx.drawImage(orbTex(b.c), -r, -r, r * 2, r * 2);
          break;
        }
        case 'spike': {
          const L = 11 * k;
          at(b.x, b.y, 1, 1, b.rot);
          ctx.fillStyle = '#ffb36b';
          ctx.beginPath();
          ctx.moveTo(L, 0);
          ctx.lineTo(-L * 0.6, -4 * k);
          ctx.lineTo(-L * 0.3, 0);
          ctx.lineTo(-L * 0.6, 4 * k);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'arrow': {
          const L = 13 * k;
          at(b.x, b.y, 1, 1, b.rot);
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#e9ecf5';
          ctx.lineWidth = 2.2 * k;
          ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L * 0.6, 0); ctx.stroke();
          ctx.strokeStyle = '#9aa3b8';
          ctx.beginPath();
          ctx.moveTo(-L, 0); ctx.lineTo(-L - 4 * k, -3 * k);
          ctx.moveTo(-L, 0); ctx.lineTo(-L - 4 * k, 3 * k);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L * 0.35, -4 * k); ctx.lineTo(L * 0.35, 4 * k); ctx.closePath(); ctx.fill();
          break;
        }
        case 'sonic': {
          const s = b.r * 2.8;
          blit(sprite('sonic', s, s), b.x, b.y, s, s, b.rot - Math.PI / 4);
          break;
        }
        case 'fire':
        case 'hfire': {
          const s = b.r * 2.6;
          blit(sprite('b2', s, s), b.x, b.y, s, s, b.t * 12);
          break;
        }
        case 'rock': {
          const s = b.r * 1.8;
          at(b.x, b.y, 1, 1, b.rot);
          ctx.fillStyle = '#6c6f78';
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.fillStyle = '#9ea2ad';
          ctx.fillRect(-s / 2, -s / 2, s, s * 0.3);
          ctx.fillStyle = '#4a4c54';
          ctx.fillRect(-s / 2, s * 0.25, s, s * 0.25);
          break;
        }
        case 'ghastball': {
          const s = b.r * 2.4;
          const pulse = 1 + Math.sin(b.t * 20) * 0.06;
          blit(sprite('b3', s, s), b.x, b.y, s, s, b.t * 4, pulse, pulse);
          if (b.fuse < 0.5 && Math.sin(b.t * 30) > 0) {
            ctx.globalAlpha = 0.5;
            blit(sprite('b3', s, s, 'white'), b.x, b.y, s, s, b.t * 4, pulse, pulse);
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 'shulk': {
          const r = b.r * 1.3;
          at(b.x, b.y, 1, 1, b.t * 6);
          ctx.drawImage(orbTex(C.white), -r, -r, r * 2, r * 2);
          ctx.strokeStyle = '#b98fb9';
          ctx.lineWidth = 2 * k;
          ctx.beginPath();
          ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0);
          ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8);
          ctx.stroke();
          break;
        }
        case 'wskull':
        case 'bskull': {
          const s = b.r * 2.2;
          blit(sprite(b.kind, s, s), b.x, b.y, s, s, Math.sin(b.t * (b.kind === 'wskull' ? 10 : 6)) * 0.22);
          break;
        }
        case 'tnt': {
          const s = b.r * 2.1;
          blit(sprite('tnt', s, s), b.x, b.y, s, s, b.rot);
          if (Math.sin(b.t * 14) > 0.3) {
            ctx.globalAlpha = 0.55;
            blit(sprite('tnt', s, s, 'white'), b.x, b.y, s, s, b.rot);
            ctx.globalAlpha = 1;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  // ================================================================ pickups
  function spawnPickup(type, x, y, vx, vy) {
    pickups.push({
      type, x, y, vx: vx === undefined ? rand(-40, 40) * view.k : vx, vy: vy === undefined ? -120 * view.vs : vy,
      t: 0, bob: 0, ph: rand(TAU), r: 18 * view.k, dead: false,
    });
  }
  function updatePickups(dt) {
    const p = player;
    const k = view.k;
    for (const pk of pickups) {
      if (pk.dead) continue;
      pk.t += dt;
      pk.bob = Math.sin(pk.t * 4 + pk.ph) * 4 * k;
      let pulled = false;
      if (p && p.alive && p.intro === 0) {
        const dx = p.x - pk.x;
        const dy = p.y - pk.y;
        const d = Math.hypot(dx, dy) || 1;
        const magR = buffs.magnet > 0 ? 99999 : 110 * k;
        if (d < magR && pk.t > 0.25) {
          const sp = (buffs.magnet > 0 ? 900 : 620) * k;
          pk.x += (dx / d) * sp * dt;
          pk.y += (dy / d) * sp * dt;
          pulled = true;
        }
        if (d < p.w * 0.5 + pk.r) { pk.dead = true; applyPickup(pk); continue; }
      }
      if (!pulled) {
        pk.vx = damp(pk.vx, 0, 1.5, dt);
        pk.vy = damp(pk.vy, 70 * view.vs, 2, dt);
        pk.x += pk.vx * dt + Math.sin(pk.t * 2 + pk.ph) * 18 * k * dt;
        pk.y += pk.vy * dt;
      }
      if (pk.y > view.h + 40 || pk.x < -60 || pk.x > view.w + 60) {
        pk.dead = true;
        if (pk.type === 'star') starOut = false;
        if (pk.type === 'totem') totemOut = false;
      }
    }
  }
  function applyPickup(pk) {
    const p = player;
    const d = PK[pk.type];
    const k = view.k;
    let label = '';
    switch (pk.type) {
      case 'gem': label = '+' + addScore(250); break;
      case 'potion': buffs.double = BUFF_MAX.double; label = '2X SCORE!'; break;
      case 'booster': buffs.overdrive = BUFF_MAX.overdrive; label = 'OVERDRIVE!'; bg.warpT = 0.6; break;
      case 'shield': buffs.shield = BUFF_MAX.shield; label = 'SHIELD!'; break;
      case 'magnet': buffs.magnet = BUFF_MAX.magnet; label = 'MAGNET!'; break;
      case 'clock': buffs.timewarp = BUFF_MAX.timewarp; label = 'TIME WARP!'; break;
      case 'trident': buffs.storm = BUFF_MAX.storm; stormT = 0.15; label = 'THUNDERSTORM!'; break;
      case 'allay':
        if (buffs.drones <= 0) resetDrones();
        buffs.drones = BUFF_MAX.drones;
        label = 'ALLAY DRONES!';
        break;
      case 'totem':
        totemOut = false;
        if (!p.totem) { p.totem = true; label = 'TOTEM OF UNDYING'; }
        else label = '+' + addScore(1000);
        break;
      case 'heart':
        debuffs.fatigue = 0;
        if (p.hp < p.maxHp) { p.hp += 1; label = '+1 HEART'; }
        else if (p.maxHp < MAX_HEARTS) { p.maxHp += 1; p.hp += 1; label = 'MAX HEARTS UP!'; }
        else label = '+' + addScore(500);
        break;
      case 'star':
        starOut = false;
        if (p.weapon < 5) {
          p.weapon += 1;
          label = p.weapon === 5 ? 'MAX POWER!' : `WEAPON LV${p.weapon}`;
          if (p.weapon === 5) Trophies.unlock('maxpower');
        } else {
          p.power = Math.round((p.power + 0.1) * 100) / 100;
          buffs.overdrive = Math.max(buffs.overdrive, 4);
          label = `POWER ${Math.round(p.power * 100)}%`;
        }
        break;
      default:
        break;
    }
    Trophies.collect(pk.type);
    popup(p.x, p.y - p.h * 0.8, label, d.c.s, pk.type === 'gem' ? 10 : 12, 1.1);
    P(p.x, p.y, 0, 0, 0.4, 70 * k, d.c, RING);
    for (let i = 0; i < 8; i++) P(p.x, p.y, rand(-200, 200) * k, rand(-200, 200) * k, 0.35, 8 * k, d.c, GLOW);
    Sfx.play(pk.type === 'gem' ? 'pickup' : pk.type === 'star' ? 'levelup' : pk.type === 'totem' ? 'totem' : 'power');
    Input.vibrate(15);
  }
  function drawPickups() {
    const k = view.k;
    const s = 34 * k;
    ctx.globalCompositeOperation = 'lighter';
    for (const pk of pickups) glow(PK[pk.type].c, pk.x, pk.y + pk.bob, s * 1.35, 0.45 + 0.2 * Math.sin(pk.t * 5));
    ctx.globalCompositeOperation = 'source-over';
    for (const pk of pickups) {
      const d = PK[pk.type];
      const y = pk.y + pk.bob;
      ctx.globalAlpha = pk.y > view.h * 0.86 && Math.sin(pk.t * 22) > 0 ? 0.4 : 1;
      world();
      ctx.strokeStyle = d.c.s;
      ctx.lineWidth = 2 * k;
      const rr = s * 0.72;
      const a0 = pk.t * 3;
      ctx.beginPath(); ctx.arc(pk.x, y, rr, a0, a0 + 1.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(pk.x, y, rr, a0 + Math.PI, a0 + Math.PI + 1.6); ctx.stroke();
      const sc = 1 + Math.sin(pk.t * 6) * 0.06;
      blit(sprite(d.img, s, s * d.ar), pk.x, y, s, s * d.ar, Math.sin(pk.t * 2.5) * 0.15, sc, sc);
    }
    ctx.globalAlpha = 1;
  }

  // ================================================================ waves
  /** Mob health grows smoothly every wave (a bit faster after wave 10). */
  function mobHp(n) {
    return (1 + (n - 1) * 0.085 + Math.pow(Math.max(0, n - 10), 1.3) * 0.03) * diff.ehp;
  }
  function startWave(n) {
    wave.n = n;
    wave.cycle = Math.floor((n - 1) / 5);
    wave.boss = n % 5 === 0;
    wave.hpMul = mobHp(n);
    wave.spdMul = 1 + Math.min(0.6, (n - 1) * 0.025);
    wave.fireMul = (1 + Math.min(1.2, (n - 1) * 0.045)) * diff.fire;
    wave.spawned = 0;
    wave.cleared = 0;
    wave.budget = wave.boss ? 0 : Math.round(10 + n * 2.6 + wave.cycle * 3);
    wave.interval = Math.max(0.32, 1.1 - n * 0.045);
    wave.timer = 1.4;
    wave.hurt = false;
    wave.state = 'active';
    if (n >= 15) Trophies.unlock('survivor');
    if (n >= 10 && diffKey === 'hard') Trophies.unlock('hardcore');
    const zi = wave.cycle % ZONES.length;
    setZone(zi);
    if (wave.boss) {
      const def = nextBossDef();
      wave.bossT = 3.4;
      UI.banner('WARNING', def.warning, 'warning', 3200);
      Sfx.play('warning');
      Sfx.music(def.music);
      Input.vibrate([80, 80, 80, 80, 80]);
    } else {
      const pct = Math.round((wave.hpMul / diff.ehp - 1) * 100);
      UI.banner(`WAVE ${n}`, ZONES[zi].name + (pct > 0 ? `  ·  MOB HP +${pct}%` : ''), 'wave', 2200);
      Sfx.play('wave');
    }
  }
  function waveClear() {
    wave.state = 'clear';
    wave.breakT = 3.4;
    const perfect = !wave.hurt;
    const bonus = addScore(200 * wave.n * (perfect ? 2 : 1));
    UI.banner(wave.boss ? 'BOSS DEFEATED' : 'WAVE CLEAR', `+${fmt(bonus)}${perfect ? '  ·  PERFECT!' : ''}`, 'clear', 2400);
    Sfx.play('clear');
    bg.warpT = 1.8;
    if (perfect && wave.n >= 2) spawnPickup(pick(POWER_POOL), view.w / 2, -20, 0, 60 * view.vs);
    if (wave.boss) Sfx.music('game');
  }
  function updateWave(dt) {
    if (wave.state === 'clear') {
      wave.breakT -= dt;
      if (wave.breakT <= 0) startWave(wave.n + 1);
      return;
    }
    if (wave.boss) {
      if (wave.bossT > 0) {
        wave.bossT -= dt;
        if (wave.bossT <= 0) spawnBoss();
        return;
      }
      // from the second lap on, bosses bring escorts
      if (boss && boss.mode === 'fight' && boss.mark >= 2) {
        wave.timer -= dt;
        if (wave.timer <= 0) {
          wave.timer = 9;
          const x = rand(view.w * 0.2, view.w * 0.8);
          for (let i = 0; i < 3; i++) spawnEnemy('vex', x + (i - 1) * 40 * view.k, -30 * view.k, { noElite: true });
        }
      }
      if (!boss && enemies.length === 0) waveClear();
      return;
    }
    if (wave.spawned < wave.budget) {
      wave.timer -= dt;
      if (wave.timer <= 0) {
        const before = enemies.length;
        wave.spawned += spawnGroup();
        for (let i = before; i < enemies.length; i++) enemies[i].wb = true;
        wave.timer = wave.interval * rand(0.75, 1.25);
      }
    } else if (enemies.length === 0) {
      waveClear();
    }
  }
  function spawnGroup() {
    const n = wave.n;
    const k = view.k;
    const W = view.w;
    const m = 50 * k;
    if (n >= 2 && Math.random() < Math.min(0.4, 0.18 + n * 0.015)) {
      const forms = ['line', 'pair'];
      if (n >= 3) forms.push('vee', 'column');
      if (n >= 5) forms.push('slimes');
      if (n >= 6) forms.push('creepers');
      if (n >= 9) forms.push('blazes');
      switch (pick(forms)) {
        case 'line': {
          const c = clamp(Math.floor((W - 2 * m) / (78 * k)), 3, 6);
          const gap = (W - 2 * m) / c;
          for (let i = 0; i < c; i++) spawnEnemy('zombie', m + gap * (i + 0.5), -40 * k - (i % 2) * 24 * k);
          return c;
        }
        case 'pair':
          spawnEnemy('skeleton', W * 0.25, -40 * k);
          spawnEnemy('skeleton', W * 0.75, -40 * k);
          return 2;
        case 'vee': {
          const cx = rand(W * 0.25, W * 0.75);
          for (let i = 0; i < 5; i++) { const o = i - 2; spawnEnemy('vex', cx + o * 46 * k, -30 * k - Math.abs(o) * 34 * k); }
          return 5;
        }
        case 'column': {
          const x = rand(m * 1.5, W - m * 1.5);
          for (let i = 0; i < 4; i++) spawnEnemy('zombie', x, -40 * k - i * 64 * k);
          return 4;
        }
        case 'slimes':
          spawnEnemy('slime', W * 0.3, -50 * k);
          spawnEnemy('slime', W * 0.7, -80 * k);
          return 2;
        case 'creepers':
          for (let i = 0; i < 3; i++) spawnEnemy('creeper', W * (0.2 + i * 0.3), -40 * k - i * 30 * k);
          return 3;
        case 'blazes':
          spawnEnemy('blaze', W * 0.3, -40 * k);
          spawnEnemy('blaze', W * 0.7, -40 * k);
          return 2;
        default:
          break;
      }
    }
    const lap = Math.floor(n / 50);
    const type = weighted([
      ['zombie', 10],
      ['skeleton', n >= 2 ? 6 : 0],
      ['slime', n >= 3 ? 3.5 : 0],
      ['vex', n >= 3 ? 4 : 0],
      ['creeper', n >= 4 ? 5 : 0],
      ['blaze', n >= 6 ? 4 : 0],
      ['evoker', n >= 6 && countType('evoker') < 1 + lap ? 2.5 : 0],
      ['enderman', n >= 7 && countType('enderman') < 2 + lap ? 3 : 0],
      ['shulker', n >= 8 && countType('shulker') < 2 + lap ? 2.5 : 0],
      ['ghast', n >= 11 && countType('ghast') < 1 + Math.floor(n / 20) ? 2 : 0],
    ]);
    const x = rand(m, W - m);
    if (type === 'vex') {
      for (let i = 0; i < 3; i++) spawnEnemy('vex', clamp(x + (i - 1) * 40 * k, m, W - m), -30 * k - i * 20 * k);
      return 3;
    }
    if (type === 'enderman') {
      // endermen teleport straight in — never on top of the player
      let y = rand(0.1, 0.4) * view.h;
      if (player && Math.abs(player.x - x) < 160 * k && Math.abs(player.y - y) < 200 * k) y = Math.max(view.h * 0.08, player.y - 260 * k);
      const e = spawnEnemy('enderman', x, y);
      e.spawn = 0;
      burst(x, y, C.purple, hiQ ? 16 : 6, 200);
      Sfx.play('teleport');
      return 1;
    }
    spawnEnemy(type, x, -50 * k);
    return 1;
  }

  // ================================================================ flow
  function clearWorld() {
    enemies.length = 0;
    bullets.length = 0;
    ebullets.length = 0;
    pickups.length = 0;
    hazards.length = 0;
    popups.length = 0;
    ghosts.length = 0;
    bolts.length = 0;
    for (const p of parts) { p.img = null; pool.push(p); }
    parts.length = 0;
    boss = null;
    novaFx = null;
    dark = 0;
    darkT = 0;
    debuffs.fatigue = 0;
  }
  function start() {
    clearWorld();
    decor.length = 0;
    diffKey = DIFF[Settings.get('difficulty')] ? Settings.get('difficulty') : 'normal';
    diff = DIFF[diffKey];
    const hearts = clamp(Math.round(Settings.get('hearts') || 5), 1, MAX_HEARTS);
    // fewer hearts = bigger score bonus (1 heart x1.4, 10 hearts x0.75)
    heartMul = hearts <= 5 ? 1 + (5 - hearts) * 0.1 : 1 - (hearts - 5) * 0.05;
    score = 0;
    resetCombo();
    nova = 50;
    novaReadyShown = false;
    novaLock = 0;
    starOut = false;
    totemOut = false;
    seen = new Set(['zombie', 'skeleton', 'creeper', 'vex', 'evoker']);
    for (const key in buffs) buffs[key] = 0;
    stats = { kills: 0, grazes: 0, maxCombo: 0, bosses: 0, damage: 0, escaped: 0, novas: 0, dashes: 0, elites: 0, storm: 0, totems: 0 };
    bossLevel = 0;
    trauma = 0;
    hitstop = 0;
    slowT = 0;
    runTime = 0;
    dieT = 0;
    ets = 1;
    blastDepth = 0;
    blastKills = 0;
    player = makePlayer(hearts);
    Object.assign(wave, { n: 0, cycle: 0, boss: false, state: 'clear', breakT: 1.3, spawned: 0, budget: 0, cleared: 0, timer: 0, hpMul: 1, spdMul: 1, fireMul: 1 });
    setZone(0);
    bg.mix = 1;
    bg.warpT = 1.2;
    state = 'playing';
    Trophies.startRun();
    Input.reset();
    Sfx.duck(false);
    Sfx.music('game');
    lastT = performance.now();
    UI.onStart();
  }
  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    Input.reset();
    Sfx.duck(true);
    UI.showPause({ wave: wave.n, score: Math.floor(score), difficulty: diffKey });
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    Input.reset();
    Sfx.duck(false);
    lastT = performance.now();
    UI.onResume();
  }
  function toMenu() {
    state = 'menu';
    clearWorld();
    player = null;
    ets = 1;
    setZone(0);
    Sfx.duck(false);
    Sfx.music('menu');
  }
  function gameOver() {
    state = 'over';
    const s = Math.floor(score);
    if (s >= 100000) Trophies.unlock('legend');
    const prevBest = Scores.best();
    const entry = { score: s, wave: wave.n, kills: stats.kills, diff: diffKey, hearts: player.maxHp, date: Date.now() };
    const idx = Scores.submit(entry);
    UI.showGameOver({
      score: s, best: Math.max(prevBest, s), isBest: s > prevBest && s > 0, rankIndex: idx, entry,
      wave: wave.n, kills: stats.kills, maxCombo: stats.maxCombo,
      time: runTime, grazes: stats.grazes, bosses: stats.bosses, elites: stats.elites, top: Scores.top(5),
      trophies: Trophies.sessionUnlocks(), difficulty: diffKey,
    });
    Sfx.play('gameover');
    Sfx.music('menu');
  }

  // ================================================================ loop
  function handleActions() {
    if (Input.consume('pause')) {
      if (state === 'playing') pause();
      else if (state === 'paused' && UI.current === 'pause') resume();
    }
    if (Input.consume('mute')) {
      const m = Sfx.toggleMute();
      UI.toast(m ? 'SOUND OFF' : 'SOUND ON');
      UI.syncMute();
    }
    if (Input.consume('autofire') && state === 'playing') {
      const v = !Settings.get('autoFire');
      Settings.set('autoFire', v);
      UI.toast(v ? 'AUTO-FIRE ON' : 'AUTO-FIRE OFF · HOLD SPACE TO SHOOT');
    }
  }
  function update(dt, raw) {
    updateBackground(dt);
    if (state === 'menu') {
      updateDecor(dt);
      updateParticles(dt);
      return;
    }
    trauma = Math.max(0, trauma - raw * 1.6);
    const playing = state === 'playing';
    // Time Warp slows every mob, projectile, hazard and spawn timer — but not you
    ets = damp(ets, buffs.timewarp > 0 && playing ? 0.4 : 1, 6, dt);
    const edt = dt * ets;
    darkT = Math.max(0, darkT - edt);
    dark = damp(dark, darkT > 0 && boss ? 1 : 0, 3, dt);
    if (playing) {
      runTime += dt;
      for (const key in buffs) if (buffs[key] > 0) buffs[key] = Math.max(0, buffs[key] - dt);
      if (debuffs.fatigue > 0) debuffs.fatigue = Math.max(0, debuffs.fatigue - dt);
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) resetCombo(); }
      if (Input.consume('dash')) { const f = Input.takeFlick(); tryDash(f ? f.x : null, f ? f.y : null); }
      if (Input.consume('nova')) useNova();
      updatePlayer(dt);
      updateWave(edt);
      updateStorm(dt);
      updateDrones(dt);
      if (buffs.timewarp > 0) { tickT -= dt; if (tickT <= 0) { tickT = 0.5; Sfx.play('tick'); } }
      if (player.alive && player.hp === 1) { hbT -= dt; if (hbT <= 0) { hbT = 0.95; Sfx.play('heartbeat'); } }
    }
    updateBullets(dt);
    updateEnemies(edt);
    updateEBullets(edt);
    updateHazards(edt);
    updatePickups(dt);
    updateNova(dt);
    updateGhosts(dt);
    updateBolts(dt);
    updateParticles(dt);
    updatePopups(dt);
    compact(bullets);
    for (const e of enemies) if (e.dead && e.wb) { e.wb = false; wave.cleared += 1; }
    compact(enemies);
    compact(ebullets);
    compact(pickups);
    if (state === 'dying') {
      dieT += raw;
      if (dieT > 2.2) gameOver();
    }
  }
  function render() {
    if (trauma > 0 && Settings.get('shake')) {
      const s = trauma * trauma * 16 * view.k;
      camX = (Math.sin(time * 73) + Math.sin(time * 131) * 0.5) * s * 0.66;
      camY = (Math.cos(time * 89) + Math.sin(time * 157) * 0.5) * s * 0.66;
    } else {
      camX = 0;
      camY = 0;
    }
    drawBackground();
    if (state === 'menu') {
      drawDecor();
      drawParticles();
      return;
    }
    drawHazards();
    drawPickups();
    drawEnemies();
    if (boss) drawBossFx(boss);
    drawIncoming();
    drawDarkness();
    drawBullets();
    drawPlayer();
    drawEBullets();
    drawBolts();
    drawParticles();
    drawNova();
    drawPopups();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  function fillHud() {
    hud.score = score;
    hud.combo = combo;
    hud.mult = comboMult();
    hud.comboT = comboT / COMBO_TIME;
    if (player) {
      hud.hp = player.hp;
      hud.maxHp = player.maxHp;
      hud.weapon = player.weapon;
      hud.power = player.power;
      hud.dash = player.dashCd > 0 ? 1 - player.dashCd / DASH_CD : 1;
      hud.alive = player.alive;
      hud.totem = player.totem;
    }
    hud.nova = nova;
    hud.wave = wave.n;
    hud.waveProg = wave.boss || !wave.budget || wave.state !== 'active' ? -1 : Math.min(1, wave.cleared / wave.budget);
    hud.boss = boss ? Math.max(0, boss.hp / boss.maxHp) : -1;
    hud.bossPhase = boss ? boss.phase : 1;
    hud.bossArmor = !!(boss && boss.armor);
    hud.fps = fps;
    return hud;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    let raw = (now - lastT) / 1000;
    lastT = now;
    if (!(raw > 0)) raw = 0;
    raw = Math.min(raw, 0.05);
    fpsAcc += raw;
    fpsFrames += 1;
    if (fpsAcc >= 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }

    Input.update();
    handleActions();
    if (state === 'paused' || state === 'loading') { Input.endFrame(); return; }

    let ts = 1;
    if (hitstop > 0) { hitstop -= raw; ts = 0.06; }
    else if (slowT > 0) { slowT -= raw; ts = slowScale + (1 - slowScale) * (1 - clamp(slowT / 0.35, 0, 1)); }
    const dt = raw * ts;
    time += dt;

    update(dt, raw);
    render();
    if (state !== 'menu') UI.frame(fillHud(), raw);
    Input.endFrame();
  }

  // ================================================================ boss API
  // Everything bosses.js is allowed to touch. Mutable state is exposed through functions.
  const api = {
    TAU, rand, randi, pick, clamp, lerp, damp, easeOutCubic, easeInOut, turnToward, C, PAL, view, enemies, bullets, ebullets, ctx,
    player: () => player,
    time: () => time,
    hiQ: () => hiQ,
    P, SPARK, CUBE, GLOW, RING, SMOKE, spark, burst, explode, shake, slowmo, popup,
    eShoot, ring, fan, spiral, makeBeam, spawnEnemy, countType, bulletSpeed, bossF, aimAt, hurtPlayer, knockPlayer, addHazard,
    setDark: (t) => { darkT = Math.max(darkT, t); },
    isDark: () => darkT > 0,
    setFatigue: (t) => { debuffs.fatigue = Math.max(debuffs.fatigue, t); },
    glow, blit, sprite, at, world, drawTentacles,
  };

  // ================================================================ public API
  return {
    load,
    init() {
      BK = BossKit(api);
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', () => setTimeout(resize, 150));
      Settings.onChange((key) => { if (key === 'quality') resize(); });
      Input.init(canvas, {
        player: () => player || { x: view.w / 2, y: view.h * 0.8 },
        bounds,
        playing: () => state === 'playing',
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
      window.addEventListener('blur', () => pause());
      state = 'menu';
      lastT = performance.now();
      requestAnimationFrame(frame);
    },
    start,
    pause,
    resume,
    toMenu,
    dash() { if (state === 'playing') tryDash(null, null); },
    nova() { if (state === 'playing') useNova(); },
    get state() { return state; },
    BUFF_MAX,
    /** Boss list for the How-to-play screen. */
    bossList() { return BK ? BK.ORDER.map((kind, i) => ({ kind, wave: (i + 1) * 5, ...BK.ALL[kind] })) : []; },
    // handy for testing from the console, e.g. Game.debug.boss(4) to fight the Ender Dragon
    debug: {
      god(on = true) { godMode = on; },
      wave(n) {
        for (const e of enemies) e.dead = true;
        boss = null;
        darkT = 0;
        hazards.length = 0;
        UI.bossBar(false);
        UI.letterbox(false);
        wave.n = n - 1;
        wave.state = 'clear';
        wave.breakT = 0.1;
      },
      boss(level) { bossLevel = level - 1; this.wave(5 * level); },
      spawn(type, x, y) { return !!spawnEnemy(type, x === undefined ? view.w / 2 : x, y === undefined ? view.h * 0.2 : y); },
      pickup(type) { if (player) spawnPickup(type, player.x, player.y - 120 * view.k, 0, 0); },
      weapon(n) { if (player) player.weapon = clamp(n, 1, 5); },
      nova() { nova = 100; },
      buff(name) { buffs[name] = BUFF_MAX[name]; if (name === 'drones') resetDrones(); },
      hurt() { if (player) { player.invuln = 0; hurtPlayer(); } },
      bossHp(frac) { if (boss) boss.hp = boss.maxHp * frac; },
      attack(name) { if (boss && boss.mode === 'fight') { boss.atk = 99; boss.def.attack(boss, name); } },
      die() { if (player && player.alive) { godMode = false; buffs.shield = 0; player.totem = false; player.hp = 1; player.invuln = 0; player.dashT = 0; hurtPlayer(); } },
      player() { return player && { x: player.x, y: player.y, hp: player.hp, maxHp: player.maxHp, weapon: player.weapon, power: player.power, alive: player.alive, totem: player.totem }; },
      info() {
        return {
          state, enemies: enemies.length, bullets: bullets.length, ebullets: ebullets.length, hazards: hazards.length, parts: parts.length, wave: wave.n, hpMul: wave.hpMul, score, fps, nova,
          dashes: stats && stats.dashes, novas: stats && stats.novas, bossLevel, boss: boss && { kind: boss.kind, mode: boss.mode, phase: boss.phase, hp: Math.round(boss.hp), maxHp: boss.maxHp, mark: boss.mark, title: boss.title },
          types: [...new Set(enemies.map((e) => e.type))],
        };
      },
    },
  };
})();
