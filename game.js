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
  // w/h = the world; sw/sh = the screen. In multiplayer every player shares the host's world size and
  // each screen shows it scaled by z with ox/oy borders (in single player the world is the screen).
  const view = { w: 1, h: 1, dpr: 1, k: 1, vs: 1, z: 1, ox: 0, oy: 0, sw: 1, sh: 1 };
  let fixedWorld = null;
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
    witch: [col(58, 36, 80), col(92, 58, 128), col(200, 154, 120), col(63, 191, 74)],
    pillager: [col(143, 154, 152), col(124, 134, 132), col(43, 43, 43), col(90, 70, 50)],
    breeze: [col(180, 232, 255), col(118, 198, 234), col(255, 255, 255), col(47, 111, 158)],
    brute: [col(227, 162, 150), col(201, 127, 116), col(38, 38, 38), col(242, 194, 48)],
    storm: [col(42, 36, 51), col(59, 42, 79), col(90, 62, 42), col(178, 107, 255), col(74, 74, 82)],
    herobrine: [col(185, 130, 96), col(47, 29, 15), col(255, 255, 255), col(91, 58, 34)],
    poison: [col(110, 220, 70), col(60, 160, 50), col(190, 255, 140)],
    harm: [col(170, 40, 90), col(255, 80, 150), col(110, 20, 60)],
    slow: [col(110, 130, 200), col(170, 190, 255), col(70, 80, 140)],
    blocks: [col(140, 140, 150), col(134, 96, 67), col(166, 124, 74), col(110, 74, 160)], // stone, dirt, wood, obsidian
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
    pillager: { img: 'pillager', w: 52, h: 52, hp: 4, score: 220, pal: PAL.pillager, glow: C.grey, name: 'PILLAGER' },
    witch: { img: 'witch', w: 56, h: 67, hp: 8, score: 350, pal: PAL.witch, glow: C.purple, name: 'WITCH' },
    breeze: { img: 'breeze', w: 50, h: 50, hp: 6, score: 320, pal: PAL.breeze, glow: C.cyan, name: 'BREEZE' },
    brute: { img: 'brute', w: 62, h: 62, hp: 14, score: 500, pal: PAL.brute, glow: C.gold, name: 'PIGLIN BRUTE', axe: 'gold' },
    // Village Raid only: an illager with an iron axe (fights like a piglin brute)
    vindicator: { img: 'vindicator', w: 54, h: 54, hp: 9, score: 320, pal: PAL.pillager, glow: C.grey, name: 'VINDICATOR', axe: 'iron' },
    // boss minions
    wskel: { img: 'skeleton', tint: 'shade', w: 54, h: 54, hp: 5, score: 250, pal: PAL.wskel, glow: C.purple, name: 'WITHER SKELETON' },
    shrieker: { img: 'shrieker', w: 44, h: 44, hp: 10, score: 150, pal: PAL.shrieker, glow: C.cyan, name: 'SHRIEKER' },
    guardian: { img: 'guardian', w: 50, h: 50, hp: 5, score: 200, pal: PAL.guardian, glow: C.teal, name: 'GUARDIAN' },
    crystal: { img: 'crystal', w: 42, h: 42, hp: 14, score: 300, pal: PAL.crystal, glow: C.pink, name: 'END CRYSTAL', persist: true },
    magmacube: { img: 'magma', w: 64, h: 64, hp: 6, score: 150, pal: PAL.magma, glow: C.orange, name: 'MAGMA CUBE' },
    illusion: { img: 'illusioner', w: 150, h: 150, hp: 3, score: 60, pal: PAL.illusion, glow: C.blue, name: 'ILLUSION', persist: true, fixedHp: true },
    phantom: { img: 'phantomlord', w: 70, h: 42, hp: 3, score: 150, pal: PAL.phantom, glow: C.red, name: 'PHANTOM' },
    hclone: { img: 'herobrine', tint: 'shade', w: 104, h: 104, hp: 5, score: 120, pal: PAL.herobrine, glow: C.white, name: 'SHADOW', persist: true },
    // the secret: a face with white eyes that watches from the edge of the screen for a moment
    sighting: { img: 'herobrine', w: 44, h: 44, hp: 1, score: 0, pal: PAL.herobrine, glow: C.white, name: '???', persist: true, fixedHp: true },
  };
  const DEBUT = new Set(['slime', 'blaze', 'enderman', 'shulker', 'ghast', 'pillager', 'witch', 'breeze', 'brute', 'vindicator']);
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
    bolt: { r: 6, c: C.white },                   // pillager crossbow bolt
    potion: { r: 9, c: C.purple, ghost: true },   // witch potion: flies over everything, splashes where it lands
    wind: { r: 12, c: C.cyan, wind: true },       // breeze wind charge: shoves you on hit
    block: { r: 13, c: C.grey },                  // debris torn up by the Wither Storm
    hshot: { r: 9, c: C.white, hp: 1, homing: 1.1, life: 6 }, // Herobrine's soul shots
  };
  // splash potions (Witch): what the cloud does where it lands
  const POTIONS = {
    harm: { c: C.pink, life: 0.3, label: 'HARMING' },
    poison: { c: C.green, life: 3.2, label: 'POISON' },
    slow: { c: C.blue, life: 3, label: 'SLOWNESS' },
  };
  // how each hazard looks: glow, fill, edge, particle colours
  const HZ = {
    acid: { c: C.purple, fill: '#7a2cb8', edge: '#ff6ad5', pc: [C.purple, C.pink] },
    lava: { c: C.orange, fill: '#b8360c', edge: '#ffc21a', pc: [C.orange, C.gold] },
    poison: { c: C.green, fill: '#2f7a2c', edge: '#9dff6a', pc: [C.green, PAL.poison[2]] },
    harm: { c: C.pink, fill: '#8a1f55', edge: '#ff7ac0', pc: [C.pink, C.red] },
    slow: { c: C.blue, fill: '#36457a', edge: '#a9c0ff', pc: [C.blue, C.white] },
    strike: { c: C.cyan, fill: '#2a4a7a', edge: '#bfe8ff', pc: [C.cyan, C.white] },
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
  // ehp/bspd/fire = mobs · bhp = boss health · tempo = boss attack speed · shield = boss shield (% of HP)
  // tier = extra bullets per attack · harass = gap between a boss's aimed pot-shots (bigger = calmer)
  const DIFF = {
    easy: { ehp: 0.8, bspd: 0.85, fire: 0.75, score: 0.75, bhp: 0.6, tempo: 0.7, shield: 0.06, tier: -1, harass: 2.2 },
    normal: { ehp: 1, bspd: 1, fire: 1, score: 1, bhp: 0.8, tempo: 0.85, shield: 0.08, tier: 0, harass: 1.75 },
    hard: { ehp: 1.3, bspd: 1.1, fire: 1.3, score: 1.5, bhp: 1, tempo: 1, shield: 0.1, tier: 1, harass: 1.3 },
  };
  // theoretical damage per second of each weapon level (level 5 includes the homing missiles)
  const WEAPON_DPS = [0, 1 / 0.14, 2 / 0.13, 3 / 0.12, 4 / 0.115, 5 / 0.105 + 12.7];
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
    witch: 'witch.png', pillager: 'pillager.png', breeze: 'breeze.png', brute: 'brute.png', witherstorm: 'witherstorm.png', herobrine: 'herobrine.png',
    vindicator: 'vindicator.png',
  };
  const IMG = {};
  function load(onProgress) {
    if (typeof SKINS !== 'undefined') SKINS.forEach((s) => { SRC[skinKey(s)] = s.img; });
    if (typeof PETS !== 'undefined') PETS.forEach((d) => { if (d.img) SRC[petKey(d)] = d.img; });
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

  // ---------------------------------------------------------------- skins
  const skinKey = (s) => s.img.replace(/\.png$/i, '');
  const DEFAULT_SKIN = { id: 'phantom', img: 'player.png', ar: 197 / 331, ws: 1, trail: ['#3ee6ff', '#508cff'], glow: '#3ee6ff' };
  const hexCol = (h) => col(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16));
  const skinData = (id) => {
    const list = typeof SKINS !== 'undefined' ? SKINS : [];
    return list.find((s) => s.id === id) || list[0] || DEFAULT_SKIN;
  };
  let skin = DEFAULT_SKIN; // this device's chosen skin
  function applySkin() {
    skin = skinData(Settings.get('skin'));
    if (me && !net) dressShip(me, skin.id);
  }
  /** Each ship carries its own skin: sprite, size, engine-trail and glow colours. */
  function dressShip(p, id) {
    const s = skinData(id);
    p.skin = s.id;
    p.sk = s;
    p.skinKey = skinKey(s);
    p.trail = s.trail.map(hexCol);
    p.glowC = hexCol(s.glow);
    sizePlayer(p);
  }
  function sizePlayer(p) {
    const s = p.sk || skin;
    p.w = 96 * view.k * s.ws;
    p.h = p.w * s.ar;
    p.r = Math.max(4, 6.5 * view.k);
  }

  // ---- sprite cache: every image is pre-scaled once to its exact on-screen size
  const cache = new Map();
  const TINT = { white: '#ffffff', red: '#ff2a3a', cyan: '#3ee6ff', gold: '#ffd23f', purple: '#a36bff' };
  const PAINTERS = { shield: paintShield, magnet: paintMagnet, crystal: paintCrystal };

  function sprite(name, w, h, tint) {
    const pw = Math.max(2, Math.round(w * view.dpr * view.z));
    const ph = Math.max(2, Math.round(h * view.dpr * view.z));
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
    const d = view.dpr * view.z;
    const tx = view.dpr * view.ox + d * (x + camX);
    const ty = view.dpr * view.oy + d * (y + camY);
    if (rot) {
      const cs = Math.cos(rot);
      const sn = Math.sin(rot);
      ctx.setTransform(d * cs * sx, d * sn * sx, -d * sn * sy, d * cs * sy, tx, ty);
    } else {
      ctx.setTransform(d * sx, 0, 0, d * sy, tx, ty);
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
    const d = view.dpr * view.z;
    ctx.setTransform(d, 0, 0, d, view.dpr * view.ox + d * camX, view.dpr * view.oy + d * camY);
  }
  /** World space without camera shake. */
  function base() {
    const d = view.dpr * view.z;
    ctx.setTransform(d, 0, 0, d, view.dpr * view.ox, view.dpr * view.oy);
  }

  // ================================================================ state
  let state = 'loading'; // loading | menu | playing | paused | dying | over
  // Every ship in the run. `me` is the one this device controls. `player` is "the ship being
  // handled right now": mob and boss AI see their current target through it, so the single-player
  // code works unchanged in co-op (in single player it is always `me`).
  let players = [];
  let me = null;
  let player = null;
  // multiplayer: null in single player, otherwise { role: 'host' | 'guest', ... } (see "multiplayer" below)
  let net = null;
  let netMenu = false;  // multiplayer menu open (the game keeps running for the team)
  let specPid = 0;      // teammate being watched after you go down
  const heartFx = [];   // heart pop / break animations above ships
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
  // current run: which game (Arcade, Boss Rush, Village Raid — see GAMES in settings.js), played
  // Classic (checkpoint after every boss) or Hardcore (a tier from HARDCORE_TIERS)
  let run = { game: 'arcade', mode: 'classic', tier: null };
  let bossOrder = [];   // the order bosses come in this run (the raid has its own)
  let rushSecret = false; // Boss Rush: the full lap is done... something comes next
  let rules = { extraHearts: true, heartDrops: true, totemHearts: 3 };
  let boss = null;
  let bossLevel = 0;
  let BK = null;        // boss definitions from bosses.js
  let novaFx = null;
  let novaId = 0;
  let starOut = false;
  let totemOut = false;
  let heroMet = false;  // the secret boss was found this run
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
  let hiQ = true;
  let maxParts = 1400;
  let godMode = false;
  let simSpeed = 1;      // debug: run several updates per frame
  let autoPilot = false; // debug: true = steer under the boss, 'dodge' = dodging bot
  let botHits = 0; // debug: hearts the player would have lost while in god mode
  let lastT = 0;
  const hud = {
    score: 0, combo: 0, mult: 1, comboT: 0, hp: 5, maxHp: 5, weapon: 1, power: 1, nova: 0, dash: 1, wave: 0, buffs, debuffs,
    boss: -1, bossPhase: 1, bossArmor: false, bossShield: 0, bossHp: 0, bossMaxHp: 0, bossStatus: '', alive: true, fps: 60, totem: false, waveProg: -1,
  };

  // ================================================================ resize
  function resize() {
    hiQ = Settings.get('quality') === 'high';
    maxParts = hiQ ? 1400 : 450;
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const w = fixedWorld ? fixedWorld.w : sw;
    const h = fixedWorld ? fixedWorld.h : sh;
    view.sw = sw;
    view.sh = sh;
    view.w = w;
    view.h = h;
    view.z = fixedWorld ? Math.min(sw / w, sh / h) : 1;
    view.ox = (sw - w * view.z) / 2;
    view.oy = (sh - h * view.z) / 2;
    view.dpr = Math.min(window.devicePixelRatio || 1, hiQ ? 2 : 1.25);
    view.k = clamp(Math.min(w, h) / 720, 0.55, 1.25);
    view.vs = clamp(h / 900, 0.6, 1.4);
    canvas.width = Math.round(sw * view.dpr);
    canvas.height = Math.round(sh * view.dpr);
    cache.clear();
    initBackground();
    for (const p of players) sizePlayer(p);
    if (me) clampPlayer();
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
    const d = view.dpr * view.z;
    const bx = view.dpr * view.ox;
    const by = view.dpr * view.oy;
    const W = view.w;
    const H = view.h;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = ZONES[bg.zone].base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    base();

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
        if (i % 2 === 0) ctx.setTransform(d, 0, 0, d, bx, by + d * ty);
        else ctx.setTransform(d, 0, 0, -d, bx, by + d * (ty + ih));
        ctx.drawImage(tex, 0, 0, tw, th, x0, 0, iw, ih);
      }
      base();
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
  const DECOR = ['zombie', 'skeleton', 'creeper', 'vex', 'evoker', 'player', 'blaze', 'slime', 'enderman', 'ghast', 'shulker', 'magma', 'guardian', 'witch', 'pillager', 'breeze', 'brute'];
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
    if (kind === RING && quiet === 0) fwd('r', r1(x), r1(y), r2(life), r1(size), c.s);
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
    fwd('b', r1(x), r1(y), c.s, n, speed);
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const sp = rand(0.3, 1) * speed * view.k;
      P(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.6), rand(6, 11) * view.k, c, GLOW, 3);
    }
  }
  function explode(x, y, pal, s = 1, gc = C.orange) {
    fwd('x', r1(x), r1(y), pal.map((c) => c.s), r2(s), gc.s);
    quiet += 1;
    explodeFx(x, y, pal, s, gc);
    quiet -= 1;
  }
  function explodeFx(x, y, pal, s, gc) {
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
    if (e.nid) fwd('h', e.nid);
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
    fwd('l', r1(x0), r1(y0), r1(x1), r1(y1));
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
    const k = view.k;
    for (const h of hazards) {
      h.t += dt;
      if (h.warn > 0) { h.warn -= dt; if (h.warn <= 0) hazardOn(h); continue; }
      h.life -= dt;
      if (h.life <= 0) { h.dead = true; continue; }
      const hz = HZ[h.kind];
      if (hiQ && hz && Math.random() < dt * 10) {
        P(h.x + rand(-0.7, 0.7) * h.r, h.y + rand(-0.4, 0.4) * h.r, 0, -rand(20, 60) * k, rand(0.4, 0.8), rand(6, 12) * k, pick(hz.pc), GLOW, 1);
      }
      for (const p of players) {
        if (!p.alive || p.intro > 0) continue;
        const dx = (p.x - h.x) / h.r;
        const dy = (p.y - h.y) / (h.r * (h.kind === 'fang' ? 1 : 0.7));
        if (dx * dx + dy * dy >= 1) continue;
        if (h.kind === 'slow') slowShip(p, 2.2);
        else hurtPlayer(1, p);
      }
    }
    compact(hazards);
  }
  /** The moment a warned hazard goes live: potions splash, lightning strikes. */
  function hazardOn(h) {
    const k = view.k;
    const pot = POTIONS[h.kind];
    if (pot) {
      burst(h.x, h.y, pot.c, hiQ ? 18 : 8, 300);
      P(h.x, h.y, 0, 0, 0.4, h.r * 1.3, pot.c, RING);
      sfx('glass');
    } else if (h.kind === 'strike') {
      bolt(h.x + rand(-50, 50) * k, -20, h.x, h.y);
      P(h.x, h.y, 0, 0, 0.35, h.r * 1.4, C.cyan, RING);
      sfx('thunder');
      shake(0.2);
    }
  }
  /** A pull toward (x, y) at f px/s for t seconds (the Wither Storm's tractor beam). Like every shove it
   *  runs on the device that steers the ship, so guests get it as a message (refreshed while it lasts). */
  function dragShip(p, t, x, y, f) {
    if (!p || !p.alive) return;
    p.dragT = Math.max(p.dragT || 0, t);
    p.dragX = x;
    p.dragY = y;
    p.dragF = f;
    if (p !== me && net && net.role === 'host' && !(time - (p.dragSent || -9) < 0.2)) {
      p.dragSent = time;
      net.sendTo(p.pid, { t: 'E', e: [['dr', r2(t), r1(x), r1(y), r1(f)]] });
    }
  }
  /** Slowness: heavy controls for a moment (sent to a guest's own device, where its ship is steered). */
  function slowShip(p, t) {
    if (p.dashT > 0) return;
    if (!(p.slowT > 0) && p === me) popup(p.x, p.y - p.h, 'SLOWED!', '#a9c0ff', 10, 0.9);
    p.slowT = Math.max(p.slowT || 0, t);
    if (p !== me && net && net.role === 'host' && !(time - (p.slowSent || -9) < 0.5)) {
      p.slowSent = time;
      net.sendTo(p.pid, { t: 'E', e: [['sl', t]] });
    }
  }
  function drawHazards() {
    const k = view.k;
    for (const h of hazards) {
      const hz = HZ[h.kind] || HZ.lava;
      const c = h.kind === 'fang' ? C.white : hz.c;
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
      ctx.fillStyle = hz.fill;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r * (1 + Math.sin(h.t * 4) * 0.05), h.r * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.7 * fade;
      ctx.strokeStyle = hz.edge;
      ctx.lineWidth = 2 * k;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- floating text
  function popup(x, y, text, color = '#fff', size = 10, life = 0.9) {
    fwd('p', r1(x), r1(y), text, color, size, life);
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
    const d = view.dpr * view.z;
    const bx = view.dpr * view.ox;
    const by = view.dpr * view.oy;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of popups) {
      const age = p.max - p.life;
      const t = p.life / p.max;
      const sc = age < 0.14 ? Math.max(0.01, easeOutBack(age / 0.14)) : 1;
      ctx.globalAlpha = t < 0.3 ? t / 0.3 : 1;
      ctx.setTransform(d * sc, 0, 0, d * sc, bx + d * (p.x + camX), by + d * (p.y + camY));
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
  const shake = (a) => { trauma = Math.min(1, trauma + a); fwd('k', r2(a)); };
  const slowmo = (dur, scale) => { slowT = Math.max(slowT, dur); slowScale = scale; fwd('w', r2(dur), r2(scale)); };

  // ---- multiplayer relay: on the host, effects, sounds and banners are also queued for the guests
  let quiet = 0; // > 0 while an already-relayed effect runs, so its parts aren't sent twice
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  function fwd(code, ...args) {
    if (net && net.role === 'host' && quiet === 0 && (state === 'playing' || state === 'dying')) net.out.push([code, ...args]);
  }
  // sounds only the player who caused them should hear
  const LOCAL_SFX = new Set(['shoot', 'missile', 'dash', 'hurt', 'heartbeat', 'tick', 'graze', 'ready', 'click', 'hover']);
  function sfx(name, arg) {
    Sfx.play(name, arg);
    if (!LOCAL_SFX.has(name)) fwd('s', name, arg === undefined ? null : arg);
  }
  function music(mode) { Sfx.music(mode); fwd('m', mode); }
  const U = {
    banner: (a, b, c, d) => { UI.banner(a, b, c, d); fwd('B', a, b, c, d); },
    toast: (m) => { UI.toast(m); fwd('T', m); },
    flash: (kind) => { UI.flash(kind); fwd('F', kind); },
    bossBar: (on, name, phases) => { UI.bossBar(on, name, phases); fwd('BB', on, name || '', phases || null); },
    letterbox: (on) => { UI.letterbox(on); fwd('L', on); },
  };
  // colours travel as their css string and come back as one shared colour object each
  const colCache = new Map();
  function colS(s) {
    if (!s) return C.white;
    let c = colCache.get(s);
    if (!c) {
      const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(s);
      c = m ? col(+m[1], +m[2], +m[3]) : C.white;
      colCache.set(s, c);
    }
    return c;
  }
  /** Every point goes through here so difficulty, hearts bonus and 2x-score apply everywhere. */
  function addScore(v) {
    const s = Math.round(v * diff.score * heartMul * (buffs.double > 0 ? 2 : 1));
    score += s;
    return s;
  }

  // ================================================================ player
  /** info (multiplayer): { pid, name, skin, slot, count } — ships line up side by side when they warp in. */
  function makePlayer(hearts, info = {}) {
    const n = info.count || 1;
    const p = {
      pid: info.pid || 1, name: info.name || '', homeX: view.w * ((info.slot || 0) + 1) / (n + 1),
      x: 0, y: 0, w: 1, h: 1, r: 1,
      vx: 0, vy: 0, tilt: 0, hp: hearts, maxHp: hearts, invuln: 0, weapon: 1, power: 1, fireT: 0.3,
      dashT: 0, dashCd: 0, dvx: 0, dvy: 0, knockT: 0, kvx: 0, kvy: 0, ghostT: 0, recoil: 0, alive: true, volley: 0, intro: 1, totem: false,
      engine: 0, fireOn: false, nx: 0, ny: 0, in: null, left: false,
    };
    dressShip(p, info.skin || skin.id);
    p.x = p.homeX;
    p.y = view.h + p.h;
    p.nx = p.x;
    p.ny = p.y;
    p.pet = makePet(info.pet !== undefined ? info.pet : Settings.get('pet'));
    if (p.pet) { p.pet.x = p.pet.nx = p.x - 60 * view.k; p.pet.y = p.pet.ny = p.y + 40 * view.k; }
    return p;
  }
  function bounds() {
    const p = player;
    const mx = p ? p.w * 0.35 : 30;
    const my = p ? p.h * 0.55 : 30;
    return { minX: mx, maxX: view.w - mx, minY: view.h * 0.2, maxY: view.h - my - 4 };
  }
  function clampPlayer() {
    if (!me || me.intro > 0) return;
    const b = bounds();
    me.x = clamp(me.x, b.minX, b.maxX);
    me.y = clamp(me.y, b.minY, b.maxY);
  }
  const maxSpeed = () => 0.62 * Math.sqrt(view.w * view.h);

  /**
   * One ship per call. Your own ship follows your controls; in multiplayer a teammate's ship
   * follows the position their device reports (host) or the host's latest update (guests).
   */
  function updateShip(p, dt) {
    if (!p.alive) return;
    if (p === me) { steerLocal(p, dt); return; }
    const k = view.k;
    p.invuln = Math.max(0, p.invuln - dt);
    p.recoil = Math.max(0, p.recoil - dt * 8);
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.ghostT -= dt;
      if (p.ghostT <= 0) { p.ghostT = 0.03; addGhost(p); }
    }
    let tx = p.nx;
    let ty = p.ny;
    if (net && net.role === 'host' && p.in) {
      tx = p.in.x;
      ty = p.in.y;
      p.tilt = damp(p.tilt, p.in.tilt, 12, dt);
      p.intro = p.in.intro;
    }
    const ox = p.x;
    const oy = p.y;
    p.x = damp(p.x, tx, 22, dt);
    p.y = damp(p.y, ty, 22, dt);
    if (net && net.role === 'host' && p.in) { p.vx = p.in.vx; p.vy = p.in.vy; } else { p.vx = (p.x - ox) / Math.max(dt, 1e-3); p.vy = (p.y - oy) / Math.max(dt, 1e-3); }
    shipFx(p, dt, k);
    // teammates' shots: real on the host, just for show on guests
    p.fireT -= dt;
    if (p.fireT < -0.1) p.fireT = 0;
    if (p.fireOn && p.intro < 0.05 && p.fireT <= 0) {
      fire(p);
      p.fireT += WEAPONS[p.weapon].rate * (buffs.overdrive > 0 ? 0.55 : 1) * (debuffs.fatigue > 0 ? 1.6 : 1);
    }
  }
  function addGhost(p) {
    ghosts.push({ x: p.x, y: p.y, rot: p.tilt * 0.28, a: 0.55, key: p.skinKey, w: p.w, h: p.h, dead: false });
  }
  /** Engine trail and aura particles for any ship. */
  function shipFx(p, dt, k) {
    const od = buffs.overdrive > 0;
    p.engine += dt * (hiQ ? 70 : 28) * (od ? 1.6 : 1) * (p === me ? 1 : 0.6);
    while (p.engine >= 1) {
      p.engine -= 1;
      P(p.x + rand(-4, 4) * k, p.y + p.h * 0.38, rand(-25, 25) * k - p.vx * 0.1, rand(170, 280) * view.vs, rand(0.16, 0.3), rand(5, 10) * k, od ? pick([C.purple, C.pink]) : pick(p.trail), GLOW, 2);
    }
    if (p.totem && hiQ && Math.random() < dt * 5) P(p.x + rand(-0.4, 0.4) * p.w, p.y + rand(-0.3, 0.3) * p.h, 0, -40 * k, 0.6, 7 * k, C.gold, GLOW, 1);
    if (debuffs.fatigue > 0 && hiQ && Math.random() < dt * 8) P(p.x + rand(-0.4, 0.4) * p.w, p.y, 0, 30 * k, 0.6, 8 * k, C.purple, GLOW, 1);
    if (p.bubbleT > 0) p.bubbleT -= dt;
    if (p.slowT > 0) {
      if (p !== me) p.slowT -= dt;
      if (hiQ && Math.random() < dt * 10) P(p.x + rand(-0.45, 0.45) * p.w, p.y + rand(-0.2, 0.3) * p.h, 0, 40 * k, 0.7, 7 * k, C.blue, GLOW, 1);
    }
  }

  function steerLocal(p, dt) {
    const k = view.k;
    const tired = debuffs.fatigue > 0;
    const slow = p.slowT > 0;
    if (slow) p.slowT -= dt;
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.recoil = Math.max(0, p.recoil - dt * 8);

    if (p.intro > 0) {
      // warp-in: fly up from below the screen
      p.intro = Math.max(0, p.intro - dt * 0.9);
      p.y = lerp(view.h + p.h, view.h * 0.78, easeOutCubic(1 - p.intro));
      p.x = damp(p.x, p.homeX || view.w / 2, 6, dt);
      if (p.intro === 0) Input.rebase();
    } else if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dvx * dt;
      p.y += p.dvy * dt;
      p.ghostT -= dt;
      if (p.ghostT <= 0) { p.ghostT = 0.018; addGhost(p); }
      if (p.dashT <= 0) { p.vx = p.dvx * 0.25; p.vy = p.dvy * 0.25; Input.rebase(); }
    } else if (netMenu) {
      // multiplayer menu is open: hold position
      p.vx = damp(p.vx, 0, 10, dt);
      p.vy = damp(p.vy, 0, 10, dt);
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
        const rate = tired ? 6 : slow ? 8 : 26;
        const nx = damp(p.x, t.x, rate, dt);
        const ny = damp(p.y, t.y, rate, dt);
        p.vx = (nx - p.x) / dt;
        p.vy = (ny - p.y) / dt;
        p.x = nx;
        p.y = ny;
      } else {
        // analog steering (keys / stick / pad) with acceleration + friction
        const ms = maxSpeed() * (buffs.overdrive > 0 ? 1.25 : 1) * (tired ? 0.55 : 1) * (slow ? 0.5 : 1) * (p.auraK === 'echo' ? 1.4 : 1);
        const ix = Input.x;
        const iy = Input.y;
        p.vx = damp(p.vx, ix * ms, ix ? 14 : 10, dt);
        p.vy = damp(p.vy, iy * ms, iy ? 14 : 10, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    if (autoPilot && boss && p.intro === 0 && p.dashT <= 0) {
      if (autoPilot === 'dodge') botSteer(dt, tired);
      else p.x = damp(p.x, boss.x, 2.5, dt);
    }
    // tractor beam: dragged toward the boss (a dash breaks free); the finger's anchor moves along
    if (p.dragT > 0) {
      p.dragT -= dt;
      const dx = p.dragX - p.x;
      const dy = p.dragY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (p.dashT <= 0 && p.intro === 0 && d > 50 * k) {
        const mx = (dx / d) * p.dragF * dt;
        const my = (dy / d) * p.dragF * dt;
        p.x += mx;
        p.y += my;
        Input.shift(mx, my);
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
    shipFx(p, dt, k);

    // shooting
    p.fireT -= dt;
    if (p.fireT < -0.1) p.fireT = 0;
    const wantFire = !netMenu && (Settings.get('autoFire') || Input.firing);
    p.fireOn = wantFire;
    if (wantFire && p.intro === 0 && p.fireT <= 0) {
      fire(p);
      p.fireT += WEAPONS[p.weapon].rate * (od ? 0.55 : 1) * (tired ? 1.6 : 1);
    }
  }

  function fire(p = player) {
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
      missile(x - p.w * 0.34, y + p.h * 0.35, -1, p);
      missile(x + p.w * 0.34, y + p.h * 0.35, 1, p);
      if (p === me) Sfx.play('missile');
    }
    P(x, y, 0, 0, 0.07, 22 * k, wp.c, GLOW);
    p.recoil = 1;
    if (p === me) Sfx.play('shoot', lv);
  }
  function missile(x, y, side, p = player) {
    const k = view.k;
    const s = 26 * k;
    bullets.push({ x, y, vx: side * 280 * k, vy: -160 * view.vs, r: 10 * k, s, c: sprite('missile', s, s), col: C.green, dmg: 2 * p.power, pierce: 0, rot: 0, spin: 0, life: 2.4, homing: true, turn: 7, speed: 900 * view.vs, trail: 0, src: 'missile', last: null, dead: false });
  }

  // debug only: a simple bot that dodges like an average player, used to measure boss difficulty
  let botT = 0;
  let botX = 0;
  let botY = 0;
  function botDanger(x, y) {
    const k = view.k;
    const p = player;
    let d = 0;
    for (const b of ebullets) {
      if (b.dead) continue;
      const R = b.r + p.r + 14 * k;
      for (let t = 0; t <= 0.6; t += 0.15) {
        const dx = b.x + b.vx * t - x;
        const dy = b.y + b.vy * t - y;
        const q = (dx * dx + dy * dy) / (R * R);
        if (q < 4) d += Math.exp(-q) * (1 - t);
      }
    }
    for (const e of enemies) {
      if (e.dead) continue;
      const R = Math.max(e.w, e.h) * 0.5 + p.r + 30 * k;
      const q = dist2(e.x, e.y, x, y) / (R * R);
      if (q < 2) d += (e.T.boss ? 3 : 1.5) * Math.exp(-q);
      if (e.beams) for (const bm of e.beams) if (Math.abs(x - bm.x) < bm.w * 0.5 + p.r + 16 * k) d += 6;
    }
    for (const h of hazards) {
      const R = h.r + p.r + 12 * k;
      if (dist2(h.x, h.y, x, y) < R * R) d += 4;
    }
    return d;
  }
  function botSteer(dt, tired) {
    const p = player;
    const k = view.k;
    botT -= dt;
    if (botT <= 0) {
      botT = 0.05;
      const bb = bounds();
      let best = Infinity;
      for (let i = -3; i <= 3; i++) {
        for (let j = -1; j <= 1; j++) {
          const x = clamp(p.x + i * 55 * k, bb.minX, bb.maxX);
          const y = clamp(p.y + j * 45 * k, bb.minY + view.h * 0.3, bb.maxY);
          const s = botDanger(x, y) * 10 + Math.abs(x - boss.x) / view.w * 1.5 + Math.abs(y - view.h * 0.78) / view.h;
          if (s < best) { best = s; botX = x; botY = y; }
        }
      }
      if (botDanger(p.x, p.y) > 1.5 && p.dashCd <= 0) tryDash(botX - p.x || 1, botY - p.y);
    }
    const step = maxSpeed() * (tired ? 0.55 : 1) * dt;
    p.x += clamp(botX - p.x, -step, step);
    p.y += clamp(botY - p.y, -step, step);
  }
  // ================================================================ character abilities
  // Every skin has a movement ability (SHIFT / dash button) and a special attack (B / special button).
  // Names, descriptions and cooldowns live in skins.js; this is how they behave.
  // t = dash time · sp = dash speed · hit = damage to mobs you fly through · aura = seconds of protection
  const MOVE_FX = {
    dash: { t: 0.16, sp: 1500 },
    rocket: { t: 0.3, sp: 1650, hit: 7 },
    pearl: { tele: 210 },
    gust: { t: 0.16, sp: 1400, clear: 175 },
    spirit: { t: 0.16, sp: 1400 },
    buzz: { t: 0.1, sp: 1300 },
    roll: { t: 0.24, sp: 1200, reflect: 64 },
    echo: { aura: 1.1 },
    flame: { t: 0.18, sp: 1500 },
    puff: { aura: 1.6 },
    dive: { t: 0.2, sp: 1750, hit: 10 },
  };
  const MOVE_COL = { dash: C.cyan, rocket: C.gold, pearl: C.purple, gust: C.purple, spirit: C.cyan, buzz: C.gold, roll: C.pink, echo: C.purple, flame: C.orange, puff: C.white, dive: C.red };
  const MOVE_IDS = Object.keys(MOVE_FX);
  const moveOf = (p) => (p && p.sk && p.sk.move) || { id: 'dash', name: 'DASH', cd: 0.9 };
  const ultOf = (p) => (p && p.sk && p.sk.ult) || { id: 'nova', name: 'NOVA' };

  /** Your movement ability (the keyboard, button, flick or gamepad asked for it). */
  function tryDash(fx, fy) {
    const p = me;
    if (!p || !p.alive || p.intro > 0 || p.dashCd > 0 || p.dashT > 0 || netMenu) return;
    const mv = moveOf(p);
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
    p.dashCd = mv.cd;
    p.knockT = 0;
    stats.dashes += 1;
    moveMotion(p, mv.id, dx, dy);
    moveEffects(p, mv.id);
    Sfx.play(mv.id === 'pearl' ? 'teleport' : mv.id === 'puff' ? 'shield' : mv.id === 'echo' ? 'stare' : 'dash');
    Input.vibrate(12);
    // the host needs to know (you can't be hit mid-move, and it applies the move's damage)
    if (net && net.role === 'guest') net.send({ t: 'dash', dx: r2(dx), dy: r2(dy) });
  }
  /** Moves your own ship (dash, teleport or protective aura). */
  function moveMotion(p, id, dx, dy) {
    const f = MOVE_FX[id] || MOVE_FX.dash;
    const k = view.k;
    const c = MOVE_COL[id] || C.cyan;
    p.dashHit = new Set();
    if (f.tele) {
      // ender pearl: pop out here, pop in there
      const ox = p.x;
      const oy = p.y;
      const b = bounds();
      p.x = clamp(p.x + dx * f.tele * k, b.minX, b.maxX);
      p.y = clamp(p.y + dy * f.tele * k, b.minY, b.maxY);
      p.invuln = Math.max(p.invuln, 0.35);
      for (const [x, y] of [[ox, oy], [p.x, p.y]]) {
        for (let i = 0; i < (hiQ ? 14 : 6); i++) { const a = rand(TAU); const s = rand(60, 260) * k; P(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.6), rand(5, 9) * k, C.purple, GLOW, 3); }
      }
      P(p.x, p.y, 0, 0, 0.35, 70 * k, C.purple, RING);
      Input.rebase();
      return;
    }
    if (f.aura) {
      p.auraK = id;
      p.auraT = f.aura;
      p.invuln = Math.max(p.invuln, f.aura);
      P(p.x, p.y, 0, 0, 0.4, 90 * k, c, RING);
      return;
    }
    p.dashKind = id;
    p.dvx = dx * f.sp * k;
    p.dvy = dy * f.sp * k;
    p.dashT = f.t;
    p.invuln = Math.max(p.invuln, f.t + 0.12);
    p.ghostT = 0;
    const back = Math.atan2(-dy, -dx);
    for (let i = 0; i < (hiQ ? 14 : 6); i++) {
      const a = back + rand(-0.6, 0.6);
      const s = rand(150, 420) * k;
      P(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, rand(0.2, 0.4), rand(1.5, 3) * k, c, SPARK, 4);
    }
    P(p.x, p.y, 0, 0, 0.3, 50 * k, c, RING);
  }
  /** What a move does to the world at the moment it's used (runs where the game is simulated). */
  function moveEffects(p, id) {
    if (net && net.role === 'guest') return;
    const k = view.k;
    if (id === 'gust') {
      // wing gust blows every enemy bullet around you away
      const R = MOVE_FX.gust.clear * k;
      for (const b of ebullets) {
        if (b.dead || dist2(b.x, b.y, p.x, p.y) > R * R) continue;
        if (b.hp) popShootable(b, true);
        else { b.dead = true; spark(b.x, b.y, b.c, 3); }
      }
      P(p.x, p.y, 0, 0, 0.45, R, C.purple, RING);
      sfx('sonic');
    } else if (id === 'spirit') {
      buffs.magnet = Math.max(buffs.magnet, 2.5);
    } else if (id === 'echo') {
      darkT = 0; // bats see in the dark
    }
  }
  /** Every frame, for every ship: move timers, trails, and the damage some moves do (host / single player). */
  function moveTick(p, dt) {
    if (p.auraT > 0) { p.auraT -= dt; if (p.auraT <= 0) { p.auraT = 0; p.auraK = ''; } }
    const id = p.dashT > 0 ? p.dashKind : '';
    if (!id || !p.alive) return;
    const k = view.k;
    // trails everyone can see
    if (id === 'rocket' && Math.random() < dt * 60) P(p.x + rand(-6, 6) * k, p.y + p.h * 0.3, rand(-60, 60) * k, rand(60, 160) * k, rand(0.3, 0.6), rand(2, 3.5) * k, pick([C.gold, C.red, C.cyan, C.pink, C.green]), SPARK, 2);
    if (id === 'flame' && Math.random() < dt * 70) P(p.x + rand(-10, 10) * k, p.y + rand(-6, 10) * k, rand(-20, 20) * k, -rand(20, 70) * k, rand(1.2, 2.2), rand(9, 15) * k, pick([C.orange, C.gold, C.red]), GLOW, 1.5);
    if (id === 'dive' && Math.random() < dt * 50) P(p.x + rand(-p.w, p.w) * 0.4, p.y + rand(-p.h, p.h) * 0.4, 0, 0, 0.3, rand(2, 3) * k, C.red, SPARK, 1);
    if (id === 'roll' && Math.random() < dt * 50) P(p.x, p.y, rand(-200, 200) * k, rand(-200, 200) * k, 0.3, rand(4, 7) * k, pick([C.red, C.gold, C.blue, C.green]), GLOW, 3);
    if (net && net.role === 'guest') return;
    const f = MOVE_FX[id];
    if (f.hit) {
      // firework boost / shadow dive: every mob you fly through gets hit once
      for (const e of enemies) {
        if (e.dead || p.dashHit.has(e) || e.mode === 'dying' || e.mode === 'enter' || !hits(e, p.x, p.y, p.w * 0.45)) continue;
        p.dashHit.add(e);
        hurtEnemy(e, f.hit * p.power, e.x, e.y, 'dash');
        spark(e.x, e.y, id === 'dive' ? C.red : C.gold, 6);
      }
    }
    if (f.reflect) {
      // barrel roll: bullets you touch turn around and hunt the mobs
      const R = f.reflect * k;
      for (const b of ebullets) {
        if (b.dead || b.hp || dist2(b.x, b.y, p.x, p.y) > R * R) continue;
        b.dead = true;
        const sp = 820 * view.vs;
        bullets.push({ x: b.x, y: b.y, vx: -b.vx * 0.5, vy: -Math.abs(b.vy) - sp * 0.5, r: 7 * k, s: 15 * k, orb: C.gold, col: C.gold, dmg: 3 * p.power, pierce: 0, rot: 0, spin: 0, life: 1.6, homing: true, turn: 9, speed: sp, trail: 0, src: 'bullet', last: null, dead: false });
      }
    }
    if (id === 'flame') {
      p.trailT = (p.trailT || 0) - dt;
      if (p.trailT <= 0) { p.trailT = 0.03; fires.push({ x: p.x, y: p.y + p.h * 0.15, r: 30 * k, life: 2.2, tick: 0, power: p.power }); }
    }
  }
  /** Flame-dash fire trails: burn mobs that touch them (host / single player). */
  const fires = [];
  function updateFires(dt) {
    const k = view.k;
    for (const f of fires) {
      f.life -= dt;
      f.tick -= dt;
      if (hiQ && Math.random() < dt * 6) P(f.x + rand(-8, 8) * k, f.y, 0, -rand(30, 70) * k, rand(0.4, 0.7), rand(8, 13) * k, pick([C.orange, C.gold]), GLOW, 1);
      if (f.tick <= 0) {
        f.tick = 0.25;
        for (const e of enemies) if (!e.dead && e.mode !== 'dying' && e.mode !== 'enter' && hits(e, f.x, f.y, f.r)) hurtEnemy(e, 2.5 * f.power, e.x, e.y + e.h * 0.3, 'dash');
      }
    }
    for (let i = fires.length - 1; i >= 0; i--) if (fires[i].life <= 0) fires.splice(i, 1);
  }
  function knockPlayer(x, y, force) {
    const p = player;
    if (!p || !p.alive || p.dashT > 0 || p.intro > 0) return;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy) || 1;
    const kvx = (dx / d) * force;
    const kvy = (dy / d) * force;
    // a guest's ship is steered on the guest's own device, so the shove is sent there
    if (p !== me) { if (net && net.role === 'host') net.sendTo(p.pid, { t: 'E', e: [['kn', r1(kvx), r1(kvy)]] }); return; }
    p.knockT = 0.3;
    p.kvx = kvx;
    p.kvy = kvy;
    Input.vibrate(40);
  }

  /**
   * The special attack (B). Each skin has its own; they all use the one special meter, which fills from
   * your kills and grazes (in co-op the team shares it). Kills made by a special never refill it, and a
   * special can only take a small slice of a boss's health.
   */
  function useNova(p = me) {
    if (state !== 'playing' || !p || !p.alive || p.intro > 0) return;
    if (net && net.role === 'guest') {
      if (nova < 100) UI.denied('nova');
      else net.send({ t: 'nova' });
      return;
    }
    if (nova < 100) { if (p === me) UI.denied('nova'); return; }
    nova = 0;
    novaReadyShown = false;
    stats.novas += 1;
    p.invuln = Math.max(p.invuln, 1.2);
    const u = ultOf(p);
    const cid = ++castSeq;
    castUlt(p, u.id, cid);
    fwd('U', p.pid, u.id, cid);
    if (u.id !== 'nova') popup(p.x, p.y - p.h * 1.1, `${u.name}!`, p.sk ? p.sk.glow : '#ff6ad5', 12, 1.3);
    shake(u.id === 'nova' || u.id === 'mega' ? 0.9 : 0.5);
    slowmo(0.45, u.id === 'nova' ? 0.35 : 0.55);
    if (u.id === 'nova') U.flash('white');
    if (p === me) Input.vibrate([30, 40, 90]);
  }
  let castSeq = 0;
  let ultCtx = 0;  // id of the special doing damage right now (0 = none)
  const ULT_SFX = { nova: 'nova', tnt: 'fuse', arrows: 'cast', breath: 'beam', choir: 'totem', swarm: 'vex', rainbow: 'levelup', screech: 'shriek', inferno: 'blaze', mega: 'ghast', bloodmoon: 'darkness' };
  /** A special can take at most 5% of a boss's health, however much it hits. */
  function capUlt(e, dmg, id) {
    if (e.ultId !== id) { e.ultId = id; e.ultTaken = 0; }
    const d = Math.min(dmg, Math.max(0, e.maxHp * 0.05 - e.ultTaken));
    e.ultTaken += d;
    return d;
  }
  /** Hit every mob on screen (or within r of x, y) as part of special `id`. */
  function ultHitAll(id, dmg, x, y, r) {
    ultCtx = id;
    novaLock += 1;
    for (const e of enemies) {
      if (e.dead || e.mode === 'dying' || e.mode === 'enter' || e.y < -e.h || e.y > view.h + e.h) continue;
      if (r && dist2(e.x, e.y, x, y) > (r + e.r) * (r + e.r)) continue;
      hurtEnemy(e, dmg, e.x, e.y, 'ult');
    }
    novaLock -= 1;
    ultCtx = 0;
  }
  /** A special's projectile: player bullet with a sprite, optional gravity and an explosion. */
  function ultShot(p, cid, o) {
    const k = view.k;
    const s = (o.s || 18) * k;
    bullets.push({
      x: o.x ?? p.x, y: o.y ?? p.y - p.h * 0.3, vx: o.vx || 0, vy: o.vy || 0, r: (o.r || s / (2.4 * k)) * k, s,
      c: o.img ? sprite(o.img, s, s) : null, orb: o.orb || null, col: o.col || C.white, dmg: (o.dmg || 0) * p.power, pierce: o.pierce || 0,
      rot: rand(TAU), spin: o.spin ?? rand(-8, 8), life: o.life || 2, homing: !!o.homing, turn: o.turn || 8, speed: (o.speed || 900) * view.vs,
      trail: 0, src: 'ult', uid: cid, boom: o.boom ? { ...o.boom, dmg: o.boom.dmg * p.power } : null, grav: (o.grav || 0) * k, top: !!o.top, last: null, dead: false,
    });
  }
  /** Starts special `id` for ship p. Runs on the host (for real) and on guests (just the visible part). */
  function castUlt(p, id, cid) {
    const real = !(net && net.role === 'guest');
    const k = view.k;
    const vs = view.vs;
    if (real) sfx(ULT_SFX[id] || 'nova');
    switch (id) {
      case 'nova':
        if (real) { startNova(p.x, p.y, p.power); P(p.x, p.y, 0, 0, 0.5, 160 * k, C.pink, GLOW); }
        break;
      case 'tnt': {
        // 8 lit TNT blocks lobbed onto the nearest mobs (or up the screen if there are none); each blows up where it lands
        const targets = enemies.filter((e) => !e.dead && e.mode !== 'dying' && e.y > 0 && e.y < view.h).sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
        const g = 900 * k;
        for (let i = 0; i < 8; i++) {
          const T = 0.55 + (i % 4) * 0.07;
          const e = targets.length ? targets[i % Math.min(targets.length, 8)] : null;
          const tx = e ? e.x + (i >= targets.length ? rand(-60, 60) * k : 0) : p.x + (-0.85 + (i / 7) * 1.7) * 340 * k;
          const ty = e ? e.y : Math.max(view.h * 0.12, p.y - 420 * k);
          ultShot(p, cid, { img: 'tnt', s: 30, r: 13, x: p.x, y: p.y - p.h * 0.3, vx: (tx - p.x) / T, vy: (ty - (p.y - p.h * 0.3) - 0.5 * g * T * T) / T, grav: g / k, life: T, col: C.orange, boom: { R: 125, dmg: 16, pal: PAL.tnt, gc: C.orange } });
        }
        break;
      }
      case 'mega':
        // one huge fireball that drifts toward the nearest mob and explodes on contact
        ultShot(p, cid, { img: 'b3', s: 86, r: 36, vy: -560 * vs, spin: 3, life: 1.8, homing: true, turn: 2.2, speed: 600, col: C.orange, boom: { R: 270, dmg: 46, pal: PAL.fire, gc: C.orange } });
        break;
      case 'swarm':
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          ultShot(p, cid, { img: 'skin_bee', s: 24, r: 10, vx: Math.cos(a) * 380 * k, vy: Math.sin(a) * 380 * k - 200 * vs, homing: true, turn: 6, speed: 720, dmg: 5, pierce: 1, life: 3.2, spin: 0, col: C.gold });
        }
        break;
      case 'arrows':
      case 'inferno':
      case 'breath':
      case 'screech':
      case 'bloodmoon':
        // these play out over a few seconds (see ultTick)
        p.ultFx = { k: id, cid, t: { arrows: 0.9, inferno: 0.75, breath: 3, screech: 0.95, bloodmoon: 5 }[id], cd: 0, n: 0 };
        if (real && id === 'bloodmoon') buffs.timewarp = Math.max(buffs.timewarp, 5);
        break;
      case 'choir':
        if (!real) break;
        // heal the whole team, shield everyone and call the allay drones
        for (const q of players) {
          if (!q.alive) continue;
          if (q.hp < q.maxHp) { q.hp += 1; heartPop(q, 1); }
          P(q.x, q.y, 0, 0, 0.7, 150 * k, C.cyan, RING);
          burst(q.x, q.y, C.cyan, hiQ ? 14 : 6, 220);
        }
        buffs.shield = Math.max(buffs.shield, 4);
        if (buffs.drones <= 0) resetDrones(p);
        buffs.drones = Math.max(buffs.drones, 10);
        droneUlt = cid; // the choir's drones are part of the special: their kills don't refill the meter
        break;
      case 'rainbow': {
        if (!real) break;
        // every enemy bullet turns into points, and every mob takes a hit
        let n = 0;
        for (const b of ebullets) {
          if (b.dead) continue;
          b.dead = true;
          n += 1;
          if (hiQ && n % 2 === 0) P(b.x, b.y, 0, -60 * k, 0.5, 10 * k, pick([C.red, C.gold, C.green, C.cyan, C.purple]), GLOW);
        }
        if (n) popup(p.x, p.y - p.h * 1.6, `+${fmt(addScore(n * 10))}`, '#ffe066', 11, 1.2);
        ultHitAll(cid, 14 * p.power);
        [C.red, C.orange, C.gold, C.green, C.cyan, C.purple].forEach((c, i) => P(p.x, p.y, 0, 0, 0.7 + i * 0.08, (260 + i * 60) * k, c, RING));
        break;
      }
      default:
        break;
    }
  }
  /** Specials that play out over time: volleys, breath, sonar pulses, the blood moon. */
  function ultTick(p, dt) {
    const u = p.ultFx;
    if (!u) return;
    if (!p.alive) { p.ultFx = null; return; }
    const real = !(net && net.role === 'guest');
    const k = view.k;
    u.t -= dt;
    u.cd -= dt;
    switch (u.k) {
      case 'arrows':
        // 3 waves of 10 enchanted arrows
        if (u.cd <= 0 && u.n < 3) {
          u.cd = 0.3;
          u.n += 1;
          for (let i = 0; i < 10; i++) {
            const a = -1.1 + (i / 9) * 2.2;
            ultShot(p, u.cid, { orb: C.purple, s: 16, r: 7, vx: Math.sin(a) * 700 * k, vy: -Math.cos(a) * 700 * view.vs, homing: true, turn: 8, speed: 980, dmg: 4, life: 2.2, spin: 0, col: C.purple });
          }
          if (real) sfx('missile');
        }
        break;
      case 'inferno':
        // 3 rings of fireballs
        if (u.cd <= 0 && u.n < 3) {
          u.cd = 0.25;
          u.n += 1;
          const off = u.n * 0.35;
          for (let i = 0; i < 18; i++) {
            const a = off + (i / 18) * TAU;
            ultShot(p, u.cid, { img: 'b2', s: 26, r: 10, vx: Math.cos(a) * 640 * k, vy: Math.sin(a) * 640 * k, dmg: 4.5, pierce: 1, life: 1.6, spin: 10, col: C.orange });
          }
          if (real) sfx('blaze');
        }
        break;
      case 'breath':
        // a column of dragon fire straight up from the ship
        if (Math.random() < dt * (hiQ ? 60 : 25)) P(p.x + rand(-30, 30) * k, rand(0, p.y - p.h * 0.5), rand(-30, 30) * k, -rand(80, 200) * k, rand(0.3, 0.6), rand(10, 18) * k, pick([C.purple, C.pink]), GLOW, 2);
        if (real && u.cd <= 0) {
          u.cd = 0.1;
          const W = 58 * k;
          ultCtx = u.cid;
          novaLock += 1;
          for (const e of enemies) {
            if (e.dead || e.mode === 'dying' || e.mode === 'enter' || e.y > p.y || Math.abs(e.x - p.x) > W + e.w * 0.3) continue;
            hurtEnemy(e, 3.2 * p.power, e.x, e.y + e.h * 0.3, 'ult');
          }
          novaLock -= 1;
          ultCtx = 0;
          for (const b of ebullets) if (!b.dead && b.y < p.y && Math.abs(b.x - p.x) < W) { b.dead = true; spark(b.x, b.y, C.purple, 2); }
        }
        break;
      case 'screech':
        // three sonar rings, 0.3s apart
        if (real && u.cd <= 0 && u.n < 3) {
          u.cd = 0.3;
          u.n += 1;
          const R = 320 * k;
          P(p.x, p.y, 0, 0, 0.55, R, C.gold, RING);
          P(p.x, p.y, 0, 0, 0.45, R * 0.8, C.white, RING);
          ultHitAll(u.cid, 14 * p.power, p.x, p.y, R);
          for (const e of enemies) if (!e.dead && !e.T.boss && !e.T.persist && dist2(e.x, e.y, p.x, p.y) < R * R) e.y -= 45 * k;
          for (const b of ebullets) if (!b.dead && dist2(b.x, b.y, p.x, p.y) < R * R) { if (b.hp) popShootable(b, true); else { b.dead = true; spark(b.x, b.y, C.gold, 2); } }
          shake(0.3);
          sfx('sonic');
        }
        break;
      case 'bloodmoon':
        // every mob on screen bleeds for 5 seconds
        if (real && u.cd <= 0) { u.cd = 0.5; ultHitAll(u.cid, 5 * p.power); }
        break;
      default:
        break;
    }
    if (u.t <= 0) p.ultFx = null;
  }
  function boomShot(b) {
    const o = b.boom;
    ultCtx = b.uid || 0;
    novaLock += 1;
    blast(b.x, b.y, o.R * view.k, o.dmg, o.pal, o.gc, true, '', 0);
    novaLock -= 1;
    ultCtx = 0;
  }
  function startNova(x, y, power = me ? me.power : 1) {
    novaFx = { id: ++novaId, x, y, r: 0, max: Math.hypot(view.w, view.h) * 1.05, power };
  }
  function updateNova(dt) {
    if (!novaFx) return;
    const n = novaFx;
    n.r += (1500 * view.k + n.r * 1.5) * dt;
    if (net && net.role === 'guest') { if (n.r > n.max) novaFx = null; return; } // the host does the damage
    const rr = n.r * n.r;
    // kills made by the Nova (and any explosions it sets off) never recharge it
    novaLock += 1;
    for (const e of enemies) {
      if (e.dead || e.novaId === n.id || dist2(e.x, e.y, n.x, n.y) > rr) continue;
      e.novaId = n.id;
      // against bosses the Nova is capped at 4% of their health
      hurtEnemy(e, e.T.boss ? Math.min(45 * n.power, e.maxHp * 0.04) : 30 * n.power, e.x, e.y, 'nova');
    }
    novaLock -= 1;
    for (const b of ebullets) {
      if (b.dead || dist2(b.x, b.y, n.x, n.y) > rr) continue;
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

  /** Boss heavy hits (beams, slams, body contact, lasers) cost 2 hearts on Hard. */
  const heavyDmg = () => (diffKey === 'hard' && bossLevel >= 2 ? 2 : 1);
  /** Returns 0 = no hit, 1 = blocked by the shield, 2 = took damage. `who` defaults to the current target. */
  function hurtPlayer(dmg = 1, who = player) {
    const p = who;
    if (!p || !p.alive || p.intro > 0) return 0;
    if (buffs.shield > 0) { sfx('shield'); return 1; }
    if (p.invuln > 0 || p.dashT > 0) return 0;
    if (godMode && p === me) { botHits += dmg; p.invuln = boss ? 2.1 : 1.7; return 0; } // counts would-be hits for testing
    p.hp -= dmg;
    heartPop(p, -dmg);
    if (dmg > 1) popup(p.x, p.y - p.h * 1.2, `-${dmg} HEARTS`, '#ff4d5e', 12, 1.2);
    p.invuln = boss ? 2.1 : 1.7; // a little extra breathing room during boss fights
    wave.hurt = true;
    stats.damage += 1;
    if (combo >= 3) popup(p.x, p.y - p.h, 'COMBO LOST', '#ff4d5e', 10, 1);
    resetCombo();
    explode(p.x, p.y, PAL.player, 0.8, C.cyan);
    // mercy: wipe bullets right next to the ship
    const R = 140 * view.k;
    for (const b of ebullets) {
      if (!b.dead && dist2(b.x, b.y, p.x, p.y) < R * R) { b.dead = true; spark(b.x, b.y, b.c, 3); }
    }
    // the shake, flash, rumble and sound belong to whoever got hit
    if (p === me) hitFeedback();
    else if (net && net.role === 'host') net.sendTo(p.pid, { t: 'E', e: [['hurt']] });
    // pets react: the wolf goes wild, the axolotl's bubble saves you at your last heart
    if (p.pet && p.hp > 0) {
      if (p.pet.id === 'wolf') { if (!(p.pet.rage > 0)) sfx('bark'); p.pet.rage = 6; }
      if (p.pet.id === 'axolotl' && p.hp === 1 && p.maxHp > 1 && p.pet.bubble) petBubble(p);
    }
    if (p.hp <= 0) {
      if (p.totem) useTotem(p);
      else playerDie(p);
    }
    return 2;
  }
  function hitFeedback() {
    trauma = Math.min(1, trauma + 0.65);
    hitstop = 0.07;
    Sfx.play('hurt');
    Input.vibrate([60, 30, 60]);
    UI.flash('hurt');
  }
  /** Heart animation above a ship: breaks when hearts are lost, pops when one is gained. */
  function heartPop(p, delta) {
    addHeartFx(p.pid, delta);
    fwd('hf', p.pid, delta);
  }
  function addHeartFx(pid, delta) {
    if (heartFx.length > 12) heartFx.shift();
    const p = players.find((q) => q.pid === pid);
    heartFx.push({ pid, d: delta, t: 0, x: p ? p.x : view.w / 2, y: p ? p.y : view.h / 2, seed: Math.random() });
  }
  function useTotem(p = player) {
    const k = view.k;
    p.totem = false;
    p.hp = Math.min(rules.totemHearts, p.maxHp);
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
    startNova(p.x, p.y, p.power);
    heartPop(p, p.hp);
    sfx('totem');
    if (p === me) { UI.flash('gold'); Input.vibrate([60, 40, 120]); }
    else if (net && net.role === 'host') net.sendTo(p.pid, { t: 'E', e: [['F', 'gold']] });
    slowmo(1, 0.3);
    shake(0.6);
  }
  function playerDie(p = player) {
    p.alive = false;
    p.fireOn = false;
    if (net) { teammateDown(p); return; }
    state = 'dying';
    dieT = 0;
    explode(p.x, p.y, PAL.player, 2.6, C.cyan);
    P(p.x, p.y, 0, 0, 0.9, 260 * view.k, C.cyan, RING);
    P(p.x, p.y, 0, 0, 0.6, 200 * view.k, C.white, GLOW);
    sfx('bigExplode');
    music(null);
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
    const targets = enemies.filter((e) => !e.dead && !e.inv && e.y > 0 && e.y < view.h && e.mode !== 'dying' && e.mode !== 'enter' && e.type !== 'sighting');
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
      hurtEnemy(t, (t.T.boss ? 8 : 5) * teamPower(), t.x, t.y, 'storm');
    }
    sfx('thunder');
    shake(0.15);
  }
  const alivePlayers = () => players.filter((p) => p.alive);
  // a teammate's ship is a few frames behind on the host, so its hitbox is a little forgiving
  const hitR = (p) => (p === me ? p.r : p.r * 0.8);
  const teamPower = () => players.reduce((m, p) => (p.alive ? Math.max(m, p.power) : m), 1);
  /** Allay drones follow whoever picked them up (or any teammate still flying). */
  let droneOwner = null;
  let droneUlt = 0; // set while the drones were called by the Allay Choir special
  const droneHost = () => (droneOwner && droneOwner.alive && players.includes(droneOwner) ? droneOwner : alivePlayers()[0] || null);
  function resetDrones(p = player) {
    droneOwner = p;
    for (const d of drones) { d.x = p.x; d.y = p.y; }
  }
  function updateDrones(dt) {
    const o = droneHost();
    if (buffs.drones <= 0 || !o) return;
    const k = view.k;
    droneA += dt * 2.2;
    droneFire -= dt;
    const shoot = droneFire <= 0;
    if (shoot) droneFire = 0.36;
    for (let i = 0; i < 2; i++) {
      const d = drones[i];
      const a = droneA + i * Math.PI;
      d.x = damp(d.x, o.x + Math.cos(a) * 60 * k, 12, dt);
      d.y = damp(d.y, o.y + Math.sin(a) * 26 * k - 12 * k, 12, dt);
      if (shoot) {
        const t = nearestEnemy(d.x, d.y);
        if (t) {
          const ang = Math.atan2(t.y - d.y, t.x - d.x);
          const sp = 760 * view.vs;
          bullets.push({ x: d.x, y: d.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 7 * k, s: 14 * k, orb: C.cyan, col: C.cyan, dmg: o.power, pierce: 0, rot: 0, spin: 0, life: 1.6, homing: true, turn: 9, speed: 860 * view.vs, trail: 0, src: droneUlt ? 'ult' : 'missile', uid: droneUlt, last: null, dead: false });
        }
      }
      if (hiQ && Math.random() < dt * 12) P(d.x, d.y, rand(-20, 20) * k, rand(20, 60) * k, 0.4, 6 * k, C.cyan, GLOW, 2);
    }
  }
  function drawDrones() {
    if (buffs.drones <= 0 || !droneHost()) return;
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

  // ================================================================ pets
  // Every ship can bring a pet (picked in the PETS menu, see pets.js). Their abilities run on the host
  // (or in single player); guests draw them where the host's updates say they are.
  const petData = (id) => (typeof PETS !== 'undefined' && id && id !== 'none' ? PETS.find((q) => q.id === id) || null : null);
  const petKey = (d) => d.img.replace(/\.png$/i, '');
  const PET_MODES = ['follow', 'go', 'back', 'gone'];
  function makePet(id) {
    const d = petData(id);
    if (!d) return null;
    return {
      id: d.id, def: d, key: petKey(d), gc: hexCol(d.glow), x: 0, y: 0, nx: 0, ny: 0, mode: 'follow', t: rand(TAU), cd: rand(1, 2), tgt: null, goT: 0,
      face: 1, rage: 0, gift: 25, regen: 0, bubble: true, snack: 4, tongue: null, carry: null, kills: 0,
    };
  }
  const hasPet = (p, id) => !!(p && p.alive && p.pet && p.pet.id === id);
  /** The Allay's song: the special meter fills 30% faster while an Allay flies with the team. */
  const novaGain = (v) => v * (players.some((p) => hasPet(p, 'allay')) ? 1.3 : 1);
  /** Creepers and phantoms are scared of cats: the owner of a cat within r of (x, y), if any. */
  function catNear(x, y, r) {
    for (const p of players) if (hasPet(p, 'cat') && dist2(p.x, p.y, x, y) < r * r) return p;
    return null;
  }
  const petDmg = (p, base) => base * (1 + wave.n * 0.05) * p.power;
  const petHome = (p, pt) => ({ x: p.x - 62 * view.k, y: p.y + 30 * view.k + Math.sin(pt.t * 3) * 5 * view.k });
  /** Move a pet toward (x, y); true once it gets there. */
  function petMove(pt, x, y, speed, dt) {
    const dx = x - pt.x;
    const dy = y - pt.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) { pt.x = x; pt.y = y; return true; }
    pt.x += (dx / d) * step;
    pt.y += (dy / d) * step;
    return false;
  }
  /** What a hunting pet goes for: the nearest mob around its owner (a boss only when no mob is left). */
  function petTarget(p, range) {
    let best = null;
    let bd = range * range;
    let bossT = null;
    for (const e of enemies) {
      if (e.dead || e.inv || e.mode === 'dying' || e.mode === 'enter' || e.y < 0 || e.y > view.h || e.type === 'illusion' || e.type === 'sighting') continue;
      if (e.T.boss) { bossT = e; continue; }
      const d = dist2(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best || bossT;
  }
  function petTongue(p, pt, x, y) {
    pt.acts = (pt.acts || 0) + 1;
    pt.tongue = { x, y, t: 0.2 };
    fwd('pe', p.pid, 'tongue', r1(x), r1(y));
    sfx('gulp');
  }
  /** Axolotl: once per wave, dropping to the last heart puts you in a bubble that pops nearby bullets. */
  function petBubble(p) {
    p.pet.bubble = false;
    p.invuln = Math.max(p.invuln, 3);
    p.bubbleT = 3;
    popup(p.x, p.y - p.h * 1.3, 'BUBBLE!', '#ff8ac0', 12, 1.2);
    const R = 240 * view.k;
    for (const b of ebullets) if (!b.dead && dist2(b.x, b.y, p.x, p.y) < R * R) { b.dead = true; spark(b.x, b.y, C.pink, 2); }
    sfx('bubble');
    fwd('pe', p.pid, 'bubble', 3, 0);
  }
  /** Hunters (wolf, bee): dash at a mob, hit it on arrival, then fly back. */
  function petHunt(p, pt, dt, o) {
    const k = view.k;
    pt.cd -= dt;
    if (pt.mode === 'follow' && pt.cd <= 0) {
      const t = petTarget(p, o.range * k);
      if (t) { pt.mode = 'go'; pt.tgt = t; pt.goT = o.chase; if (o.sound && Math.random() < 0.35) sfx(o.sound); }
      else pt.cd = 0.3;
    }
    if (pt.mode !== 'go') return;
    const t = pt.tgt;
    pt.goT -= dt;
    if (!t || t.dead || t.inv || t.mode === 'dying' || pt.goT <= 0) { pt.mode = 'back'; pt.cd = 0.4; pt.tgt = null; return; }
    petMove(pt, t.x + (o.wiggle ? Math.sin(pt.t * 20) * 8 * k : 0), t.y, o.speed * k, dt);
    if (!hits(t, pt.x, pt.y, 12 * k)) return;
    o.hit(t);
    pt.acts = (pt.acts || 0) + 1;
    pt.mode = 'back';
    pt.tgt = null;
    pt.cd = o.cd;
  }
  const PET_AI = {
    wolf(p, pt, dt) {
      const k = view.k;
      const rage = pt.rage > 0;
      if (rage) pt.rage -= dt;
      petHunt(p, pt, dt, {
        range: 440, chase: 0.75, speed: rage ? 1600 : 1200, cd: rage ? 0.45 : 1.05, sound: 'bark',
        hit(t) {
          hurtEnemy(t, petDmg(p, rage ? 3.3 : 2.2), pt.x, pt.y, 'pet');
          P(pt.x, pt.y, 0, 0, 0.25, 34 * k, rage ? C.red : C.white, RING);
          spark(pt.x, pt.y, C.white, 4);
        },
      });
    },
    bee(p, pt, dt) {
      const fury = p.hp === 1 && p.maxHp > 1;
      petHunt(p, pt, dt, {
        range: 480, chase: 0.95, speed: 1000, cd: fury ? 0.65 : 2, sound: 'buzz', wiggle: true,
        hit(t) {
          hurtEnemy(t, petDmg(p, 1), pt.x, pt.y, 'pet');
          if (!t.dead) { t.poisonT = 4; t.poisonD = petDmg(p, t.T.boss ? 2.4 : 1.2); }
          burst(pt.x, pt.y, C.green, hiQ ? 6 : 3, 160);
        },
      });
    },
    cat(p, pt, dt) {
      const k = view.k;
      // MORNING GIFT
      pt.gift -= dt;
      if (pt.gift <= 0) {
        pt.gift = 40;
        pt.gifts = (pt.gifts || 0) + 1;
        spawnPickup(pick(POWER_POOL), pt.x, pt.y - 10 * k, 0, -60 * view.vs);
        popup(pt.x, pt.y - 24 * k, 'GIFT!', '#ffb35a', 10, 1.1);
        sfx('meow');
      }
      // hisses at the mobs it is scaring off
      pt.cd -= dt;
      if (pt.cd <= 0) {
        pt.cd = 2.5;
        const R = 300 * k;
        if (enemies.some((e) => !e.dead && (e.type === 'creeper' || e.type === 'phantom') && dist2(e.x, e.y, p.x, p.y) < R * R)) popup(pt.x, pt.y - 22 * k, 'HSSS!', '#ffb35a', 9, 0.8);
      }
    },
    allay(p, pt, dt) {
      const k = view.k;
      // FETCH: fly out to the farthest-flung pickup and carry it back
      if (pt.mode === 'follow' && !pt.carry) {
        let best = null;
        let bd = Infinity;
        for (const pk of pickups) {
          if (pk.dead || pk.carry || pk.t < 0.3) continue;
          const d = dist2(pk.x, pk.y, p.x, p.y);
          if (d < 130 * k * 130 * k) continue; // close ones fly to you anyway
          if (d < bd) { bd = d; best = pk; }
        }
        if (best) { pt.mode = 'go'; pt.tgt = best; best.carry = p.pid; pt.goT = 3; }
      }
      if (pt.mode === 'go' && !pt.carry) {
        const pk = pt.tgt;
        pt.goT -= dt;
        if (!pk || pk.dead || pt.goT <= 0) { if (pk) pk.carry = 0; pt.mode = 'back'; pt.tgt = null; return; }
        if (petMove(pt, pk.x, pk.y, 1100 * k, dt)) { pt.carry = pk; pt.tgt = null; pt.mode = 'back'; pt.fetched = (pt.fetched || 0) + 1; sfx('chime'); }
      }
      if (pt.carry) {
        const pk = pt.carry;
        if (pk.dead) { pt.carry = null; return; }
        pk.x = pt.x;
        pk.y = pt.y - 16 * k;
        if (pt.mode === 'follow' || dist2(pt.x, pt.y, p.x, p.y) < 70 * k * 70 * k) { pk.carry = 0; pk.x = p.x; pk.y = p.y; pt.carry = null; }
      }
    },
    frog(p, pt, dt) {
      const k = view.k;
      pt.cd -= dt;
      pt.snack -= dt;
      if (pt.cd <= 0) {
        // TONGUE SNAP: the enemy bullet closest to the ship
        let best = null;
        let bd = 150 * k * 150 * k;
        for (const b of ebullets) {
          if (b.dead || EB[b.kind].ghost) continue;
          const d = dist2(b.x, b.y, p.x, p.y);
          if (d < bd) { bd = d; best = b; }
        }
        if (best) {
          best.dead = true;
          petTongue(p, pt, best.x, best.y);
          spark(best.x, best.y, best.c, 4);
          pt.eaten = (pt.eaten || 0) + 1;
          pt.cd = 1.5;
        } else {
          pt.cd = 0.12;
        }
      }
      if (pt.snack <= 0) {
        // SNACK TIME: small mobs get swallowed whole
        let best = null;
        let bd = 360 * k * 360 * k;
        for (const e of enemies) {
          if (e.dead || e.inv || e.y < 0) continue;
          if (!(e.type === 'vex' || e.type === 'phantom' || ((e.type === 'slime' || e.type === 'magmacube') && e.size === 1))) continue;
          const d = dist2(e.x, e.y, p.x, p.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          petTongue(p, pt, best.x, best.y);
          popup(best.x, best.y - 10 * k, 'GULP!', '#ffb070', 10, 0.9);
          killEnemy(best, 'pet');
          sfx('croak');
          pt.snack = 7;
        } else {
          pt.snack = 0.4;
        }
      }
    },
    axolotl(p, pt, dt) {
      // REGENERATION
      if (p.hp >= p.maxHp) { pt.regen = 0; return; }
      pt.regen += dt;
      if (pt.regen < 40) return;
      pt.regen = 0;
      p.hp += 1;
      heartPop(p, 1);
      popup(p.x, p.y - p.h, '+1 HEART', '#ff8ac0', 11, 1.1);
      burst(p.x, p.y, C.pink, hiQ ? 10 : 5, 200);
      sfx('bubble');
    },
  };
  function updatePets(dt) {
    for (const p of players) {
      const pt = p.pet;
      if (!pt) continue;
      pt.t += dt;
      if (pt.tongue && (pt.tongue.t -= dt) <= 0) pt.tongue = null;
      const home = petHome(p, pt);
      if (!p.alive) {
        // waits off screen while its owner is down
        if (pt.carry) { pt.carry.carry = 0; pt.carry = null; }
        if (pt.tgt && pt.tgt.carry) pt.tgt.carry = 0;
        pt.mode = 'gone';
        pt.tgt = null;
        continue;
      }
      if (pt.mode === 'gone') { pt.mode = 'follow'; pt.x = home.x; pt.y = home.y + 60 * view.k; }
      const ox = pt.x;
      PET_AI[pt.id](p, pt, dt);
      if (pt.mode === 'follow') {
        pt.x = damp(pt.x, home.x, 6, dt);
        pt.y = damp(pt.y, home.y, 6, dt);
      } else if (pt.mode === 'back' && petMove(pt, home.x, home.y, 1200 * view.k, dt)) {
        pt.mode = 'follow';
      }
      if (Math.abs(pt.x - ox) > 0.2) pt.face = pt.x > ox ? 1 : -1;
    }
  }
  /** Guests: glide each pet to where the host says it is. */
  function petsNet(dt) {
    for (const p of players) {
      const pt = p.pet;
      if (!pt) continue;
      pt.t += dt;
      if (pt.tongue && (pt.tongue.t -= dt) <= 0) pt.tongue = null;
      const ox = pt.x;
      pt.x = damp(pt.x, pt.nx, 16, dt);
      pt.y = damp(pt.y, pt.ny, 16, dt);
      if (Math.abs(pt.x - ox) > 0.2) pt.face = pt.x > ox ? 1 : -1;
    }
  }
  function drawPets() {
    const k = view.k;
    for (const p of players) {
      const pt = p.pet;
      if (!pt || !p.alive || pt.mode === 'gone') continue;
      const d = pt.def;
      const w = 34 * k;
      const h = w * d.ar;
      const x = pt.x;
      const y = pt.y + Math.sin(time * 5 + p.pid) * 2.5 * k;
      ctx.globalCompositeOperation = 'lighter';
      glow(pt.rage > 0 ? C.red : pt.gc, x, y, w * 0.95, pt.rage > 0 ? 0.55 : 0.3);
      ctx.globalCompositeOperation = 'source-over';
      if (pt.tongue) {
        // the frog's tongue shoots out and snaps back
        const e = Math.sin((1 - pt.tongue.t / 0.2) * Math.PI);
        world();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ff6a8a';
        ctx.lineWidth = 3.2 * k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.2);
        ctx.lineTo(lerp(x, pt.tongue.x, e), lerp(y + h * 0.2, pt.tongue.y, e));
        ctx.stroke();
      }
      if (d.id === 'bee' || d.id === 'allay') {
        const f = 0.5 + 0.5 * Math.sin(time * 42 + p.pid);
        world();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = '#eef9ff';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(x + s * w * 0.42, y - h * 0.22, w * 0.3, h * (0.1 + f * 0.14), s * 0.5, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      blit(sprite(pt.key, w, h), x, y, w, h, pt.mode === 'go' ? 0.2 * pt.face : Math.sin(time * 2 + p.pid) * 0.08);
      if (d.id === 'wolf' && pt.rage > 0) {
        ctx.globalCompositeOperation = 'lighter';
        glow(C.red, x - w * 0.2, y - h * 0.06, 8 * k, 0.9);
        glow(C.red, x + w * 0.2, y - h * 0.06, 8 * k, 0.9);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (d.id === 'axolotl') {
        world();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#ffd0e8';
        ctx.lineWidth = 1.5 * k;
        ctx.beginPath();
        ctx.arc(x, y, w * 0.68, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function updateGhosts(dt) {
    for (const g of ghosts) { g.a -= dt * 3; if (g.a <= 0) g.dead = true; }
    compact(ghosts);
  }
  function drawPlayers() {
    for (const g of ghosts) {
      ctx.globalAlpha = g.a;
      blit(sprite(g.key, g.w, g.h, 'cyan'), g.x, g.y, g.w, g.h, g.rot);
    }
    ctx.globalAlpha = 1;
    for (const p of players) if (p.alive && p.ultFx && p.ultFx.k === 'breath') drawBreath(p);
    drawPets();
    for (const p of players) if (p !== me) drawShip(p);
    if (me) drawShip(me); // your own ship on top
    drawDrones();
    if (players.length > 1) drawTags();
    drawHeartFx();
  }
  /** Dragon Breath: a column of purple fire from the ship to the top of the screen. */
  function drawBreath(p) {
    const k = view.k;
    const u = p.ultFx;
    const fade = Math.min(1, u.t / 0.3, (3 - u.t) / 0.2 + 0.2);
    const W = 58 * k * (1 + Math.sin(time * 30) * 0.06);
    const top = -10;
    const bot = p.y - p.h * 0.45;
    world();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(p.x - W, 0, p.x + W, 0);
    g.addColorStop(0, 'rgba(163,58,214,0)');
    g.addColorStop(0.3, `rgba(192,96,255,${0.45 * fade})`);
    g.addColorStop(0.5, `rgba(255,220,255,${0.9 * fade})`);
    g.addColorStop(0.7, `rgba(192,96,255,${0.45 * fade})`);
    g.addColorStop(1, 'rgba(163,58,214,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(p.x - W, top, W * 2, bot - top);
    glow(C.purple, p.x, bot, W * 1.6, 0.8 * fade);
    ctx.globalCompositeOperation = 'source-over';
  }
  /** Blood Moon: the sky turns red while any ship's blood moon is up. */
  function drawBloodMoon() {
    const on = players.find((p) => p.ultFx && p.ultFx.k === 'bloodmoon');
    if (!on) return;
    const a = Math.min(1, on.ultFx.t / 0.6, (5 - on.ultFx.t) / 0.4);
    base();
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(view.w / 2, view.h * 0.45, Math.min(view.w, view.h) * 0.2, view.w / 2, view.h * 0.45, Math.max(view.w, view.h) * 0.75);
    g.addColorStop(0, 'rgba(120,0,20,0)');
    g.addColorStop(1, `rgba(150,0,25,${0.45 * a})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.globalCompositeOperation = 'lighter';
    glow(C.red, view.w * 0.82, view.h * 0.12, 90 * view.k, 0.7 * a);
    glow(C.white, view.w * 0.82, view.h * 0.12, 34 * view.k, 0.5 * a);
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawShip(p) {
    if (!p || !p.alive) return;
    const k = view.k;
    const pc = sprite(p.skinKey, p.w, p.h);
    const od = buffs.overdrive > 0;
    ctx.globalCompositeOperation = 'lighter';
    // the teammate you are watching gets a soft ring
    if (specPid && p.pid === specPid && me && !me.alive) glow(colS(netColor(p.pid)), p.x, p.y, Math.max(p.w, p.h) * 1.4, 0.3 + 0.12 * Math.sin(time * 5));
    glow(od ? C.purple : p.glowC, p.x, p.y + p.h * 0.1, Math.max(p.w, p.h) * 0.9, 0.33 + 0.08 * Math.sin(time * 6));
    if (p.weapon >= 5) glow(C.gold, p.x, p.y, p.w * 1.1, 0.16 + 0.08 * Math.sin(time * 5));
    if (p.auraK === 'echo') glow(C.purple, p.x, p.y, Math.max(p.w, p.h) * 1.2, 0.45);
    ctx.globalCompositeOperation = 'source-over';
    const aura = p.auraT > 0 ? p.auraK : '';
    const blink = p.invuln > 0 && p.dashT <= 0 && !aura && Math.floor(time * 20) % 2 === 0;
    ctx.globalAlpha = blink ? 0.3 : aura === 'echo' ? 0.45 : 1;
    const flap = 1 + Math.sin(time * 9) * 0.045;
    // barrel roll: the ship spins once
    const spin = p.dashT > 0 && p.dashKind === 'roll' ? (1 - p.dashT / MOVE_FX.roll.t) * TAU : 0;
    blit(pc, p.x, p.y + p.recoil * 3 * k, p.w, p.h, p.tilt * 0.28 + spin, (1 - Math.abs(p.tilt) * 0.2) * flap, 1);
    if (aura === 'puff') {
      // ghast bubble
      const R = Math.max(p.w, p.h) * 0.75;
      const f = Math.min(1, p.auraT / 0.3);
      ctx.globalCompositeOperation = 'lighter';
      glow(C.white, p.x, p.y, R * 1.3, 0.2 * f);
      world();
      ctx.globalAlpha = (0.6 + 0.3 * Math.sin(time * 12)) * f;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * k;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.5 * f;
      ctx.beginPath(); ctx.arc(p.x - R * 0.3, p.y - R * 0.35, R * 0.18, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (debuffs.fatigue > 0) {
      ctx.globalAlpha = 0.3;
      blit(sprite(p.skinKey, p.w, p.h, 'purple'), p.x, p.y + p.recoil * 3 * k, p.w, p.h, p.tilt * 0.28, (1 - Math.abs(p.tilt) * 0.2) * flap, 1);
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
    if (p.bubbleT > 0) {
      // the axolotl's bubble
      const R = Math.max(p.w, p.h) * 0.72 * (1 + Math.sin(time * 6) * 0.04);
      const f = Math.min(1, p.bubbleT / 0.4);
      world();
      ctx.globalAlpha = 0.22 * f;
      ctx.fillStyle = '#ffb0d8';
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = (0.65 + 0.25 * Math.sin(time * 10)) * f;
      ctx.strokeStyle = '#ffe0f0';
      ctx.lineWidth = 2.5 * k;
      ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x - R * 0.35, p.y - R * 0.4, R * 0.16, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  const netColor = (pid) => (typeof Net !== 'undefined' ? Net.color(pid) : '#3ee6ff');
  /** Co-op: a small name tag (with hearts) above every ship. */
  function drawTags() {
    const k = view.k;
    const fs = Math.round(clamp(8 * k, 7, 10));
    const hs = fs * 1.15;
    const gap = fs * 0.6;
    for (const p of players) {
      if (!p.alive || p.intro > 0.6) continue;
      ctx.font = `${fs}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = (p === me ? 'YOU' : (p.name || 'P' + p.pid)).toUpperCase();
      const num = String(Math.max(0, p.hp));
      const nw = ctx.measureText(name).width;
      const hw = ctx.measureText(num).width;
      const total = nw + gap + hs + 2 + hw;
      const x0 = p.x - total / 2;
      const y = p.y - p.h * 0.62 - fs * 1.3;
      world();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = 'rgba(6,8,22,.85)';
      roundRect(ctx, x0 - 5, y - fs * 0.95, total + 10, fs * 1.9, fs * 0.6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = netColor(p.pid);
      ctx.fillText(name, x0 + nw / 2, y + 1);
      blit(sprite('heart', hs, hs * (237 / 280)), x0 + nw + gap + hs / 2, y, hs, hs * (237 / 280));
      world();
      ctx.font = `${fs}px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(num, x0 + nw + gap + hs + 2 + hw / 2, y + 1);
    }
    ctx.globalAlpha = 1;
  }
  function updateHeartFx(dt) {
    for (const f of heartFx) {
      f.t += dt;
      const p = players.find((q) => q.pid === f.pid);
      if (p && p.alive) { f.x = p.x; f.y = p.y - p.h * 0.62; }
    }
    for (let i = heartFx.length - 1; i >= 0; i--) if (heartFx[i].t > 1.3) heartFx.splice(i, 1);
  }
  function drawHeartFx() {
    const k = view.k;
    const S = 30 * k;
    const H = S * (237 / 280);
    for (const f of heartFx) {
      const t = f.t;
      const x = f.x;
      const y = f.y - 34 * k - t * 26 * k;
      const img = sprite('heart', S, H);
      if (f.d < 0) {
        // pops in, cracks down the middle and the two halves tumble away
        const pop = t < 0.18 ? easeOutBack(t / 0.18) : 1;
        if (t < 0.32) {
          ctx.globalAlpha = 1;
          blit(img, x, y, S, H, Math.sin(t * 60) * 0.12 * (t / 0.32), pop * 1.15, pop * 1.15);
        } else {
          const u = (t - 0.32) / 0.98;
          ctx.globalAlpha = Math.max(0, 1 - u);
          for (const side of [-1, 1]) {
            at(x + side * (4 + u * 34) * k, y + u * u * 60 * k, 1, 1, side * u * 1.4);
            const sw = img.width / 2;
            ctx.drawImage(img, side < 0 ? 0 : sw, 0, sw, img.height, side < 0 ? -S / 2 : 0, -H / 2, S / 2, H);
          }
        }
        ctx.globalAlpha = Math.max(0, 1 - t / 1.3);
        popupText(`${f.d}`, x + S * 0.9, y - H * 0.2, '#ff4d5e', Math.round(clamp(11 * k, 9, 13)));
      } else {
        // gained: a heart swells up with a green glow
        const pop = t < 0.25 ? easeOutBack(t / 0.25) : 1;
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.7) / 0.6);
        ctx.globalCompositeOperation = 'lighter';
        glow(C.green, x, y, S * 1.1, 0.5 * ctx.globalAlpha);
        ctx.globalCompositeOperation = 'source-over';
        blit(img, x, y, S, H, 0, pop, pop);
        popupText(`+${f.d}`, x + S * 0.9, y - H * 0.2, '#56f08b', Math.round(clamp(11 * k, 9, 13)));
      }
    }
    ctx.globalAlpha = 1;
  }
  function popupText(text, x, y, color, size) {
    world();
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.4);
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
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
      case 'pillager':
        e.ty = rand(0.1, 0.38) * view.h;
        e.bx = x;
        e.amp = rand(70, 130) * k * (Math.random() < 0.5 ? -1 : 1);
        e.fire = rand(1.4, 2.2);
        e.stay = rand(9, 12);
        e.shots = 0;
        e.lx = x;
        e.ly = view.h;
        break;
      case 'witch':
        e.ty = rand(0.08, 0.26) * view.h;
        e.bx = x;
        e.fire = rand(1.4, 2.2);
        e.life = rand(17, 22);
        e.healed = false;
        e.drink = 0;
        e.throwT = 0;
        break;
      case 'breeze':
        e.mode = 1;
        e.hop = 0;
        e.hx0 = x;
        e.hy0 = y;
        e.hx1 = clamp(x + rand(-120, 120) * k, e.w, view.w - e.w);
        e.hy1 = rand(0.12, 0.4) * view.h;
        e.life = rand(15, 19);
        e.rodA = rand(TAU);
        e.shotDone = true;
        break;
      case 'brute':
      case 'vindicator':
        e.vy = rand(60, 80) * vs * wave.spdMul;
        e.t2 = rand(1.4, 2.2);
        e.life = rand(20, 26);
        e.lx = x;
        e.ly = y;
        e.cvx = 0;
        e.cvy = 0;
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
      case 'hclone':
        e.bx = x;
        e.ty = y;
        e.fire = rand(1.2, 2);
        e.life = 14;
        break;
      case 'sighting':
        e.life = 2.6;
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
    // Village Raid: every mob is a raider heading for the village (and doesn't hang around as long)
    if (run.game === 'raid') {
      e.raider = true;
      if (e.stay) e.stay *= 0.75;
      if (e.life) e.life *= 0.75;
    }
    if (DEBUT.has(type) && !seen.has(type)) {
      seen.add(type);
      U.toast(`NEW MOB · ${T.name}`);
    }
    enemies.push(e);
    return e;
  }
  const countType = (t) => { let n = 0; for (const e of enemies) if (!e.dead && e.type === t) n++; return n; };

  function eShoot(x, y, vx, vy, kind, c) {
    const d = EB[kind];
    const spin = kind === 'tnt' || kind === 'ghastball' || kind === 'rock' || kind === 'block' || kind === 'potion';
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
  /** Aim where the player is heading, not where they are (capped so it can still be dodged). */
  function leadAim(x, y, speed) {
    const p = player;
    const dx = p.x - x;
    const dy = p.y - y;
    const t = Math.hypot(dx, dy) / Math.max(1, speed);
    const lim = 900 * view.k;
    return Math.atan2(dy + clamp(p.vy, -lim, lim) * 0.75 * t, dx + clamp(p.vx, -lim, lim) * 0.75 * t);
  }
  /** n bullets in a fan aimed at the player (or at where they are heading when `lead` is set). */
  let harassing = false;
  function fan(x, y, n, spread, speed, kind, c, lead) {
    // boss pot-shots: one bullet fewer below Hard (leaves a gap where you stand), and they only lead
    // their aim on Hard or in a boss's final phase
    if (harassing && diffKey !== 'hard') n = Math.max(1, n - 1);
    if (lead && boss && diffKey !== 'hard' && (diffKey === 'easy' || boss.phase < 3)) lead = false;
    const base = lead ? leadAim(x, y, speed) : aimAt(x, y);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      eShoot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, kind, c);
    }
  }

  function enderTeleport(e, away) {
    const k = view.k;
    burst(e.x, e.y, C.purple, hiQ ? 14 : 6);
    P(e.x, e.y, 0, 0, 0.35, 60 * k, C.purple, RING);
    sfx('teleport');
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
      sfx('explode', 1.2);
      return;
    }
    explode(b.x, b.y, PAL.fire, b.big ? 2 : 1.2, C.orange);
    const n = b.big ? 18 : 10;
    const sp = bulletSpeed(230);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.1, 0.1);
      eShoot(b.x, b.y, Math.cos(a) * sp, Math.sin(a) * sp, 'shard');
    }
    sfx('explode', 1.3);
  }
  /** Witch: lob a splash potion at (tx, ty). A ring marks where it will land until it shatters. */
  function throwPotion(e, tx, ty, kind) {
    const k = view.k;
    const pot = POTIONS[kind];
    tx = clamp(tx, 30 * k, view.w - 30 * k);
    ty = clamp(ty, view.h * 0.2, view.h - 30 * k);
    const sx = e.x;
    const sy = e.y + e.h * 0.1;
    const T = clamp(Math.hypot(tx - sx, ty - sy) / (560 * view.vs * diff.bspd), 0.75, 1.3);
    const g = 900 * view.vs;
    const b = eShoot(sx, sy, (tx - sx) / T, (ty - sy) / T - 0.5 * g * T, 'potion', pot.c);
    b.g = g;
    b.life = T;
    addHazard(kind, tx, ty, (kind === 'harm' ? 62 : 74) * k * (e.elite ? 1.2 : 1), pot.life, T);
  }
  /** Breeze: pick the next perch, away from where it is and never right next to the player. */
  function breezeHop(e) {
    const k = view.k;
    let tx = e.x;
    let ty = e.y;
    for (let i = 0; i < 8; i++) {
      tx = rand(e.w, view.w - e.w);
      ty = rand(0.1, 0.45) * view.h;
      if (Math.abs(tx - e.x) > 120 * k && (!player || dist2(tx, ty, player.x, player.y) > 200 * k * 200 * k)) break;
    }
    e.mode = 1;
    e.hop = 0;
    e.hx0 = e.x;
    e.hy0 = e.y;
    e.hx1 = tx;
    e.hy1 = ty;
    P(e.x, e.y + e.h * 0.4, 0, 0, 0.35, 50 * k, C.cyan, RING);
  }
  /** A wind charge hit: a gust that shoves the ship the way the charge was flying. */
  function windHit(b, p) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const keep = player;
    player = p;
    knockPlayer(p.x - (b.vx / sp) * 10, p.y - (b.vy / sp) * 10, 820 * view.k);
    player = keep;
    burst(b.x, b.y, C.white, hiQ ? 10 : 5, 320);
    P(b.x, b.y, 0, 0, 0.35, 70 * view.k, C.cyan, RING);
    sfx('wind');
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
          sfx('eshoot');
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
      // creepers are terrified of cats: they flee from any ship that has one
      const cat = e.y > 0 ? catNear(e.x, e.y, 290 * k) : null;
      if (cat) {
        const fx = e.x - cat.x;
        const fy = e.y - cat.y;
        const fd = Math.hypot(fx, fy) || 1;
        e.vx += (fx / fd) * 480 * k * dt;
        e.vy += (fy / fd) * 480 * k * dt;
        const sp = Math.hypot(e.vx, e.vy);
        const max = 230 * k;
        if (sp > max) { e.vx *= max / sp; e.vy *= max / sp; }
      } else if (p.alive && d < 300 * k && e.y > 0) {
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
      if (p.alive && d < 105 * k && !cat) {
        if (e.fuse === 0) sfx('fuse');
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
        // phantoms keep away from cats: they swerve aside and never dive at a ship that has one
        const cat = e.type === 'phantom' ? catNear(e.x, e.y, 240 * k) : null;
        if (cat) e.bx = clamp(e.bx + (e.x < cat.x ? -1 : 1) * 260 * k * dt, 40 * k, view.w - 40 * k);
        const brave = !(e.type === 'phantom' && hasPet(player, 'cat'));
        if (e.dive <= 0 && brave && player.alive && e.y > 0 && e.y < player.y - 60 * k) { e.mode = 1; e.t2 = 0.35; }
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
          sfx('vex');
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
        if (e.cast <= 0.9 && !e.casting) { e.casting = true; sfx('cast'); }
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
          sfx('eshoot');
        }
        e.life -= dt;
        if (e.life <= 0) e.mode = 2;
      } else {
        // retreat upward (no penalty) — raiders march on the village instead
        e.casting = false;
        if (e.raider) e.y += 120 * view.vs * dt;
        else { e.y -= 120 * view.vs * dt; if (e.y < -e.h) e.dead = true; }
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
          if (e.y > 0) sfx('slime');
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
            sfx('blaze');
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
        if (e.t2 <= 0 && p.alive) { e.mode = 1; e.t2 = 0.55; e.lx = p.x; e.ly = p.y; sfx('stare'); }
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
          sfx('shulker');
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
          sfx('ghast');
        }
        e.life -= dt;
        if (e.life <= 0) e.mode = 2;
      } else {
        e.charge = 0;
        e.y -= 110 * view.vs * dt;
        if (e.y < -e.h) e.dead = true;
      }
    },

    pillager(e, dt) {
      const k = view.k;
      if (e.mode === 0) {
        e.y = damp(e.y, e.ty, 2.4, dt);
        if (Math.abs(e.y - e.ty) < 3 * k) { e.mode = 1; e.t2 = 0; }
      } else if (e.mode === 1) {
        e.t2 += dt;
        e.x = clamp(e.bx + Math.sin(e.t2 * 1.1) * e.amp, e.w, view.w - e.w);
        e.y = e.ty + Math.sin(e.t2 * 1.9) * 6 * k;
        e.fire -= dt * wave.fireMul * e.fr;
        // loading the crossbow: a laser sight follows you, then locks just before the bolt flies
        if (e.fire < 0.8 && player.alive) {
          e.charge = clamp(1 - e.fire / 0.8, 0, 1);
          if (e.fire > 0.28) { e.lx = player.x; e.ly = player.y; }
        } else {
          e.charge = 0;
        }
        if (e.fire <= 0 && player.alive) {
          // every third shot is a Multishot volley (elites always fire three)
          const multi = e.elite || e.shots % 3 === 2;
          const sp = bulletSpeed(520);
          const a = Math.atan2(e.ly - e.y, e.lx - e.x);
          for (const s of multi ? [-0.17, 0, 0.17] : [0]) eShoot(e.x, e.y + e.h * 0.2, Math.cos(a + s) * sp, Math.sin(a + s) * sp, 'bolt');
          e.shots += 1;
          e.fire = rand(1.9, 2.6);
          e.charge = 0;
          sfx('crossbow');
        }
        if (e.t2 > e.stay) { e.mode = 2; e.vy = 0; e.charge = 0; }
      } else {
        e.vy = Math.min(e.vy + 300 * view.vs * dt, 270 * view.vs);
        e.y += e.vy * dt;
      }
    },

    witch(e, dt) {
      const k = view.k;
      e.throwT = Math.max(0, e.throwT - dt);
      if (e.mode === 0) {
        e.y = damp(e.y, e.ty, 2, dt);
        if (Math.abs(e.y - e.ty) < 3 * k) { e.mode = 1; e.t2 = 0; }
      } else if (e.mode === 1) {
        e.t2 += dt;
        e.x = clamp(e.bx + Math.sin(e.t2 * 0.7) * 100 * k, e.w, view.w - e.w);
        e.y = e.ty + Math.sin(e.t2 * 1.7) * 8 * k;
        // a hurt witch stops to drink a potion of healing (once)
        if (!e.healed && e.hp < e.maxHp * 0.5) { e.healed = true; e.drink = 1.1; sfx('drink'); }
        if (e.drink > 0) {
          e.drink -= dt;
          if (hiQ && Math.random() < dt * 20) P(e.x + rand(-0.4, 0.4) * e.w, e.y + rand(-0.3, 0.3) * e.h, 0, -50 * k, 0.6, 7 * k, C.red, GLOW, 1);
          if (e.drink <= 0) {
            e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.4);
            P(e.x, e.y, 0, 0, 0.5, 80 * k, C.pink, RING);
            popup(e.x, e.y - e.h * 0.6, 'HEALED!', '#ff7ac0', 9, 0.8);
          }
          return;
        }
        e.fire -= dt * wave.fireMul * e.fr;
        if (e.fire <= 0 && player.alive) {
          const kind = weighted([['harm', 5], ['poison', e.elite || wave.n >= 12 ? 4 : 3], ['slow', 3]]);
          throwPotion(e, player.x, player.y, kind);
          if (e.elite) throwPotion(e, player.x + rand(-140, 140) * k, player.y + rand(-90, 40) * k, pick(['harm', 'poison', 'slow']));
          e.throwT = 0.4;
          e.fire = rand(2.4, 3.2);
          sfx('eshoot');
        }
        e.life -= dt;
        if (e.life <= 0) e.mode = 2;
      } else if (e.raider) {
        e.y += 110 * view.vs * dt;
      } else {
        e.y -= 110 * view.vs * dt;
        if (e.y < -e.h) e.dead = true;
      }
    },

    breeze(e, dt) {
      const k = view.k;
      e.rodA += dt * (e.mode === 1 ? 14 : 4);
      e.life -= dt;
      if (e.mode === 1) {
        // a quick spinning hop to the next perch
        e.hop = Math.min(1, e.hop + dt / 0.42);
        const u = easeInOut(e.hop);
        e.x = lerp(e.hx0, e.hx1, u);
        e.y = lerp(e.hy0, e.hy1, u) - Math.sin(u * Math.PI) * 50 * k;
        e.rot = Math.sin(u * Math.PI) * 0.5 * (e.hx1 > e.hx0 ? 1 : -1);
        if (hiQ && Math.random() < dt * 30) P(e.x, e.y + e.h * 0.4, rand(-40, 40) * k, rand(20, 80) * k, 0.4, 8 * k, C.white, GLOW, 2);
        if (e.hop >= 1) { e.mode = 2; e.t2 = rand(1, 1.5) / Math.min(1.5, wave.fireMul); e.rot = 0; e.shotDone = false; }
      } else if (e.mode === 2) {
        // perched: winds up a wind charge, fires, then hops away
        e.t2 -= dt;
        e.y += Math.sin(e.t * 5) * 6 * k * dt;
        e.charge = e.shotDone ? 0 : clamp(1 - (e.t2 - 0.4) / 0.5, 0, 1);
        if (!e.shotDone && e.t2 <= 0.4) {
          e.shotDone = true;
          e.charge = 0;
          if (player.alive && e.y > 0) {
            const sp = bulletSpeed(310);
            const n = e.elite || wave.n >= 16 ? 2 : 1;
            const a = aimAt(e.x, e.y);
            for (let i = 0; i < n; i++) {
              const s = n > 1 ? (i - 0.5) * 0.3 : 0;
              eShoot(e.x, e.y + e.h * 0.2, Math.cos(a + s) * sp, Math.sin(a + s) * sp, 'wind');
            }
            sfx('wind');
          }
        }
        if (e.t2 <= 0) {
          if (e.life <= 0) e.mode = 3;
          else breezeHop(e);
        }
      } else {
        e.y -= 260 * view.vs * dt;
        e.rot += dt * 6;
        if (e.y < -e.h) e.dead = true;
      }
    },

    brute(e, dt) {
      const k = view.k;
      const p = player;
      e.life -= dt;
      if (e.mode === 0) {
        // lumber toward you, staying in the upper part of the screen
        if (p.alive) e.x = damp(e.x, p.x, 0.9, dt);
        e.y = Math.min(e.y + e.vy * dt * (e.y < view.h * 0.15 ? 1.6 : 0.35), view.h * 0.55);
        e.rot = Math.sin(e.t * 4) * 0.06;
        e.t2 -= dt;
        if (e.t2 <= 0 && p.alive && e.y > 20 * k) { e.mode = 1; e.t2 = 0.75; e.lx = p.x; e.ly = p.y; sfx('grunt'); }
        if (e.life <= 0) e.mode = 4;
      } else if (e.mode === 1) {
        // wind-up: axe raised, stomping — the dashed line shows where it will charge
        e.t2 -= dt;
        e.charge = clamp(1 - e.t2 / 0.75, 0, 1);
        e.x += rand(-1, 1) * 2 * k;
        if (e.t2 > 0.3 && p.alive) { e.lx = damp(e.lx, p.x, 6, dt); e.ly = damp(e.ly, p.y, 6, dt); }
        if (e.t2 <= 0) {
          const a = Math.atan2(e.ly - e.y, e.lx - e.x);
          const sp = 650 * view.vs * Math.min(1.3, wave.spdMul);
          e.cvx = Math.cos(a) * sp;
          e.cvy = Math.sin(a) * sp;
          e.mode = 2;
          e.t2 = Math.min(0.8, Math.hypot(e.lx - e.x, e.ly - e.y) / sp + 0.2);
          e.charge = 0;
          shake(0.15);
        }
      } else if (e.mode === 2) {
        // CHARGE!
        e.x += e.cvx * dt;
        e.y += e.cvy * dt;
        e.t2 -= dt;
        if (hiQ) P(e.x, e.y + e.h * 0.3, rand(-30, 30) * k, rand(-30, 30) * k, 0.3, 10 * k, C.gold, GLOW, 2);
        if (e.t2 <= 0 || e.y > view.h - 40 * k) { e.mode = 3; e.t2 = 0.7; }
      } else if (e.mode === 3) {
        // winded: skids to a stop, then backs off up the screen
        e.cvx = damp(e.cvx, 0, 5, dt);
        e.cvy = damp(e.cvy, 0, 5, dt);
        e.x += e.cvx * dt;
        e.y = damp(e.y + e.cvy * dt, Math.min(e.y, view.h * 0.45), 1.2, dt);
        e.t2 -= dt;
        if (e.t2 <= 0) { e.mode = e.life <= 0 ? 4 : 0; e.t2 = rand(1.4, 2.2); }
      } else if (e.raider) {
        e.y += 170 * view.vs * dt;
      } else {
        e.y -= 140 * view.vs * dt;
        if (e.y < -e.h) e.dead = true;
      }
      e.x = clamp(e.x, e.w * 0.5, view.w - e.w * 0.5);
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
        sfx('shriek');
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
          sfx('eshoot');
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
      // crystals fight back with aimed orbs
      e.fire = (e.fire || rand(1.5, 3)) - dt * diff.tempo;
      if (e.fire <= 0 && player.alive) {
        fan(e.x, e.y, 2, 0.12, bulletSpeed(250), 'magic', C.pink);
        e.fire = rand(2.6, 3.4);
      }
      // End Crystals slowly heal the Ender Dragon while they live
      if (boss && boss.kind === 'dragon' && boss.mode === 'fight') {
        const cap = boss.phase === 1 ? 1 : boss.def.phases[boss.phase - 2];
        if (boss.hp < boss.maxHp * cap) boss.hp = Math.min(boss.maxHp * cap, boss.hp + boss.maxHp * 0.006 * dt);
      }
    },
    illusion(e, dt) {
      e.x = damp(e.x, e.bx, 3, dt);
      e.y = damp(e.y, e.ty + Math.sin(e.t * 1.4 + e.ph) * 12 * view.k, 3, dt);
    },
    // Herobrine's shadow copies: drift into place, shoot soul shots, fade after a while
    hclone(e, dt) {
      e.x = damp(e.x, e.bx + Math.sin(e.t * 0.9 + e.ph) * 40 * view.k, 2.5, dt);
      e.y = damp(e.y, e.ty + Math.sin(e.t * 1.3 + e.ph) * 10 * view.k, 2.5, dt);
      e.fire -= dt * diff.tempo;
      e.charge = e.fire < 0.5 ? clamp(1 - e.fire / 0.5, 0, 1) : 0;
      if (e.fire <= 0 && player.alive) {
        fan(e.x, e.y, 2, 0.2, bulletSpeed(230), 'hshot');
        e.fire = rand(2.2, 2.8);
      }
      e.life -= dt;
      if (e.life <= 0) { burst(e.x, e.y, C.white, 10, 200); e.dead = true; }
    },
    // the secret sighting: just watches, then is gone
    sighting(e, dt) {
      e.x = e.bx + Math.sin(e.t * 2) * 3 * view.k;
      e.y = e.ty;
      e.life -= dt;
      if (e.life <= 0) e.dead = true;
    },
  };
  BEHAVIOR.wskel = BEHAVIOR.skeleton;
  BEHAVIOR.phantom = BEHAVIOR.vex;
  BEHAVIOR.magmacube = BEHAVIOR.slime;
  BEHAVIOR.vindicator = BEHAVIOR.brute;

  // ================================================================ bosses (engine side)
  // Boss definitions are in bosses.js. Every fight is a higher boss level:
  // more HP, faster attacks; each lap through all ten unlocks new moves (MK II, MK III...).
  const bossTypes = {};
  // how fast a boss acts: phase, level, difficulty, and berserk / last-stand rage all speed it up
  const bossPace = (e) => (e.phase === 3 ? 1.2 : e.phase === 2 ? 1.08 : 1) * (1 + Math.min(12, e.level - 1) * 0.035) * diff.tempo * (e.berserk ? 1.3 : 1) * (e.desperate ? 1.15 : 1);
  const bossF = (e) => (1 + Math.min(12, e.level - 1) * 0.028) * (e.berserk ? 1.1 : 1);
  /**
   * Extra bullets/waves for attacks: grows with phase, lap (MK) and Hard mode.
   * Phases add at most +1 (+2 on Hard), and Hard's bonus only starts from the second boss.
   */
  const bossTier = (e) => Math.max(0, Math.min(e.phase - 1, diffKey === 'hard' ? 2 : 1) + (e.mark - 1)
    + (e.level >= 2 ? diff.tier : Math.min(0, diff.tier)) + (e.desperate ? 1 : 0));
  /**
   * Boss health: sized to how much damage you can deal, so a fight lasts about
   * 45s for the first boss and grows to ~110s later — upgrades still help because
   * it blends your real firepower with the firepower expected at that stage.
   */
  const bossSeconds = (level, mark) => Math.min(56, 30 + (level - 1) * 3.5) * (1 + (mark - 1) * 0.12);
  function bossMaxHp(def, level, mark) {
    // in co-op the whole team's firepower counts (a little less than one full boss per player)
    const team = players.filter((p) => !p.left);
    const n = Math.max(1, team.length);
    const actual = team.reduce((s, p) => s + WEAPON_DPS[p.weapon] * p.power, 0) || WEAPON_DPS[1];
    const expected = (level === 1 ? WEAPON_DPS[3] : WEAPON_DPS[5]) * (1 + 0.12 * (level - 1)) * n;
    const seconds = bossSeconds(level, mark);
    const coop = n > 1 ? 0.85 : 1;
    const hp = ((actual + expected) / 2) * 0.8 * seconds * (def.hpw || 1) * diff.bhp * coop;
    return Math.round(Math.max(hp, def.hp * (1 + (level - 1) * 0.35) * diff.bhp * (1 + (n - 1) * 0.6)));
  }
  const order = () => (bossOrder.length ? bossOrder : BK.ORDER);
  /** The boss order of a game: raids are led by the illagers' own bosses first, then everyone else. */
  const gameOrder = (game) => (game === 'raid' ? ['ravager', 'illusioner', ...BK.ORDER.filter((kd) => kd !== 'ravager' && kd !== 'illusioner')] : BK.ORDER.slice());
  const nextBossDef = () => BK.ALL[order()[bossLevel % order().length]];

  /** forced: a boss outside the usual order (the secret one) — it doesn't move the order along. */
  function spawnBoss(forced) {
    if (!forced) bossLevel += 1;
    const kind = forced || order()[(bossLevel - 1) % order().length];
    const def = BK.ALL[kind];
    const level = forced ? bossLevel + 1 : bossLevel;
    const mark = forced ? 1 + Math.floor(bossLevel / order().length) : Math.ceil(bossLevel / order().length);
    const k = view.k;
    const big = 1 + Math.min(0.24, (mark - 1) * 0.08);
    const w = def.w * k * big;
    const h = def.h * k * big;
    const ty = Math.max(view.h * 0.12, view.w <= 640 ? 150 : 70) + h * 0.5;
    if (!bossTypes[kind]) bossTypes[kind] = { img: def.img, w: def.w, h: def.h, hp: def.hp, score: def.score, pal: def.pal, glow: def.glow, boss: true, name: def.name };
    const hp = bossMaxHp(def, level, mark);
    const e = {
      type: kind, kind, def, T: bossTypes[kind], x: view.w / 2, y: def.entry === 'drop' ? -h : ty, w, h, r: h * 0.45,
      hp, maxHp: hp, score: def.score, t: 0, spawn: 1, flash: 0, rot: 0, scale: 1, grow: def.entry === 'grow' ? 0 : 1, ph: 0,
      vx: 0, vy: 0, mode: 'enter', enterT: 0, inv: true, invT: 0, ty, phase: 1, atk: 2, mt: 0, mouth: 0, last: '',
      beams: [], queue: [], spiral: null, armor: false, dieT: 0, boomT: 0, level, mark, fr: 1, elite: false, novaId: 0, dead: false,
      shield: 0, shieldMax: 0, stun: 0, fightT: 0, berserk: false, lastStand: false, desperate: false, harassT: 2,
    };
    e.title = def.name + (mark > 1 ? ` MK ${ROMAN[mark - 1] || mark}` : '');
    if (def.init) def.init(e);
    enemies.push(e);
    boss = e;
    U.bossBar(true, `${e.title} · LV ${level}`, def.phases);
    U.letterbox(true);
    sfx(bossLevel % 2 ? 'roar' : 'wither');
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
        sfx(bossLevel % 2 ? 'roar' : 'wither');
        shake(0.8);
        P(e.x, e.y, 0, 0, 0.8, 320 * k, MARK_GLOW[e.mark] || def.glow, RING);
        if (def.onFight) def.onFight(e);
        U.letterbox(false);
        U.banner(e.title, def.intro[e.mark - 1] || `MK ${ROMAN[e.mark - 1] || e.mark} · ALL MOVES EMPOWERED`, 'bosscard', 3000);
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
        sfx('explode', 1);
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
    const k = view.k;
    const hpR = e.hp / e.maxHp;
    const ph = hpR > def.phases[0] ? 1 : hpR > def.phases[1] ? 2 : 3;
    if (ph > e.phase) bossPhase(e, ph);
    if (e.invT > 0) { e.invT -= dt; if (e.invT <= 0) e.inv = false; }
    if (e.mouth > 0) e.mouth -= dt;

    // Last Stand: at 10% health every boss unleashes its ultimate
    if (!e.lastStand && hpR <= 0.1) {
      e.lastStand = true;
      e.desperate = true;
      clearBossMoves(e);
      e.inv = true;
      e.invT = 2.2;
      e.stun = 0;
      sfx(bossLevel % 2 ? 'roar' : 'wither');
      shake(1);
      slowmo(0.5, 0.4);
      U.flash('hurt');
      P(e.x, e.y, 0, 0, 1, 460 * k, C.red, RING);
      if (def.ultimate) def.ultimate(e);
    }
    // Berserk: drag a fight out and the boss gets faster and angrier
    e.fightT += dt;
    const berserkAt = bossSeconds(e.level, e.mark) * 2.2 * diff.bhp * (diffKey === 'hard' ? 0.9 : 1);
    if (!e.berserk && e.fightT > berserkAt) {
      e.berserk = true;
      U.banner('BERSERK!', 'IT GROWS FASTER — FINISH IT!', 'warning', 1800);
      sfx(bossLevel % 2 ? 'roar' : 'wither');
      shake(0.8);
    }

    // Stunned after its shield breaks: no attacks, and it takes extra damage
    if (e.stun > 0) {
      e.stun -= dt;
      e.x += Math.sin(e.t * 50) * 1.2 * k;
      e.y = damp(e.y, e.ty, 3, dt);
      updateBeams(e, dt);
      if (e.stun <= 0) { e.atk = 0.4; e.harassT = 0.8; }
      return;
    }

    const pace = bossPace(e);
    e.mt += dt * pace;
    def.tick(e, dt);
    if (e.queue.length) {
      e.queue[0].t -= dt;
      while (e.queue.length && e.queue[0].t <= 0) e.queue.shift().fn(e);
    }
    updateBeams(e, dt);
    updateSpiral(e, dt);

    // harassment fire between (and during) attacks — there is never a safe moment
    if (def.harass && player && player.alive && !e.spiral && !e.beams.length) {
      e.harassT -= dt * pace;
      if (e.harassT <= 0) {
        harassing = true;
        def.harass(e);
        harassing = false;
        e.harassT = (def.harassRate || 1.2) * diff.harass;
      }
    }

    if (!e.queue.length && !e.beams.length && !e.spiral && !def.busy(e) && !e.inv) {
      e.atk -= dt * pace;
      if (e.atk <= 0) {
        const list = def.moves(e);
        let a = pick(list);
        if (a === e.last) a = pick(list);
        e.last = a;
        def.attack(e, a);
        // combos: in later phases an attack flows straight into the next one
        const combo = (e.phase - 1) * 0.14 + (e.mark - 1) * 0.08 + (diffKey === 'hard' ? 0.1 : 0) + (e.desperate ? 0.15 : 0);
        if (Math.random() < combo) e.atk = Math.min(e.atk, 0.15);
      }
    }
  }
  /** Cancel whatever the boss is doing (phase change, shield break, last stand). */
  function clearBossMoves(e) {
    e.beams.length = 0;
    e.queue.length = 0;
    e.spiral = null;
    for (const key of ['charge', 'dash', 'swoop', 'rush', 'hop']) if (e[key]) e[key] = null;
    if (e.lasers) e.lasers.length = 0;
  }
  function bossPhase(e, ph) {
    const def = e.def;
    e.phase = ph;
    e.inv = true;
    e.invT = 1;
    clearBossMoves(e);
    // every new phase comes with a fresh shield that has to be broken first
    e.shield = e.shieldMax = Math.round(e.maxHp * diff.shield * (1 + (e.mark - 1) * 0.2));
    sfx(bossLevel % 2 ? 'roar' : 'wither');
    shake(0.7);
    const txt = def.phaseText && def.phaseText[ph];
    if (txt) U.banner(txt[0], `${txt[1]}  ·  BREAK ITS SHIELD!`, 'phase', 1900);
    P(e.x, e.y, 0, 0, 0.9, 380 * view.k, ph === 3 ? C.red : MARK_GLOW[e.mark] || def.glow, RING);
    if (def.onPhase) def.onPhase(e, ph);
  }
  function breakShield(e) {
    const k = view.k;
    e.shield = 0;
    clearBossMoves(e);
    e.stun = diffKey === 'hard' ? 2.1 : 2.7;
    popup(e.x, e.y - e.h * 0.4, 'SHIELD BROKEN!', '#8fd8ff', 14, 1.6);
    // reward: a heart if anyone is hurt, otherwise a random power-up
    spawnPickup(players.some((p) => p.alive && p.hp < p.maxHp) ? 'heart' : pick(POWER_POOL), e.x, e.y + e.h * 0.3);
    burst(e.x, e.y, C.cyan, hiQ ? 30 : 12, 420);
    P(e.x, e.y, 0, 0, 0.7, Math.max(e.w, e.h) * 0.9, C.cyan, RING);
    P(e.x, e.y, 0, 0, 0.5, Math.max(e.w, e.h) * 0.7, C.white, GLOW);
    sfx('explode', 1.6);
    sfx('levelup');
    shake(0.6);
    slowmo(0.35, 0.4);
    Input.vibrate([40, 30, 60]);
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
      if (b.track && b.t < b.warn * 0.7 && p && p.alive) b.x = damp(b.x, p.x, 2.5, dt);
      if (b.t >= b.warn && b.t < b.warn + b.fire) {
        if (!b.fired) { b.fired = true; sfx('beam'); shake(0.5); Input.vibrate(40); }
        if (b.sweep) b.x += b.vx * dt;
        const top = b.sky ? 0 : e.y;
        for (const q of players) {
          if (q.alive && Math.abs(q.x - b.x) < b.w * 0.45 + hitR(q) && q.y > top) hurtPlayer(heavyDmg(), q);
        }
        if (hiQ || Math.random() < 0.5) P(b.x + rand(-b.w / 2, b.w / 2), view.h, rand(-100, 100) * k, -rand(100, 420) * k, 0.4, rand(2, 3.5) * k, (BEAM_PAL[b.pal] || BEAM_PAL.teal).b, SPARK, 2);
      } else if (b.t >= b.warn + b.fire) {
        b.done = true;
      }
    }
    for (let i = e.beams.length - 1; i >= 0; i--) if (e.beams[i].done) e.beams.splice(i, 1);
  }
  const BEAM_PAL = {
    teal: { edge: '25,210,190', core: '160,255,250', a: C.cyan, b: C.teal },
    fire: { edge: '255,120,30', core: '255,235,160', a: C.gold, b: C.orange },
    void: { edge: '150,70,255', core: '235,205,255', a: C.purple, b: C.pink },
    soul: { edge: '170,210,255', core: '255,255,255', a: C.white, b: C.cyan },
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
    sfx(bossLevel % 2 ? 'roar' : 'wither');
    shake(0.8);
    U.bossBar(false);
  }
  function bossFinale(e) {
    const k = view.k;
    e.dead = true;
    boss = null;
    explode(e.x, e.y, e.T.pal, 4, e.def.glow);
    P(e.x, e.y, 0, 0, 1.1, 420 * k, MARK_GLOW[e.mark] || e.def.glow, RING);
    P(e.x, e.y, 0, 0, 0.8, 300 * k, C.white, RING);
    P(e.x, e.y, 0, 0, 0.6, 320 * k, C.white, GLOW);
    sfx('bigExplode');
    shake(1);
    U.flash('white');
    Input.vibrate([80, 40, 160]);
    stats.bosses += 1;
    stats.kills += 1;
    Trophies.boss(e.kind);
    if (!wave.hurt) Trophies.unlock('flawless');
    const pts = addScore(e.score * e.level);
    popup(e.x, e.y, '+' + fmt(pts), '#ffe066', 18, 2);
    // every boss you beat makes your guns hit harder, keeping pace with tougher mobs (the whole team in co-op)
    for (const p of players) {
      p.power = Math.round((p.power + 0.12) * 100) / 100;
      if (p.alive) popup(p.x, p.y - p.h * 1.4, `POWER ${Math.round(p.power * 100)}%`, '#ffe066', 12, 1.8);
    }
    nova = 100;
    checkNovaReady();
    if (players.some((p) => p.alive && p.weapon < 5)) { spawnPickup('star', e.x, e.y); starOut = true; }
    spawnPickup('heart', e.x - 40 * k, e.y);
    if (players.some((p) => p.alive && !p.totem) && !totemOut) { spawnPickup('totem', e.x + 40 * k, e.y); totemOut = true; }
    else spawnPickup(pick(POWER_POOL), e.x + 40 * k, e.y);
    for (let i = 0; i < 8; i++) spawnPickup('gem', e.x + rand(-60, 60) * k, e.y + rand(-30, 30) * k, rand(-160, 160) * k, rand(-260, -80) * view.vs);
    if (run.mode === 'hardcore') Trophies.unlock(run.tier);
    if (run.game === 'bossrush' && !e.def.secret) {
      // the faster the fight, the bigger the bonus
      const fast = Math.max(0, bossSeconds(e.level, e.mark) * 1.6 - e.fightT);
      if (fast > 0) { const v = addScore(Math.round(fast * 40 * e.level)); popup(e.x, e.y + 40 * k, `SPEED BONUS +${fmt(v)}`, '#7ff0ff', 13, 2); }
      if (bossLevel % order().length === 0) { rushSecret = true; Trophies.unlock('bossrush'); }
    }
    if (run.game === 'raid' && !e.def.secret) { villageRepair(); Trophies.unlock('hero'); }
    saveCheckpoint(wave.n + 1, true);
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
    if (nova >= 100 && !novaReadyShown && me && me.alive) {
      novaReadyShown = true;
      if (!net) popup(me.x, me.y - me.h * 1.1, 'NOVA READY', '#ff6ad5', 11, 1.3);
      else fwd('s', 'ready', null); // co-op: the team meter is full, everyone hears it
      Sfx.play('ready');
    }
  }
  // kills made by any special attack (and anything it sets off) never refill the special meter
  const chargesNova = (src) => novaLock === 0 && src !== 'nova' && src !== 'ult' && !ultCtx;

  function hurtEnemy(e, dmg, hx, hy, src = 'bullet') {
    if (e.dead || e.inv || e.mode === 'dying' || e.mode === 'enter') return;
    // the secret sighting only reacts to a shot aimed at it — not to explosions, missiles, pets or specials
    if (e.type === 'sighting' && src !== 'bullet') return;
    if (ultCtx && e.T.boss) {
      dmg = capUlt(e, dmg, ultCtx);
      if (dmg <= 0) return;
    }
    if (e.type === 'enderman' && src === 'bullet' && e.dodgeCd <= 0 && e.mode !== 2 && Math.random() < 0.3) {
      popup(e.x, e.y - e.h * 0.6, 'DODGE', '#d65bf2', 9, 0.7);
      e.dodgeCd = 1.4;
      enderTeleport(e, false);
      return;
    }
    let armored = false;
    if (e.type === 'shulker' && e.open < 0.5 && src !== 'nova' && src !== 'storm') { dmg *= 0.25; armored = true; }
    if (e.armor && src === 'bullet') { dmg *= 0.5; armored = true; }
    if (e.T.boss) {
      if (e.stun > 0) dmg *= 1.5;
      // a boss shield soaks every hit until it breaks
      if (e.shield > 0) {
        e.shield -= dmg;
        spark(hx, hy, C.cyan, hiQ ? 2 : 1);
        sfx('armor');
        if (e.shield <= 0) breakShield(e);
        return;
      }
    }
    e.hp -= dmg;
    if (!e.T.boss) e.flash = 0.1;
    else if (!(e.flashCd > 0)) { e.flash = 0.06; e.flashCd = 0.16; } // bosses blink briefly instead of staying white under fire
    if (!e.T.boss && e.type !== 'slime' && e.type !== 'magmacube' && !e.T.axe && e.type !== 'breeze' && !e.T.persist) e.y -= 3 * view.k;
    const n = hiQ ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.2, 1.2);
      const sp = rand(120, 380) * view.k;
      P(hx, hy, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.12, 0.25), rand(1.5, 2.6) * view.k, armored ? C.grey : pick(e.T.pal), SPARK, 4);
    }
    sfx(armored ? 'armor' : 'hit');
    if (e.T.boss && chargesNova(src)) nova = Math.min(100, nova + novaGain(0.1));
    if (e.hp <= 0) killEnemy(e, src);
  }
  function killEnemy(e, src) {
    if (e.T.boss) { startBossDeath(e); return; }
    e.dead = true;
    const k = view.k;
    if (e.type === 'sighting') { herobrineWakes(e); return; }
    if (e.type === 'illusion' || e.type === 'hclone') {
      const c = e.type === 'hclone' ? C.white : C.blue;
      burst(e.x, e.y, c, 14);
      P(e.x, e.y, 0, 0, 0.4, 90 * k, c, RING);
      popup(e.x, e.y, 'FAKE!', e.type === 'hclone' ? '#ffffff' : '#8fb0ff', 11, 0.9);
      sfx('pop');
      return;
    }
    const s = e.type === 'evoker' || e.type === 'ghast' ? 1.7 : e.T.axe || e.type === 'witch' ? 1.4 : e.type === 'vex' || e.type === 'phantom' ? 0.75 : 1.1;
    if (e.type !== 'creeper') {
      explode(e.x, e.y, e.T.pal, s * (e.elite ? 1.4 : 0.85), e.elite ? C.gold : e.T.glow);
      shatter(e);
      sfx('explode', s);
      shake(0.1 * s);
    }
    if (blastDepth > 0) blastKills += 1;
    stats.kills += 1;
    if (src === 'pet' || src === 'poison') { stats.petKills = (stats.petKills || 0) + 1; Trophies.add('petkills'); }
    if (stats.kills === 1) Trophies.unlock('first');
    if (src === 'storm') { stats.storm += 1; if (stats.storm >= 15) Trophies.unlock('storm'); }
    combo += 1;
    comboT = COMBO_TIME;
    if (combo > stats.maxCombo) stats.maxCombo = combo;
    const mult = comboMult();
    // the team shares one combo in co-op, so it's announced where the kill happened
    const at0 = net ? e : player;
    if (mult > lastMult && at0 && (net || player.alive)) {
      popup(at0.x, at0.y - (at0.h || 0) * 0.9, `x${mult} COMBO!`, MULT_COL[mult], 12, 1.1);
      sfx('combo', mult);
      if (mult >= 8) Trophies.unlock('combo');
    }
    lastMult = mult;
    const pts = addScore(e.score * mult);
    popup(e.x, e.y - e.h * 0.2, (e.elite ? 'ELITE +' : '+') + fmt(pts), e.elite ? '#ffe066' : MULT_COL[mult], mult > 3 || e.elite ? 12 : 10);
    if (chargesNova(src)) {
      nova = Math.min(100, nova + novaGain(e.type === 'evoker' || e.type === 'ghast' || e.elite ? 8 : e.T.axe || e.type === 'witch' ? 6 : 3.5));
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
    sfx('explode', 1.5);
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
      case 'tnt': blast(t.x, t.y, 100 * k, 6 * teamPower(), PAL.tnt, C.orange, byPlayer, 'BOOM!', 50); break;
      case 'ghastball':
        if (byPlayer) blast(t.x, t.y, (t.big ? 170 : 125) * k, (t.big ? 20 : 9) * teamPower(), PAL.fire, C.orange, true, 'DEFLECTED!', t.big ? 400 : 150);
        else fuseBurst(t);
        break;
      case 'bskull': blast(t.x, t.y, 70 * k, 4 * teamPower(), PAL.bskull, C.blue, byPlayer, 'SHATTERED!', 60); break;
      default:
        spark(t.x, t.y, t.c, 6);
        P(t.x, t.y, 0, 0, 0.3, 30 * k, t.kind === 'hfire' ? C.orange : C.purple, RING);
        if (byPlayer) { const v = addScore(20); popup(t.x, t.y, '+' + v, '#e8e09a', 8, 0.6); }
        sfx('pop');
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
    sfx('explode', 1.8);
    shake(0.45);
    Input.vibrate(30);
    if (!byPlayer) {
      for (const q of players) if (q.alive && dist2(e.x, e.y, q.x, q.y) < (R * 0.8) * (R * 0.8)) hurtPlayer(1, q);
    }
    // chain reaction
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const rr = R + o.r;
      if (dist2(o.x, o.y, e.x, e.y) < rr * rr) hurtEnemy(o, 6 * teamPower(), o.x, o.y, 'blast');
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
    if (run.game === 'raid' && !e.T.boss) villageHit(e);
    if (combo >= 3) popup(e.x, view.h - 40 * view.k, 'COMBO LOST', '#ff4d5e', 10, 1);
    resetCombo();
    P(e.x, view.h, 0, 0, 0.5, 60 * view.k, C.red, GLOW);
  }
  function rollDrops(e) {
    // weapon stars follow the weakest gun on the team; each extra teammate makes them come a bit sooner
    const alive = alivePlayers();
    const lowest = alive.reduce((m, p) => Math.min(m, p.weapon), 5);
    const need = WEAPON_KILLS[lowest] / (1 + (players.length - 1) * 0.3);
    if (lowest < 5 && !starOut && stats.kills >= need) {
      spawnPickup('star', e.x, e.y);
      starOut = true;
      return;
    }
    const luck = e.type === 'evoker' || e.type === 'ghast' ? 3 : e.type === 'witch' || e.T.axe ? 2.5 : 1;
    // totems are a little more common when hearts never drop (Hardcore Brutal)
    if (alive.some((p) => !p.totem) && !totemOut && Math.random() < 0.005 * luck * (rules.heartDrops ? 1 : 1.6)) {
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
    else if (r < heart && alive.some((p) => p.hp < p.maxHp)) spawnPickup('heart', e.x, e.y);
  }

  /**
   * Co-op: every mob (and boss) hunts one ship at a time — usually the closest, switching every few
   * seconds so the pressure is shared. Its AI then sees that ship as `player`.
   */
  function targetFor(e, dt) {
    let t = e.tgt;
    e.tgtT = (e.tgtT || 0) - dt;
    if (!t || !t.alive || t.left || e.tgtT <= 0) {
      const alive = alivePlayers();
      if (!alive.length) return t || me || players[0];
      if (alive.length === 1) t = alive[0];
      else {
        // weighted by closeness, with a random twist so bosses switch between players
        let best = null;
        let bs = Infinity;
        for (const p of alive) {
          const s = Math.hypot(p.x - e.x, p.y - e.y) * rand(0.6, 1.4);
          if (s < bs) { bs = s; best = p; }
        }
        t = best;
      }
      e.tgt = t;
      e.tgtT = e.T.boss ? rand(3, 6) : rand(2, 4);
    }
    return t;
  }

  function updateEnemies(dt) {
    const multi = players.length > 1;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead) continue;
      if (multi) player = targetFor(e, dt);
      e.t += dt;
      if (e.spawn < 1) e.spawn = Math.min(1, e.spawn + dt * 3.5);
      if (e.flash > 0) e.flash -= dt;
      if (e.flashCd > 0) e.flashCd -= dt;
      // bee poison: damage every half second while it lasts
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        e.poisonAcc = (e.poisonAcc || 0) + dt;
        if (hiQ && Math.random() < dt * 8) P(e.x + rand(-0.4, 0.4) * e.w, e.y + rand(-0.4, 0.4) * e.h, 0, -40 * view.k, 0.5, 6 * view.k, C.green, GLOW, 1);
        if (e.poisonAcc >= 0.5) {
          e.poisonAcc -= 0.5;
          hurtEnemy(e, e.poisonD * 0.5, e.x, e.y, 'poison');
          if (e.dead) continue;
        }
      }
      if (e.elite && hiQ && Math.random() < dt * 6) P(e.x + rand(-0.5, 0.5) * e.w, e.y + rand(-0.5, 0.5) * e.h, 0, -40 * view.k, 0.5, 6 * view.k, C.gold, GLOW, 1);
      if (e.T.boss) bossUpdate(e, dt);
      else BEHAVIOR[e.type](e, dt);
      if (e.dead) continue;
      if (e.mode !== 'dying' && e.mode !== 'enter' && e.type !== 'crystal' && e.type !== 'sighting') {
        for (const p of players) {
          if (!p.alive || p.intro > 0 || !hits(e, p.x, p.y, hitR(p) * 1.8)) continue;
          if (e.type === 'creeper') {
            creeperBlast(e, false);
            break;
          }
          // touching a boss only costs 2 hearts (Hard) while it is diving / charging / slamming at you
          // (a charging Piglin Brute's axe hits just as hard)
          const lunging = e.T.boss ? (e.charge || e.swoop || e.rush || e.hop || e.dash) : e.T.axe && e.mode === 2;
          const res = hurtPlayer(lunging ? heavyDmg() : 1, p);
          if (res && !e.T.boss) hurtEnemy(e, res === 1 ? 8 : 3, e.x, e.y, 'ram');
          if (e.dead) break;
        }
      }
      if (e.dead) continue;
      if (e.T.boss || e.dead || e.T.persist) continue;
      if (e.y - e.h / 2 > view.h + 10) { e.dead = true; escaped(e); }
      else if (e.x < -e.w * 2 || e.x > view.w + e.w * 2 || e.t > 45) e.dead = true;
    }
    player = me;
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
  /** Breeze: three wind rods whirling around it, and a little tornado underneath. */
  function drawBreeze(e, front) {
    const k = view.k;
    world();
    for (let i = 0; i < 3; i++) {
      const a = e.rodA + (i * TAU) / 3;
      const depth = Math.sin(a);
      if ((depth > 0) !== front) continue;
      const R = e.w * 0.62;
      const x = e.x + Math.cos(a) * R;
      const y = e.y + e.h * 0.25 + depth * R * 0.3;
      ctx.globalAlpha = front ? 0.9 : 0.5;
      ctx.fillStyle = front ? '#e4f8ff' : '#8fcbe8';
      ctx.fillRect(x - 3 * k, y - 9 * k, 6 * k, 18 * k);
    }
    if (!front) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#c8f0ff';
      ctx.lineWidth = 2 * k;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(e.x + Math.sin(e.t * 6 + i) * 4 * k, e.y + e.h * (0.55 + i * 0.18), e.w * (0.38 - i * 0.1), e.h * 0.07, 0, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  /** Pillager: a crossbow that turns to aim, its string pulled back while loading, plus the laser sight. */
  function drawCrossbow(e) {
    const k = view.k;
    const a = Math.atan2(e.ly - e.y, e.lx - e.x);
    if (e.charge > 0) {
      world();
      ctx.globalAlpha = 0.2 + e.charge * 0.55;
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = (1 + e.charge) * k;
      ctx.setLineDash([10 * k, 8 * k]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.h * 0.42);
      ctx.lineTo(e.lx, e.ly);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    at(e.x, e.y + e.h * 0.42, 1, 1, a);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-11 * k, -2.5 * k, 25 * k, 5 * k);
    ctx.strokeStyle = '#a07a48';
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.moveTo(8 * k, -13 * k);
    ctx.quadraticCurveTo(15 * k, 0, 8 * k, 13 * k);
    ctx.stroke();
    const pull = e.charge * 7 * k;
    ctx.strokeStyle = '#e8e2d0';
    ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.moveTo(8 * k, -13 * k);
    ctx.lineTo(8 * k - pull, 0);
    ctx.lineTo(8 * k, 13 * k);
    ctx.stroke();
  }
  /** Piglin Brute: a golden axe, raised while it winds up, swung forward in the charge. */
  function drawBruteAxe(e) {
    const k = view.k;
    if (e.mode === 1) {
      world();
      ctx.globalAlpha = 0.35 + e.charge * 0.5;
      ctx.strokeStyle = '#ffb02e';
      ctx.lineWidth = 3 * k;
      ctx.setLineDash([12 * k, 9 * k]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.lx, e.ly);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const swing = e.mode === 1 ? -1.3 * e.charge : e.mode === 2 ? 1 : Math.sin(e.t * 4) * 0.15;
    at(e.x + e.w * 0.5, e.y + e.h * 0.15, 1, 1, swing);
    ctx.globalAlpha = 1;
    const iron = e.T.axe === 'iron';
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(-2.5 * k, -24 * k, 5 * k, 36 * k);
    ctx.fillStyle = iron ? '#c9ced8' : '#f2c230';
    ctx.beginPath();
    ctx.moveTo(2 * k, -24 * k);
    ctx.lineTo(15 * k, -29 * k);
    ctx.lineTo(17 * k, -12 * k);
    ctx.lineTo(2 * k, -11 * k);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = iron ? '#ffffff' : '#fff3a8';
    ctx.fillRect(13 * k, -27 * k, 3 * k, 14 * k);
  }
  /** Witch: the bottle in her hand while throwing (purple) or drinking (red). */
  function drawWitchBottle(e) {
    const k = view.k;
    const drinking = e.drink > 0;
    const x = drinking ? e.x + e.w * 0.12 : e.x + e.w * 0.55;
    const y = drinking ? e.y + e.h * 0.28 : e.y - e.h * 0.05 - (0.4 - e.throwT) * 40 * k;
    at(x, y, 1, 1, drinking ? -2.2 : 0.4);
    ctx.globalAlpha = 1;
    const r = 8 * k;
    ctx.fillStyle = 'rgba(225,238,255,0.7)';
    ctx.fillRect(-r * 0.3, -r * 1.3, r * 0.6, r * 0.6);
    ctx.fillStyle = drinking ? '#ff4d6a' : '#a64dff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, TAU);
    ctx.fill();
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
      if (e.type === 'sighting') continue;
      glow(e.T.glow, e.x, e.y, big * 0.8, e.type === 'crystal' ? 0.5 + 0.2 * Math.sin(time * 6) : 0.2);
      if (e.elite) glow(C.gold, e.x, e.y, big * 1.05, 0.28 + 0.14 * Math.sin(time * 6 + e.ph));
      if (e.charge > 0) {
        if (e.type === 'enderman') {
          glow(C.pink, e.x - e.w * 0.28, e.y + e.h * 0.06, 22 * k * e.charge, e.charge);
          glow(C.pink, e.x + e.w * 0.28, e.y + e.h * 0.06, 22 * k * e.charge, e.charge);
        } else if (e.type === 'ghast') {
          glow(C.red, e.x, e.y + e.h * 0.25, 44 * k * e.charge, e.charge);
        } else if (e.T.axe) {
          glow(C.red, e.x, e.y, big * (0.6 + e.charge * 0.5), 0.25 + e.charge * 0.45);
        } else if (e.type === 'pillager') {
          glow(C.red, e.x, e.y + e.h * 0.42, 24 * k * e.charge, e.charge);
        } else if (e.type === 'breeze') {
          glow(C.cyan, e.x, e.y + e.h * 0.2, 46 * k * e.charge, e.charge);
        } else {
          glow(e.type === 'shrieker' || e.type === 'guardian' ? C.cyan : C.white, e.x, e.y + e.h * 0.3, 26 * k * e.charge, e.charge);
        }
      }
      if (e.type === 'blaze') glow(C.orange, e.x, e.y + e.h * 0.2, big * (0.7 + e.heat * 0.5), 0.15 + e.heat * 0.45);
      if (e.type === 'breeze') glow(C.cyan, e.x, e.y + e.h * 0.3, big * 1.1, 0.22);
      if (e.poisonT > 0) glow(C.green, e.x, e.y, big * 0.8, 0.3 + 0.12 * Math.sin(time * 8));
      if (e.type === 'witch' && (e.throwT > 0 || e.drink > 0)) glow(e.drink > 0 ? C.red : C.purple, e.x + e.w * 0.4, e.y, 40 * k, 0.6);
      if (e.T.axe && e.mode === 2) glow(e.T.axe === 'iron' ? C.white : C.gold, e.x, e.y, big * 1.2, 0.4);
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
    if (e.shield > 0 && e.mode === 'fight') {
      // shimmering energy bubble — shows how much shield is left
      const f = e.shield / Math.max(1, e.shieldMax);
      const rx = e.w * 0.62;
      const ry = e.h * 0.66;
      ctx.globalCompositeOperation = 'lighter';
      glow(C.cyan, e.x, e.y, Math.max(rx, ry) * 1.1, 0.12 + 0.12 * f);
      world();
      ctx.globalAlpha = 0.35 + 0.45 * f;
      ctx.strokeStyle = '#8fe9ff';
      ctx.lineWidth = (2 + 3 * f) * k;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, rx, ry, 0, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 3 * k;
      ctx.strokeStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const a0 = time * 1.6 + (i * TAU) / 4;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, rx + 6 * k, ry + 6 * k, 0, a0, a0 + 0.5 * f + 0.1);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (e.stun > 0) {
      // dizzy stars circling above its head
      world();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe066';
      for (let i = 0; i < 5; i++) {
        const a = time * 4 + (i * TAU) / 5;
        const x = e.x + Math.cos(a) * e.w * 0.35;
        const y = e.y - e.h * 0.55 + Math.sin(a) * 10 * k;
        ctx.beginPath();
        for (let j = 0; j < 10; j++) {
          const r = (j % 2 ? 3 : 8) * k;
          const b = (j / 10) * TAU - Math.PI / 2;
          if (j === 0) ctx.moveTo(x + Math.cos(b) * r, y + Math.sin(b) * r); else ctx.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    if (e.berserk && e.mode === 'fight') {
      ctx.globalCompositeOperation = 'lighter';
      glow(C.red, e.x, e.y, Math.max(e.w, e.h) * 0.85, 0.25 + 0.15 * Math.sin(time * 10));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
  /** The secret: a faint face with glowing white eyes, flickering at the edge of the screen. */
  function drawSighting(e) {
    const k = view.k;
    const a = clamp(Math.min(e.t * 1.5, e.life * 1.5), 0, 1) * (Math.sin(time * 31 + e.ph) > -0.6 ? 1 : 0.35);
    ctx.globalAlpha = 0.42 * a;
    blit(sprite(e.T.img, e.w, e.h, 'shade'), e.x, e.y, e.w, e.h, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      glow(C.white, e.x + s * e.w * 0.25, e.y + e.h * 0.06, 9 * k, 0.9 * a);
      glow(C.cyan, e.x + s * e.w * 0.25, e.y + e.h * 0.06, 20 * k, 0.35 * a);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  function drawEnemy(e) {
    if (e.type === 'sighting') { drawSighting(e); return; }
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
      case 'breeze': drawBreeze(e, false); break;
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
    if (e.type === 'breeze') drawBreeze(e, true);
    if (e.type === 'pillager') drawCrossbow(e);
    if (e.T.axe) drawBruteAxe(e);
    if (e.type === 'witch' && (e.throwT > 0 || e.drink > 0)) drawWitchBottle(e);
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
    // the light follows your own ship (or the teammate you are watching)
    const lp = viewTarget();
    if (dark < 0.02 || !lp) return;
    const k = view.k;
    base();
    const px = lp.x + camX;
    const py = lp.y + camY;
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
      if (e.dead || e.inv || e.y < 0 || e.mode === 'dying' || e.type === 'sighting') continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function updateBullets(dt) {
    const k = view.k;
    // on a guest's screen every shot is just for show: the host decides what gets hit
    const shadow = net && net.role === 'guest';
    for (const b of bullets) {
      if (b.dead) continue;
      if (b.homing) {
        const t = nearestEnemy(b.x, b.y);
        let ang = Math.atan2(b.vy, b.vx);
        if (t) ang = turnToward(ang, Math.atan2(t.y - b.y, t.x - b.x), b.turn * dt);
        const spd = Math.min(b.speed, Math.hypot(b.vx, b.vy) + 1800 * k * dt);
        b.vx = Math.cos(ang) * spd;
        b.vy = Math.sin(ang) * spd;
        b.rot = ang + (b.src === 'ult' && b.c ? Math.PI / 2 : Math.PI / 4);
        if (!b.orb) {
          b.trail -= dt;
          if (b.trail <= 0) { b.trail = 0.02; P(b.x, b.y, rand(-20, 20) * k, rand(-20, 20) * k, 0.3, 7 * k, b.src === 'ult' ? b.col : C.green, GLOW); }
        }
      } else {
        b.rot += b.spin * dt;
      }
      if (b.grav) b.vy += b.grav * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      // special-attack bombs (TNT, mega fireball) blow up when their fuse runs out or they reach the top
      if (b.boom && (b.life <= 0 || (b.top && b.y < view.h * 0.22))) { if (!shadow) boomShot(b); b.dead = true; continue; }
      if (b.life <= 0 || b.y < -50 || b.y > view.h + 50 || b.x < -50 || b.x > view.w + 50) { b.dead = true; continue; }
      if (shadow) {
        for (const e of enemies) {
          if (e.dead || e.mode === 'dying' || !hits(e, b.x, b.y, b.r)) continue;
          spark(b.x, b.y, e.inv ? C.white : pick(e.T.pal || [C.white]), 2);
          if (!e.T.boss) e.flash = Math.max(e.flash || 0, 0.06);
          b.dead = true;
          break;
        }
        continue;
      }
      for (const e of enemies) {
        if (e.dead || e === b.last || e.mode === 'dying') continue;
        // Blaze King's rods physically block shots
        if (e.T.boss && e.def.block && e.mode === 'fight' && dist2(b.x, b.y, e.x, e.y) < e.w * e.w && e.def.block(e, b)) { b.dead = true; break; }
        if (!hits(e, b.x, b.y, b.r)) continue;
        if (b.boom) { boomShot(b); b.dead = true; break; }
        if (e.inv) { b.dead = true; spark(b.x, b.y, C.white, 2); break; }
        ultCtx = b.uid || 0;
        hurtEnemy(e, b.dmg, b.x, b.y, b.src);
        ultCtx = 0;
        if (b.pierce > 0) { b.pierce -= 1; b.last = e; } else { b.dead = true; break; }
      }
      if (b.dead) continue;
      for (const t of ebullets) {
        if (t.dead || !t.hp || b.boom) continue;
        const rr = t.r + b.r;
        if (dist2(b.x, b.y, t.x, t.y) < rr * rr) {
          b.dead = true;
          t.hp -= b.dmg;
          spark(b.x, b.y, t.c, 3);
          if (t.hp <= 0) {
            ultCtx = b.uid || 0;
            popShootable(t, true);
            ultCtx = 0;
          }
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

  function onGraze(b, p = player) {
    stats.grazes += 1;
    if (stats.grazes === 100) Trophies.unlock('graze');
    nova = Math.min(100, nova + novaGain(1.5));
    addScore(10 * comboMult());
    P((b.x + p.x) / 2, (b.y + p.y) / 2, rand(-80, 80) * view.k, rand(-80, 80) * view.k, 0.25, 8 * view.k, C.white, GLOW);
    if (p === me) Sfx.play('graze');
    checkNovaReady();
  }
  function nearestPlayer(x, y) {
    let best = null;
    let bd = Infinity;
    for (const p of players) {
      if (!p.alive) continue;
      const d = dist2(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function updateEBullets(dt) {
    const k = view.k;
    const grazeR = 26 * k;
    const multi = players.length > 1;
    for (const b of ebullets) {
      if (b.dead) continue;
      const d = EB[b.kind];
      b.t += dt;
      b.life -= dt;
      const hom = d.homing || b.home;
      const near = multi ? nearestPlayer(b.x, b.y) : (player && player.alive ? player : null);
      if (hom && near) {
        const sp = Math.hypot(b.vx, b.vy);
        const ang = turnToward(Math.atan2(b.vy, b.vx), Math.atan2(near.y - b.y, near.x - b.x), hom * dt);
        b.vx = Math.cos(ang) * sp;
        b.vy = Math.sin(ang) * sp;
      }
      if (b.g) b.vy += b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.spin) b.rot += b.spin * dt;
      // lobbed potions fly over everything (their splash is a hazard that goes off when they land)
      if (d.ghost) { if (b.life <= 0 || b.y > view.h + 80) b.dead = true; continue; }
      if (b.fuse > 0) {
        b.fuse -= dt;
        if (b.fuse <= 0 || (near && b.y > near.y - 70 * k && Math.abs(b.x - near.x) < 220 * k)) { fuseBurst(b); continue; }
      }
      if (b.kind === 'lavab' && b.vy > 0 && b.y >= b.ty) {
        b.dead = true;
        addHazard('lava', b.x, b.y, 50 * k, 3);
        explode(b.x, b.y, PAL.magma, 0.6, C.orange);
        continue;
      }
      if (b.life <= 0) { b.dead = true; spark(b.x, b.y, b.c, 3); continue; }
      if (b.y > view.h + 40 || b.y < -360 * k || b.x < -60 || b.x > view.w + 60) { b.dead = true; continue; }
      for (const p of players) {
        if (!p.alive || p.intro > 0) continue;
        const d2 = dist2(b.x, b.y, p.x, p.y);
        if (buffs.shield > 0) {
          const sr = p.w * 0.62 + b.r;
          if (d2 < sr * sr) {
            if (b.hp) popShootable(b, true);
            else { b.dead = true; spark(b.x, b.y, C.cyan, 5); }
            sfx('shield');
            break;
          }
        }
        const hr = b.r + hitR(p);
        if (d2 < hr * hr) {
          if (hurtPlayer(1, p)) {
            b.dead = true;
            if (d.wind) windHit(b, p);
            else if (b.kind === 'tnt') popShootable(b, false);
            else if (b.kind === 'dfire') fuseBurst(b);
            else if (b.kind === 'ghastball' || b.kind === 'wskull' || b.kind === 'bskull' || b.kind === 'rock') explode(b.x, b.y, b.kind === 'bskull' ? PAL.bskull : b.kind === 'rock' ? PAL.ravager : PAL.fire, 0.8, b.c);
            break;
          }
        } else if (!b.grazed && d2 < (hr + grazeR) * (hr + grazeR)) {
          b.grazed = true;
          onGraze(b, p);
        }
      }
    }
  }
  function drawEBullets() {
    const k = view.k;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of ebullets) {
      if (b.kind === 'rock' || b.kind === 'block') continue;
      const f = b.kind === 'tnt' ? 2.2 : b.kind === 'ghastball' ? 2.6 : 3.2;
      glow(b.c, b.x, b.y, b.r * f, b.kind === 'arrow' || b.kind === 'bolt' ? 0.35 : b.kind === 'wskull' ? 0.45 : 0.6);
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
        case 'hshot':
        case 'dfire': {
          const r = b.r * (b.kind === 'magic' || b.kind === 'dfire' || b.kind === 'hshot' ? 1.25 + 0.15 * Math.sin(b.t * 18) : 1.3);
          at(b.x, b.y);
          ctx.drawImage(orbTex(b.c), -r, -r, r * 2, r * 2);
          break;
        }
        case 'bolt': {
          const L = 15 * k;
          at(b.x, b.y, 1, 1, b.rot);
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth = 3 * k;
          ctx.beginPath(); ctx.moveTo(-L * 2.4, 0); ctx.lineTo(-L, 0); ctx.stroke();
          ctx.strokeStyle = '#7a5530';
          ctx.lineWidth = 2.6 * k;
          ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L * 0.55, 0); ctx.stroke();
          ctx.fillStyle = '#c0c6d2';
          ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L * 0.38, -4.5 * k); ctx.lineTo(L * 0.38, 4.5 * k); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#d8d0c0';
          ctx.beginPath(); ctx.moveTo(-L * 0.7, 0); ctx.lineTo(-L * 1.1, -4 * k); ctx.lineTo(-L * 1.05, 0); ctx.lineTo(-L * 1.1, 4 * k); ctx.closePath(); ctx.fill();
          break;
        }
        case 'potion': {
          const r = b.r;
          at(b.x, b.y, 1, 1, b.rot);
          ctx.fillStyle = 'rgba(225,238,255,0.6)';
          ctx.fillRect(-r * 0.3, -r * 1.3, r * 0.6, r * 0.6);
          ctx.fillStyle = '#8a5a3a';
          ctx.fillRect(-r * 0.36, -r * 1.55, r * 0.72, r * 0.3);
          ctx.fillStyle = b.c.s;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(240,248,255,0.85)';
          ctx.lineWidth = 1.6 * k;
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fillRect(-r * 0.45, -r * 0.45, r * 0.26, r * 0.26);
          break;
        }
        case 'wind': {
          const r = b.r;
          at(b.x, b.y, 1, 1, b.t * 14);
          ctx.strokeStyle = 'rgba(235,250,255,0.9)';
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            ctx.lineWidth = (2.8 - i * 0.6) * k;
            ctx.beginPath();
            ctx.arc(0, 0, r * (0.4 + i * 0.3), i * 2.1, i * 2.1 + 3.8);
            ctx.stroke();
          }
          break;
        }
        case 'block': {
          const s = b.r * 1.7;
          at(b.x, b.y, 1, 1, b.rot);
          ctx.fillStyle = b.c.s;
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(-s / 2, -s / 2, s, s * 0.25);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(-s / 2, s * 0.25, s, s * 0.25);
          ctx.strokeStyle = 'rgba(0,0,0,0.55)';
          ctx.lineWidth = 1.5 * k;
          ctx.strokeRect(-s / 2, -s / 2, s, s);
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
    if (type === 'heart' && !rules.heartDrops) return; // Hardcore Brutal: no hearts, only totems
    pickups.push({
      type, x, y, vx: vx === undefined ? rand(-40, 40) * view.k : vx, vy: vy === undefined ? -120 * view.vs : vy,
      t: 0, bob: 0, ph: rand(TAU), r: 18 * view.k, dead: false,
    });
  }
  function updatePickups(dt) {
    const k = view.k;
    for (const pk of pickups) {
      if (pk.dead) continue;
      pk.t += dt;
      pk.bob = Math.sin(pk.t * 4 + pk.ph) * 4 * k;
      // carried by an Allay pet: it decides where the pickup goes
      if (pk.carry) {
        if (players.some((q) => q.pid === pk.carry && q.alive && q.pet && q.pet.id === 'allay')) continue;
        pk.carry = 0;
      }
      let pulled = false;
      // pulled toward (and collected by) the nearest ship
      const p = players.length > 1 ? nearestPlayer(pk.x, pk.y) : me;
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
        if (d < p.w * 0.5 + pk.r) { pk.dead = true; applyPickup(pk, p); continue; }
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
  /** Power-ups (overdrive, shield, magnet...) help the whole team in co-op; stars, hearts and totems go to `p`. */
  function applyPickup(pk, p = player) {
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
        if (buffs.drones <= 0) resetDrones(p);
        buffs.drones = BUFF_MAX.drones;
        droneUlt = 0; // picked-up drones are normal: their kills count as yours
        label = 'ALLAY DRONES!';
        break;
      case 'totem':
        totemOut = false;
        if (!p.totem) { p.totem = true; label = 'TOTEM OF UNDYING'; }
        else label = '+' + addScore(1000);
        break;
      case 'heart':
        debuffs.fatigue = 0;
        if (p.hp < p.maxHp) { p.hp += 1; label = '+1 HEART'; heartPop(p, 1); }
        else if (p.maxHp < MAX_HEARTS && rules.extraHearts) { p.maxHp += 1; p.hp += 1; label = 'MAX HEARTS UP!'; heartPop(p, 1); }
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
    sfx(pk.type === 'gem' ? 'pickup' : pk.type === 'star' ? 'levelup' : pk.type === 'totem' ? 'totem' : 'power');
    if (p === me) Input.vibrate(15);
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
  /**
   * Waves work the same in every game, they just mean different things:
   *   Arcade       wave n, a boss every 5th wave
   *   Boss Rush    every wave is a boss (wave n = boss n), scaled like Arcade's wave n × 5
   *   Village Raid raid r = waves 5r-4 … 5r: four waves of illagers, then the raid captain
   */
  const rushing = () => run.game === 'bossrush';
  const raidOf = (n) => ({ raid: Math.ceil(n / 5), w: ((n - 1) % 5) + 1 });
  function startWave(n) {
    const rush = rushing();
    // update the checkpoint with whatever the player picked up after the boss fell
    if (n > 1 && (rush || (n - 1) % 5 === 0)) saveCheckpoint(n, false);
    const en = rush ? n * 5 : n; // how tough this wave is, in Arcade waves
    wave.n = n;
    wave.cycle = rush ? n - 1 : Math.floor((n - 1) / 5);
    wave.boss = rush || n % 5 === 0;
    // co-op: tougher and more numerous mobs for each extra ship
    const team = Math.max(1, players.filter((p) => !p.left).length);
    wave.hpMul = mobHp(en) * (1 + (team - 1) * 0.3);
    wave.spdMul = 1 + Math.min(0.6, (en - 1) * 0.025);
    wave.fireMul = (1 + Math.min(1.2, (en - 1) * 0.045)) * diff.fire;
    wave.spawned = 0;
    wave.cleared = 0;
    wave.budget = wave.boss ? 0 : Math.round((10 + n * 2.6 + wave.cycle * 3) * (1 + (team - 1) * 0.35) * (run.game === 'raid' ? 0.85 : 1));
    if (net && run.mode === 'classic') respawnDown();
    wave.interval = Math.max(0.32, 1.1 - en * 0.045);
    wave.timer = 1.4;
    wave.hurt = false;
    wave.secret = null;
    // the secret: from wave 16 on (Arcade), something may watch from the edge of the screen
    wave.sightT = run.game === 'arcade' && !wave.boss && n >= 16 && !heroMet && Math.random() < 0.22 ? rand(5, 14) : 0;
    for (const p of players) if (p.pet) p.pet.bubble = true;
    wave.state = 'active';
    if (!rush && n >= 15) Trophies.unlock('survivor');
    if (!rush && n >= 10 && diffKey === 'hard') Trophies.unlock('hardcore');
    const zi = (rush ? n - 1 : wave.cycle) % ZONES.length;
    setZone(zi);
    if (wave.boss) {
      // Boss Rush: after a full lap the secret one comes for you
      if (rush && rushSecret && !heroMet) { wave.secret = 'herobrine'; rushSecret = false; heroMet = true; }
      const def = wave.secret ? BK.ALL[wave.secret] : nextBossDef();
      wave.bossT = 3.4;
      if (wave.secret) U.banner('???', 'SOMETHING WAS WATCHING YOU ALL ALONG', 'warning', 3200);
      else if (run.game === 'raid') U.banner(`RAID ${raidOf(n).raid} · CAPTAIN`, `${def.name} LEADS THE RAID!`, 'warning', 3200);
      else if (rush) U.banner(`BOSS ${n}`, def.warning, 'warning', 3200);
      else U.banner('WARNING', def.warning, 'warning', 3200);
      sfx(run.game === 'raid' && !wave.secret ? 'horn' : 'warning');
      music(def.music);
      Input.vibrate([80, 80, 80, 80, 80]);
    } else if (run.game === 'raid') {
      const { raid, w } = raidOf(n);
      U.banner(w === 1 ? `RAID ${raid}` : `WAVE ${w} OF 4`, w === 1 ? 'THE ILLAGERS ARE COMING — PROTECT THE VILLAGE!' : `RAID ${raid}  ·  ${Math.ceil(village.hp)} VILLAGE HEALTH LEFT`, 'wave', 2400);
      sfx(w === 1 ? 'horn' : 'wave');
    } else {
      const pct = Math.round((mobHp(n) / diff.ehp - 1) * 100);
      U.banner(`WAVE ${n}`, ZONES[zi].name + (pct > 0 ? `  ·  MOB HP +${pct}%` : ''), 'wave', 2200);
      sfx('wave');
    }
  }
  function waveClear() {
    wave.state = 'clear';
    wave.breakT = rushing() ? 4.2 : 3.4;
    const perfect = !wave.hurt;
    const bonus = addScore(200 * (rushing() ? wave.n * 5 : wave.n) * (perfect ? 2 : 1));
    const tail = `+${fmt(bonus)}${perfect ? '  ·  PERFECT!' : ''}`;
    if (wave.boss && rushing() && rushSecret) U.banner('BOSS RUSH COMPLETE!', `ALL 11 BOSSES DOWN  ·  ${tail}`, 'clear', 3000);
    else if (wave.boss && run.game === 'raid' && !wave.secret) U.banner('RAID DEFEATED!', `HERO OF THE VILLAGE  ·  ${tail}`, 'clear', 2600);
    else U.banner(wave.boss ? 'BOSS DEFEATED' : 'WAVE CLEAR', tail, 'clear', 2400);
    sfx('clear');
    bg.warpT = 1.8;
    if (perfect && wave.n >= 2) spawnPickup(pick(POWER_POOL), view.w / 2, -20, 0, 60 * view.vs);
    if (wave.boss) music('game');
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
        if (wave.bossT <= 0) spawnBoss(wave.secret);
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
    // the secret: from wave 16 on, something may be watching from the edge of the screen
    if (wave.sightT > 0 && (wave.sightT -= dt) <= 0) spawnSighting();
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
  /** Village Raid: illagers only — pillager patrols, vindicators, witches, evokers (with their vexes). */
  function spawnRaidGroup() {
    const { raid, w } = raidOf(wave.n);
    const k = view.k;
    const W = view.w;
    const m = 50 * k;
    const late = w >= 2 || raid >= 2;
    if (Math.random() < 0.28) {
      const form = pick(late ? ['patrol', 'axes', 'patrol'] : ['patrol']);
      if (form === 'patrol') {
        const n = Math.min(5, 3 + Math.floor(raid / 2));
        for (let i = 0; i < n; i++) spawnEnemy('pillager', W * ((i + 1) / (n + 1)), -40 * k - (i % 2) * 30 * k);
        return n;
      }
      spawnEnemy('vindicator', W * 0.3, -40 * k);
      spawnEnemy('vindicator', W * 0.7, -60 * k);
      return 2;
    }
    const type = weighted([
      ['pillager', 6],
      ['vindicator', late ? 3.5 : 0],
      ['witch', late && countType('witch') < 2 + Math.floor(raid / 2) ? 2 : 0],
      ['evoker', (w >= 3 || raid >= 2) && countType('evoker') < 1 + Math.floor(raid / 3) ? 1.4 : 0],
      ['vex', w >= 3 ? 1.5 : 0],
    ]);
    const x = rand(m, W - m);
    if (type === 'vex') {
      for (let i = 0; i < 3; i++) spawnEnemy('vex', clamp(x + (i - 1) * 40 * k, m, W - m), -30 * k - i * 20 * k);
      return 3;
    }
    spawnEnemy(type, x, -50 * k);
    return 1;
  }
  function spawnGroup() {
    if (run.game === 'raid') return spawnRaidGroup();
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
      if (n >= 7) forms.push('patrol');
      switch (pick(forms)) {
        case 'patrol': {
          // an illager patrol: pillagers in a row, a witch behind them from wave 13
          for (let i = 0; i < 3; i++) spawnEnemy('pillager', W * (0.25 + i * 0.25), -40 * k - (i === 1 ? 30 * k : 0));
          if (n >= 13 && countType('witch') < 2) { spawnEnemy('witch', W * 0.5, -120 * k); return 4; }
          return 3;
        }
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
      ['pillager', n >= 4 ? 3.5 : 0],
      ['witch', n >= 6 && countType('witch') < 2 + lap ? 2.5 : 0],
      ['breeze', n >= 9 && countType('breeze') < 2 + lap ? 3 : 0],
      ['brute', n >= 12 && countType('brute') < 1 + Math.floor(n / 25) ? 2 : 0],
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
      sfx('teleport');
      return 1;
    }
    spawnEnemy(type, x, -50 * k);
    return 1;
  }

  // ---- Village Raid: the village at the bottom of the screen
  // Every raider that gets past the ships (off the bottom edge) damages it; at 0 the raid is lost.
  const village = { hp: 0, max: 0, houses: [], folk: [], hitT: 0, fallen: false };
  const VILLAGE_MAX = 20;
  const RAID_HIT = { vex: 0.5, phantom: 0.5, evoker: 2, vindicator: 2, brute: 2, witch: 1.5 };
  function initVillage(hp) {
    const k = view.k;
    village.max = VILLAGE_MAX;
    village.hp = clamp(hp === undefined ? VILLAGE_MAX : hp, 1, VILLAGE_MAX);
    village.fallen = false;
    village.hitT = 0;
    village.houses = [];
    const n = clamp(Math.round(view.w / (120 * k)), 4, 12);
    for (let i = 0; i < n; i++) {
      village.houses.push({ x: ((i + 0.5) / n) * view.w + rand(-14, 14) * k, w: rand(58, 76) * k, h: rand(38, 54) * k, roof: pick(['#5a3a22', '#7a3a2a', '#4a4a52']), burn: 0, seed: Math.random() });
    }
    village.folk = [];
    for (let i = 0; i < Math.min(6, n); i++) village.folk.push({ x: rand(view.w), dir: Math.random() < 0.5 ? -1 : 1, sp: rand(14, 26) * k, robe: pick(['#6b4a2a', '#3f6b2e', '#7a2f2f', '#ececec', '#3a4f8a']) });
  }
  /** A raider got through: burn the nearest house and hurt the village. */
  function villageHit(e) {
    if (village.fallen || state !== 'playing') return;
    const k = view.k;
    const dmg = (RAID_HIT[e.type] || 1) * (e.elite ? 2 : 1);
    village.hp = Math.max(0, village.hp - dmg);
    village.hitT = 1.2;
    let near = null;
    for (const h of village.houses) if (!near || Math.abs(h.x - e.x) < Math.abs(near.x - e.x)) near = h;
    if (near) near.burn = Math.min(1, near.burn + 0.25 * dmg);
    const y = view.h - 50 * k;
    explode(clamp(e.x, 20 * k, view.w - 20 * k), y, PAL.fire, 0.9, C.orange);
    popup(clamp(e.x, 60 * k, view.w - 60 * k), y - 30 * k, `VILLAGE -${dmg}`, '#ff8a3a', 11, 1.3);
    sfx('explode', 1.2);
    shake(0.25);
    if (village.hp <= 0) villageFalls();
  }
  function villageFalls() {
    village.fallen = true;
    for (const h of village.houses) h.burn = 1;
    for (let i = 0; i < 6; i++) explode(rand(view.w), view.h - rand(20, 60) * view.k, PAL.fire, 1.6, C.orange);
    U.banner('THE VILLAGE HAS FALLEN', 'THE RAID IS LOST', 'warning', 2600);
    U.flash('hurt');
    sfx('bigExplode');
    music(null);
    shake(1);
    slowmo(1.4, 0.25);
    state = 'dying';
    dieT = 0;
  }
  /** After a raid captain falls the villagers patch things up. */
  function villageRepair() {
    village.hp = Math.min(village.max, village.hp + village.max * 0.3);
    for (const h of village.houses) h.burn = Math.max(0, h.burn - 0.5);
  }
  function updateVillage(dt) {
    if (run.game !== 'raid') return;
    const k = view.k;
    if (village.hitT > 0) village.hitT -= dt;
    // villagers stroll about (and run when the village is hit)
    for (const f of village.folk) {
      f.x += f.dir * f.sp * (village.hitT > 0 ? 3.5 : 1) * dt;
      if (f.x < 10 * k || f.x > view.w - 10 * k) { f.dir *= -1; f.x = clamp(f.x, 10 * k, view.w - 10 * k); }
      else if (Math.random() < dt * 0.15) f.dir *= -1;
    }
    // burning houses smoke and flicker
    if (hiQ) {
      for (const h of village.houses) {
        if (h.burn <= 0 || Math.random() > dt * 10 * h.burn) continue;
        const y = view.h - 24 * k - h.h;
        P(h.x + rand(-0.4, 0.4) * h.w, y + rand(0, 10) * k, rand(-10, 10) * k, -rand(30, 70) * k, rand(0.4, 0.8), rand(6, 12) * k, pick([C.orange, C.gold, C.red]), GLOW, 1);
        if (Math.random() < 0.3) P(h.x + rand(-0.3, 0.3) * h.w, y - 10 * k, rand(-8, 8) * k, -rand(30, 60) * k, rand(0.8, 1.4), 22 * k, C.smoke, SMOKE, 1);
      }
    }
  }
  /** The village: a grass strip with oak houses and a few villagers, along the bottom of the screen. */
  function drawVillage() {
    if (run.game !== 'raid' || !village.houses.length) return;
    const k = view.k;
    world();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const gy = view.h - 24 * k;
    ctx.fillStyle = '#5a3c22';
    ctx.fillRect(-20, gy + 6 * k, view.w + 40, view.h - gy);
    ctx.fillStyle = '#3f8a2c';
    ctx.fillRect(-20, gy, view.w + 40, 7 * k);
    ctx.fillStyle = '#58b03d';
    for (let x = 0; x < view.w; x += 14 * k) ctx.fillRect(x, gy, 7 * k, 3 * k);
    const mix = (a, b, t) => {
      const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
      const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
      return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
    };
    for (const h of village.houses) {
      const x0 = h.x - h.w / 2;
      const y0 = gy - h.h;
      // oak walls with a log frame (blackened as it burns)
      ctx.fillStyle = mix('#b8935a', '#2e221a', h.burn);
      ctx.fillRect(x0, y0, h.w, h.h);
      ctx.fillStyle = mix('#6b4a2a', '#1c1410', h.burn);
      ctx.fillRect(x0, y0, 5 * k, h.h);
      ctx.fillRect(x0 + h.w - 5 * k, y0, 5 * k, h.h);
      ctx.fillRect(x0, y0, h.w, 4 * k);
      // roof
      ctx.fillStyle = mix(h.roof, '#151010', h.burn);
      ctx.beginPath();
      ctx.moveTo(x0 - 6 * k, y0 + 2 * k);
      ctx.lineTo(h.x, y0 - h.h * 0.55);
      ctx.lineTo(x0 + h.w + 6 * k, y0 + 2 * k);
      ctx.closePath();
      ctx.fill();
      // door + a warm window (the light goes out when it burns)
      ctx.fillStyle = mix('#4a3018', '#120c08', h.burn);
      ctx.fillRect(h.x - 6 * k, gy - 18 * k, 12 * k, 18 * k);
      ctx.fillStyle = h.burn > 0.6 ? '#2a1a12' : `rgba(255,${h.burn > 0 ? 140 : 214},${h.burn > 0 ? 60 : 110},${0.85 + 0.15 * Math.sin(time * 3 + h.seed * 9)})`;
      ctx.fillRect(x0 + h.w * 0.68, y0 + h.h * 0.3, 10 * k, 9 * k);
      ctx.fillRect(x0 + h.w * 0.14, y0 + h.h * 0.3, 10 * k, 9 * k);
    }
    // villagers: little robed folk with big noses
    for (const f of village.folk) {
      const bob = Math.abs(Math.sin(time * (village.hitT > 0 ? 18 : 7) + f.x)) * 2 * k;
      ctx.fillStyle = f.robe;
      ctx.fillRect(f.x - 4 * k, gy - 13 * k - bob, 8 * k, 10 * k);
      ctx.fillStyle = '#c69a78';
      ctx.fillRect(f.x - 3.5 * k, gy - 20 * k - bob, 7 * k, 7 * k);
      ctx.fillStyle = '#a8775a';
      ctx.fillRect(f.x + f.dir * 3 * k - 1.5 * k, gy - 16 * k - bob, 3 * k, 4 * k);
    }
    // fire glow over burning houses
    ctx.globalCompositeOperation = 'lighter';
    for (const h of village.houses) if (h.burn > 0) glow(C.orange, h.x, gy - h.h * 0.8, h.w * (0.6 + h.burn * 0.5), 0.25 + 0.25 * h.burn + 0.1 * Math.sin(time * 9 + h.seed * 7));
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- the secret boss
  function spawnSighting() {
    const k = view.k;
    const left = Math.random() < 0.5;
    const e = spawnEnemy('sighting', left ? rand(34, 80) * k : view.w - rand(34, 80) * k, rand(0.1, 0.3) * view.h, { noElite: true });
    e.spawn = 1;
    sfx('whisper');
  }
  /** Someone shot the face at the edge of the screen... */
  function herobrineWakes(e) {
    heroMet = true;
    for (const m of enemies) if (!m.dead && m !== e) { m.dead = true; explode(m.x, m.y, m.T.pal, 0.6, C.white); }
    for (const b of ebullets) b.dead = true;
    hazards.length = 0;
    wave.boss = true;
    wave.secret = 'herobrine';
    wave.bossT = 3.6;
    wave.sightT = 0;
    wave.spawned = wave.budget;
    popup(e.x, e.y, '...', '#ffffff', 16, 1.6);
    U.banner('???', 'YOU SHOULD NOT HAVE DONE THAT', 'warning', 3400);
    U.flash('white');
    sfx('whisper');
    sfx('thunder');
    shake(0.7);
    music('herobrine');
    darkT = 0;
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
    fires.length = 0;
  }
  /**
   * Starts a run. opts.game: 'arcade' (default) | 'bossrush' | 'raid'.
   * opts.mode: 'classic' (default) or 'hardcore' with opts.tier ('extreme' | 'insane' | 'brutal').
   * opts.checkpoint: a Classic checkpoint of that game to continue from.
   */
  function start(opts = {}) {
    clearWorld();
    decor.length = 0;
    const game = GAMES.some((g) => g.id === opts.game) ? opts.game : 'arcade';
    const tier = opts.mode === 'hardcore' ? HARDCORE_TIERS.find((t) => t.id === opts.tier) || HARDCORE_TIERS[0] : null;
    const cp = !tier && opts.checkpoint ? opts.checkpoint : null;
    run = { game, mode: tier ? 'hardcore' : 'classic', tier: tier ? tier.id : null };
    // the raid's captains: the illagers' own bosses first, then everyone else
    bossOrder = gameOrder(game);
    rushSecret = false;
    // Hardcore: never more hearts than you start with; Brutal also has no heart drops and 1-heart totems
    rules = tier
      ? { extraHearts: false, heartDrops: tier.heartDrops, totemHearts: tier.totemHearts }
      : { extraHearts: true, heartDrops: true, totemHearts: 3 };
    const want = tier ? 'hard' : cp ? cp.diff : opts.diff || Settings.get('difficulty');
    diffKey = DIFF[want] ? want : 'normal';
    diff = DIFF[diffKey];
    const hearts = tier ? tier.hearts : clamp(Math.round(opts.hearts || Settings.get('hearts') || 5), 1, MAX_HEARTS);
    // fewer hearts = bigger score bonus (1 heart x1.4, 10 hearts x0.75); Hardcore tiers add their own bonus
    heartMul = (hearts <= 5 ? 1 + (5 - hearts) * 0.1 : 1 - (hearts - 5) * 0.05) * (tier ? tier.bonus : 1);
    hud.tier = run.tier;
    score = 0;
    resetCombo();
    nova = 50;
    novaReadyShown = false;
    novaLock = 0;
    starOut = false;
    totemOut = false;
    heroMet = false;
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
    heartFx.length = 0;
    droneOwner = null;
    droneUlt = 0;
    // co-op: one ship per player in the room, each with its own name and skin
    const roster = opts.roster && opts.roster.length ? opts.roster : null;
    players = roster
      ? roster.map((r, i) => makePlayer(hearts, { pid: r.pid, name: r.name, skin: r.skin, pet: r.pet || 'none', slot: i, count: roster.length }))
      : [makePlayer(hearts)];
    me = players.find((p) => p.pid === (opts.mePid || 1)) || players[0];
    player = me;
    // Boss Rush: no mobs to farm weapon stars from, so every ship starts with a level 3 gun
    if (game === 'bossrush') for (const p of players) p.weapon = 3;
    if (game === 'raid') initVillage(); else { village.houses = []; village.folk = []; village.hp = village.max = 0; village.fallen = false; }
    Object.assign(wave, { n: 0, cycle: 0, boss: false, state: 'clear', breakT: 1.3, spawned: 0, budget: 0, cleared: 0, timer: 0, hpMul: 1, spdMul: 1, fireMul: 1 });
    setZone(cp ? (game === 'bossrush' ? cp.wave - 1 : Math.floor((cp.wave - 1) / 5)) % ZONES.length : 0);
    if (cp) resumeCheckpoint(cp);
    bg.mix = 1;
    bg.warpT = 1.2;
    state = 'playing';
    Trophies.startRun();
    Input.reset();
    Sfx.duck(false);
    music('game');
    lastT = performance.now();
    UI.onStart();
    const gname = gameOf(game).name;
    if (cp) UI.toast(`CHECKPOINT LOADED · ${gname} · ${gameOf(game).unit} ${game === 'raid' ? Math.ceil(cp.wave / 5) : cp.wave}`);
    else if (tier) UI.toast(`${gname} · HARDCORE ${tier.name}`);
    else if (game !== 'arcade') UI.toast(gname);
  }
  /** Classic: remember the run right after a boss so it can be continued from the next wave. */
  function saveCheckpoint(nextWave, announce) {
    if (run.mode !== 'classic' || !me || net || village.fallen) return; // co-op runs aren't saved
    const p = me;
    Checkpoint.save({
      v: 1, game: run.game, village: run.game === 'raid' ? Math.ceil(village.hp) : undefined, wave: nextWave, bossLevel, score: Math.floor(score), hp: p.hp, maxHp: p.maxHp, weapon: p.weapon, power: p.power,
      totem: p.totem, nova, diff: diffKey, heartMul, runTime, stats: { ...stats }, seen: [...seen], date: Date.now(),
    });
    if (announce) UI.toast('✓ CHECKPOINT SAVED');
  }
  function resumeCheckpoint(cp) {
    const p = me;
    // a checkpoint always puts you back at full health
    p.maxHp = p.hp = clamp(Math.round(cp.maxHp) || 5, 1, MAX_HEARTS);
    p.weapon = clamp(cp.weapon || 1, 1, 5);
    p.power = cp.power || 1;
    p.totem = !!cp.totem;
    heartMul = cp.heartMul || heartMul;
    score = cp.score || 0;
    nova = Math.max(50, cp.nova || 0);
    bossLevel = cp.bossLevel || 0;
    Object.assign(stats, cp.stats || {});
    runTime = cp.runTime || 0;
    for (const t of cp.seen || []) seen.add(t);
    if (run.game === 'raid') initVillage(cp.village);
    wave.n = cp.wave - 1;
  }
  function pause() {
    if (state !== 'playing') return;
    const info = { wave: wave.n, score: Math.floor(score), difficulty: diffKey, game: run.game, mode: run.mode, tier: run.tier, hearts: me ? me.maxHp : 0, mp: !!net };
    if (net) {
      // co-op can't stop the world for everyone: open the menu while the game keeps running
      if (netMenu) return;
      netMenu = true;
      Input.reset();
      UI.showPause(info);
      return;
    }
    state = 'paused';
    Input.reset();
    Sfx.duck(true);
    UI.showPause(info);
  }
  function resume() {
    if (net) {
      if (!netMenu) return;
      netMenu = false;
      Input.reset();
      UI.onResume();
      return;
    }
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
    players = [];
    me = null;
    player = null;
    heartFx.length = 0;
    ets = 1;
    setZone(0);
    Sfx.duck(false);
    music('menu');
    if (net || fixedWorld) {
      net = null;
      netMenu = false;
      specPid = 0;
      fixedWorld = null;
      netEnts.clear();
      netBul.clear();
      netPk.clear();
      resize();
    }
  }
  function runSummary() {
    return {
      score: Math.floor(score), wave: wave.n, kills: stats.kills, maxCombo: stats.maxCombo, time: runTime, grazes: stats.grazes,
      bosses: stats.bosses, elites: stats.elites, difficulty: diffKey, game: run.game, mode: run.mode, tier: run.tier, fell: village.fallen,
    };
  }
  function gameOver(sum = null) {
    state = 'over';
    const r = sum || runSummary();
    const s = r.score;
    if (s >= 100000) Trophies.unlock('legend');
    const prevBest = Scores.best();
    const entry = { score: s, wave: r.wave, kills: r.kills, diff: r.difficulty, hearts: me ? me.maxHp : 0, mode: net ? 'coop' : modeTag(run.game, run.tier), game: run.game, date: Date.now() };
    const idx = Scores.submit(entry);
    if (net && net.role === 'host') net.broadcast({ t: 'over', sum: r });
    UI.showGameOver({
      ...r, best: Math.max(prevBest, s), isBest: s > prevBest && s > 0, rankIndex: idx, entry, top: Scores.top(5),
      trophies: Trophies.sessionUnlocks(),
      checkpoint: !net && run.mode === 'classic' ? Checkpoint.get(run.game) : null,
      mp: !!net, host: !!(net && net.role === 'host'),
    });
    Sfx.play('gameover');
    Sfx.music('menu');
  }

  // ================================================================ multiplayer
  // The host's game runs everything (waves, mobs, bosses, damage). Each guest steers and shoots its own
  // ship locally, sends it to the host ~30 times a second and draws the world from the host's updates
  // (~20 a second). Explosions, sounds and banners travel as small events. Players' shots aren't sent:
  // every device draws its teammates' shots itself (only the host's shots do damage).
  const SNAP_INT = 0.05;
  const INPUT_INT = 1 / 30;
  const EB_KINDS = Object.keys(EB);
  const PK_KINDS = Object.keys(PK);
  const SKIP_KEYS = new Set(['T', 'def', 'queue', 'tgt', 'tgtT', 'nid', 'wb', '__l']);
  // numbers that glide smoothly between updates on the guests
  const LERP_KEYS = new Set(['x', 'y', 't', 'mt', 'rot', 'rodA', 'heat', 'charge', 'fuse', 'open', 'sq', 'grow', 'spawn', 'scale', 'mouth', 'lx', 'ly', 'gy', 'enterT', 'dieT', 'hp', 'shield']);
  let nidSeq = 0;
  const sentCache = new WeakMap();
  const netEnts = new Map(); // guest: id → mob / boss
  const netBul = new Map();  // guest: id → enemy bullet
  const netPk = new Map();   // guest: id → pickup

  /**
   * The shared world. Its shape is a compromise between everyone's screens (`ars` = width / height of
   * each), so a phone held upright and a wide monitor can play together. The host keeps full size: the
   * world is the host's screen with one side trimmed.
   */
  function netWorld(ars) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const list = (ars || []).filter((a) => a > 0);
    let a = list.length ? Math.exp(list.reduce((s, x) => s + Math.log(x), 0) / list.length) : w / h;
    a = clamp(a, 0.62, 1.9);
    if (Math.abs(a - w / h) < 0.02) return { w, h };
    return a < w / h ? { w: Math.round(h * a), h } : { w, h: Math.round(w / a) };
  }
  /**
   * o: { role, world, roster: [{ pid, name, skin }], mePid, settings: { mode, diff, hearts, tier },
   *      send(msg) (guest → host), broadcast(msg) / sendTo(pid, msg) (host → guests) }
   */
  function startNet(o) {
    net = {
      role: o.role, send: o.send || (() => {}), broadcast: o.broadcast || (() => {}), sendTo: o.sendTo || (() => {}),
      out: [], seq: 0, snapT: 0, inT: 0, sentE: new Set(), waveProg: -1,
    };
    netMenu = false;
    specPid = 0;
    netEnts.clear();
    netBul.clear();
    netPk.clear();
    fixedWorld = { w: Math.round(o.world.w), h: Math.round(o.world.h) };
    resize();
    const s = o.settings || {};
    start({ game: s.game, mode: s.mode, tier: s.tier, diff: s.diff, hearts: s.hearts, roster: o.roster, mePid: o.mePid });
    UI.toast(o.role === 'host' ? `CO-OP · ${players.length} PLAYERS` : 'CONNECTED · GOOD LUCK!');
    if (view.z < 0.55 && view.sh > view.sw) setTimeout(() => { if (net) UI.toast('TIP: TURN YOUR PHONE SIDEWAYS FOR A BIGGER VIEW'); }, 2600);
  }

  // ---- host → guests
  function encVal(v, depth) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v !== 'object' || depth > 3) return undefined;
    // never follow links to other mobs, ships or images
    if (v.T || v.skinKey || v instanceof HTMLCanvasElement || v instanceof HTMLImageElement) return undefined;
    if (Array.isArray(v)) {
      if (v.length > 64) return undefined;
      return v.map((x) => { const y = encVal(x, depth + 1); return y === undefined ? null : y; });
    }
    const o = {};
    for (const key in v) {
      if (typeof v[key] === 'function') continue;
      const y = encVal(v[key], depth + 1);
      if (y !== undefined) o[key] = y;
    }
    return o;
  }
  /** Only the fields that changed since the last update are sent (everything, the first time). */
  function encEnemy(e) {
    let c = sentCache.get(e);
    if (!c) { c = {}; sentCache.set(e, c); }
    let out = null;
    for (const key in e) {
      if (SKIP_KEYS.has(key)) continue;
      const v = e[key];
      if (v === undefined || typeof v === 'function') continue;
      const y = encVal(v, 0);
      if (y === undefined) continue;
      const tag = y !== null && typeof y === 'object' ? JSON.stringify(y) : y;
      if (c[key] !== tag) { c[key] = tag; (out || (out = {}))[key] = y; }
    }
    return out;
  }
  const waveProgress = () => (wave.boss || !wave.budget || wave.state !== 'active' ? -1 : r2(Math.min(1, wave.cleared / wave.budget)));
  function buildSnap() {
    const E = [];
    const live = new Set();
    for (const e of enemies) {
      if (e.dead) continue;
      if (!e.nid) e.nid = ++nidSeq;
      live.add(e.nid);
      const d = encEnemy(e);
      if (d) E.push([e.nid, d]);
    }
    const D = [];
    for (const id of net.sentE) if (!live.has(id)) D.push(id);
    net.sentE = live;
    const B = [];
    for (const b of ebullets) {
      if (b.dead) continue;
      if (!b.nid) {
        b.nid = ++nidSeq;
        b.svx = b.vx;
        b.svy = b.vy;
        B.push([b.nid, r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), EB_KINDS.indexOf(b.kind), r2(b.r), b.c.s, r1(b.g || 0), r2(b.spin || 0), b.big ? 1 : 0, r2(b.fuse || 0), r2(b.rot || 0), b.hp ? 1 : 0]);
      } else if (b.vx !== b.svx || b.vy !== b.svy) {
        b.svx = b.vx;
        b.svy = b.vy;
        B.push([b.nid, r1(b.x), r1(b.y), r1(b.vx), r1(b.vy)]);
      } else {
        B.push([b.nid, r1(b.x), r1(b.y)]);
      }
    }
    const K = [];
    for (const pk of pickups) {
      if (pk.dead) continue;
      if (!pk.nid) pk.nid = ++nidSeq;
      K.push([pk.nid, PK_KINDS.indexOf(pk.type), r1(pk.x), r1(pk.y)]);
    }
    const H = [];
    for (const h of hazards) if (!h.dead) H.push([h.kind, r1(h.x), r1(h.y), r1(h.r), r2(h.life), r2(h.max), r2(h.warn), r2(h.warnMax)]);
    const Pl = players.map((p) => [p.pid, r1(p.x), r1(p.y), r2(p.tilt), p.hp, p.maxHp, p.alive ? 1 : 0, r2(p.invuln), p.dashT > 0 ? 1 : 0, p.weapon, p.power, p.totem ? 1 : 0, r2(p.intro), p.fireOn ? 1 : 0,
      p.dashT > 0 ? MOVE_IDS.indexOf(p.dashKind) : -1, p.auraK ? MOVE_IDS.indexOf(p.auraK) : -1, r2(p.auraT || 0),
      p.pet ? r1(p.pet.x) : 0, p.pet ? r1(p.pet.y) : 0, p.pet ? PET_MODES.indexOf(p.pet.mode) + (p.pet.rage > 0 ? 8 : 0) : 0]);
    const bf = {};
    for (const key in buffs) if (buffs[key] > 0) bf[key] = r1(buffs[key]);
    const dh = buffs.drones > 0 ? droneHost() : null;
    const snap = {
      t: 'S', n: ++net.seq,
      g: [Math.floor(score), combo, r2(comboT), r1(nova), wave.n, waveProgress(), bossLevel, bg.zone, darkT > 0 && boss ? 1 : 0, r1(debuffs.fatigue), state === 'dying' ? 1 : 0, lastMult, r1(buffs.timewarp), r1(village.hp), village.max],
      V: run.game === 'raid' ? village.houses.map((h) => r2(h.burn)) : 0,
      bf, P: Pl, E, D, B, K, H,
      N: novaFx ? [r1(novaFx.x), r1(novaFx.y), r1(novaFx.r), r1(novaFx.max), novaFx.id] : 0,
      DR: dh ? [dh.pid, r1(drones[0].x), r1(drones[0].y), r1(drones[1].x), r1(drones[1].y)] : 0,
      X: net.out,
    };
    net.out = [];
    return snap;
  }
  function hostSend(raw) {
    net.snapT -= raw;
    if (net.snapT > 0) return;
    net.snapT = SNAP_INT;
    net.broadcast(buildSnap());
  }
  /** Messages from guests (host side) or from the host (guest side). */
  function netRecv(pid, m) {
    if (!net || !m) return;
    if (net.role === 'host') {
      const p = players.find((q) => q.pid === pid);
      if (!p || p.left) return;
      const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
      if (m.t === 'in') {
        p.in = {
          x: clamp(num(m.x, p.x), -50, view.w + 50), y: clamp(num(m.y, p.y), -view.h, view.h * 2),
          vx: clamp(num(m.vx, 0), -6000, 6000), vy: clamp(num(m.vy, 0), -6000, 6000),
          tilt: clamp(num(m.tl, 0), -1, 1), intro: clamp(num(m.i, 0), 0, 1),
        };
        p.fireOn = !!m.f && p.alive;
      } else if (m.t === 'dash') {
        // a guest used their movement ability: protect them and apply what it does here
        if (p.alive && p.dashT <= 0) {
          const id = moveOf(p).id; // always the move of their own skin
          const f = MOVE_FX[id] || MOVE_FX.dash;
          p.dashHit = new Set();
          if (f.aura) { p.auraK = id; p.auraT = f.aura; p.invuln = Math.max(p.invuln, f.aura); }
          else if (f.tele) p.invuln = Math.max(p.invuln, 0.35);
          else { p.dashKind = id; p.dashT = f.t; p.invuln = Math.max(p.invuln, f.t + 0.12); }
          moveEffects(p, id);
          stats.dashes += 1;
        }
      } else if (m.t === 'nova') {
        if (state === 'playing') useNova(p);
      }
      // when the host's tab is in the background its frames stop — keep the team's game going
      if (document.hidden) bgTick();
      return;
    }
    if (m.t === 'S') applySnap(m);
    else if (m.t === 'E') { for (const ev of Array.isArray(m.e) ? m.e : []) runNetEvent(ev); }
    else if (m.t === 'over') { if (state !== 'over' && state !== 'menu') gameOver(m.sum || runSummary()); }
  }
  function bgTick() {
    const t = performance.now();
    const dtr = (t - lastT) / 1000;
    if (dtr < 0.03) return;
    lastT = t;
    const dt = Math.min(dtr, 0.05);
    time += dt;
    update(dt, dt);
  }

  // ---- guests: apply the host's updates
  function applySnap(s) {
    if (!net || net.role !== 'guest' || state === 'menu' || state === 'over') return;
    const now = performance.now() / 1000;
    const g = s.g || [];
    score = g[0] || 0;
    combo = g[1] || 0;
    comboT = g[2] || 0;
    nova = g[3] || 0;
    wave.n = g[4] || 0;
    net.waveProg = g[5] === undefined ? -1 : g[5];
    bossLevel = g[6] || 0;
    if (g[7] !== undefined && g[7] !== bg.zone) setZone(g[7]);
    darkT = g[8] ? 1 : 0;
    debuffs.fatigue = g[9] || 0;
    lastMult = g[11] || 1;
    if (run.game === 'raid') {
      const was = village.hp;
      village.hp = g[13] || 0;
      village.max = g[14] || village.max;
      if (village.hp < was) village.hitT = 1.2;
      if (Array.isArray(s.V)) s.V.forEach((b, i) => { if (village.houses[i]) village.houses[i].burn = +b || 0; });
    }
    for (const key in buffs) buffs[key] = (s.bf && s.bf[key]) || 0;
    for (const r of s.P || []) {
      const p = players.find((q) => q.pid === r[0]);
      if (!p) continue;
      p.hp = r[4];
      p.maxHp = r[5];
      p.weapon = r[9];
      p.power = r[10];
      p.totem = !!r[11];
      if (p.pet && r.length > 19) {
        const pt = p.pet;
        pt.nx = r[17];
        pt.ny = r[18];
        const was = pt.mode;
        pt.mode = PET_MODES[r[19] & 7] || 'follow';
        pt.rage = r[19] & 8 ? 1 : 0;
        if (was === 'gone' && pt.mode !== 'gone') { pt.x = pt.nx; pt.y = pt.ny; }
      }
      if (p === me) {
        // our position is our own; hearts, weapon and invulnerability come from the host
        p.alive = !!r[6];
        p.invuln = Math.max(p.invuln, r[7]);
      } else {
        const was = p.alive;
        p.alive = !!r[6];
        p.nx = r[1];
        p.ny = r[2];
        p.tilt = r[3];
        p.invuln = r[7];
        p.dashT = r[8] ? Math.max(p.dashT, 0.05) : 0;
        p.intro = r[12];
        p.fireOn = !!r[13];
        p.dashKind = MOVE_IDS[r[14]] || '';
        p.auraK = MOVE_IDS[r[15]] || '';
        p.auraT = r[16] || 0;
        if (!was && p.alive) { p.x = p.nx; p.y = p.ny; }
      }
    }
    for (const [nid, f] of s.E || []) upsertEnemy(nid, f, now);
    for (const ev of s.X || []) runNetEvent(ev);
    for (const nid of s.D || []) {
      const e = netEnts.get(nid);
      if (e) { e.dead = true; netEnts.delete(nid); }
    }
    boss = null;
    for (const e of enemies) if (!e.dead && e.T && e.T.boss) boss = e;
    // enemy bullets keep flying on their own between updates
    const seenB = new Set();
    for (const r of s.B || []) {
      seenB.add(r[0]);
      let b = netBul.get(r[0]);
      if (!b) {
        if (r.length < 14) continue;
        b = {
          nid: r[0], x: r[1], y: r[2], vx: r[3], vy: r[4], kind: EB_KINDS[r[5]] || 'orb', r: r[6], c: colS(r[7]), g: r[8], spin: r[9],
          big: !!r[10], fuse: r[11], rot: r[12], hp: r[13] ? 1 : 0, t: 0, life: 99, home: 0, grazed: false, dead: false,
        };
        ebullets.push(b);
        netBul.set(r[0], b);
      } else {
        // the update is a moment old: nudge it ahead by the time it took to arrive
        const lead = 0.04 * ets;
        if (r.length >= 5) { b.vx = r[3]; b.vy = r[4]; }
        b.x = r[1] + b.vx * lead;
        b.y = r[2] + b.vy * lead;
      }
    }
    for (const [id, b] of netBul) if (!seenB.has(id)) { b.dead = true; netBul.delete(id); }
    const seenK = new Set();
    for (const r of s.K || []) {
      seenK.add(r[0]);
      let pk = netPk.get(r[0]);
      if (!pk) {
        pk = { nid: r[0], type: PK_KINDS[r[1]] || 'gem', x: r[2], y: r[3], tx: r[2], ty: r[3], t: 0, bob: 0, ph: rand(TAU), r: 18 * view.k, vx: 0, vy: 0, dead: false };
        pickups.push(pk);
        netPk.set(r[0], pk);
      } else {
        pk.tx = r[2];
        pk.ty = r[3];
      }
    }
    for (const [id, pk] of netPk) if (!seenK.has(id)) { pk.dead = true; netPk.delete(id); }
    hazards.length = 0;
    for (const h of s.H || []) hazards.push({ kind: h[0], x: h[1], y: h[2], r: h[3], life: h[4], max: h[5], warn: h[6], warnMax: h[7], t: time, dead: false });
    if (s.N) {
      if (!novaFx || novaFx.id !== s.N[4]) novaFx = { x: s.N[0], y: s.N[1], r: s.N[2], max: s.N[3], id: s.N[4], power: 1 };
    }
    if (s.DR) {
      droneOwner = players.find((p) => p.pid === s.DR[0]) || null;
      drones[0].x = s.DR[1]; drones[0].y = s.DR[2]; drones[1].x = s.DR[3]; drones[1].y = s.DR[4];
    }
  }
  function upsertEnemy(nid, f, now) {
    let e = netEnts.get(nid);
    if (!e) {
      e = { nid, dead: false, queue: [], beams: [], __l: {} };
      Object.assign(e, f);
      const def = f.kind && BK.ALL[f.kind];
      if (def) {
        if (!bossTypes[f.kind]) bossTypes[f.kind] = { img: def.img, w: def.w, h: def.h, hp: def.hp, score: def.score, pal: def.pal, glow: def.glow, boss: true, name: def.name };
        e.def = def;
        e.T = bossTypes[f.kind];
      } else {
        e.T = TYPES[f.type] || TYPES.zombie;
      }
      enemies.push(e);
      netEnts.set(nid, e);
      return;
    }
    for (const key in f) {
      const v = f[key];
      const cur = e[key];
      if (LERP_KEYS.has(key) && typeof v === 'number' && typeof cur === 'number' && !(key === 'rot' && Math.abs(v - cur) > 3)) {
        e.__l[key] = [cur, v, now];
      } else {
        e[key] = v;
        delete e.__l[key];
      }
    }
  }
  function netLerp() {
    const now = performance.now() / 1000;
    for (const e of enemies) {
      const L = e.__l;
      if (!L) continue;
      for (const key in L) {
        const q = L[key];
        const a = Math.min(1, (now - q[2]) / SNAP_INT);
        e[key] = q[0] + (q[1] - q[0]) * a;
        if (a >= 1) delete L[key];
      }
    }
  }
  function runNetEvent(ev) {
    if (!Array.isArray(ev)) return;
    const a = ev;
    switch (a[0]) {
      case 'x': explodeFx(a[1], a[2], (a[3] || []).map(colS), a[4], colS(a[5])); break;
      case 'b': burst(a[1], a[2], colS(a[3]), a[4], a[5]); break;
      case 'p': popup(a[1], a[2], String(a[3]), a[4], a[5], a[6]); break;
      case 'k': trauma = Math.min(1, trauma + (+a[1] || 0)); break;
      case 'w': slowT = Math.max(slowT, +a[1] || 0); slowScale = +a[2] || 1; break;
      case 'r': P(a[1], a[2], 0, 0, a[3], a[4], colS(a[5]), RING); break;
      case 's': Sfx.play(a[1], a[2] === null ? undefined : a[2]); break;
      case 'm': Sfx.music(a[1]); break;
      case 'B': UI.banner(a[1], a[2], a[3], a[4]); break;
      case 'T': UI.toast(String(a[1])); break;
      case 'F': UI.flash(a[1]); break;
      case 'BB': UI.bossBar(!!a[1], a[2], a[3]); break;
      case 'L': UI.letterbox(!!a[1]); break;
      case 'l': bolt(a[1], a[2], a[3], a[4]); break;
      case 'h': { const t = netEnts.get(a[1]); if (t) shatter(t); break; }
      case 'hf': addHeartFx(a[1], a[2]); break;
      case 'U': { const p = players.find((q) => q.pid === a[1]); if (p) castUlt(p, a[2], a[3]); break; }
      case 'pe': {
        // pet effects: the frog's tongue, the axolotl's bubble
        const p = players.find((q) => q.pid === a[1]);
        if (!p) break;
        if (a[2] === 'tongue' && p.pet) p.pet.tongue = { x: +a[3] || 0, y: +a[4] || 0, t: 0.2 };
        else if (a[2] === 'bubble') p.bubbleT = +a[3] || 0;
        break;
      }
      case 'pd': onDown(a[1]); break;
      case 'pr': onBack(a[1]); break;
      case 'pl': dropPlayer(a[1]); break;
      // just for this player
      case 'hurt': hitFeedback(); break;
      case 'kn': if (me && me.alive) { me.knockT = 0.3; me.kvx = +a[1] || 0; me.kvy = +a[2] || 0; Input.vibrate(40); } break;
      case 'dr': if (me && me.alive) { me.dragT = Math.max(me.dragT || 0, +a[1] || 0); me.dragX = +a[2] || 0; me.dragY = +a[3] || 0; me.dragF = +a[4] || 0; } break;
      case 'sl': if (me && me.alive) { if (!(me.slowT > 0)) popup(me.x, me.y - me.h, 'SLOWED!', '#a9c0ff', 10, 0.9); me.slowT = Math.max(me.slowT || 0, +a[1] || 0); } break;
      default: break;
    }
  }
  function sendInput() {
    const p = me;
    net.send({ t: 'in', x: r1(p.x), y: r1(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), tl: r2(p.tilt), f: p.alive && p.fireOn ? 1 : 0, i: r2(p.intro) });
  }
  function guestUpdate(dt, raw, edt, playing) {
    if (playing) {
      runTime += dt;
      if (Input.consume('dash')) { const f = Input.takeFlick(); tryDash(f ? f.x : null, f ? f.y : null); }
      if (Input.consume('nova')) useNova(me);
      for (const p of players) { player = p; updateShip(p, dt); moveTick(p, dt); ultTick(p, dt); }
      player = me;
      if (buffs.timewarp > 0) { tickT -= dt; if (tickT <= 0) { tickT = 0.5; Sfx.play('tick'); } }
      if (me && me.alive && me.hp === 1) { hbT -= dt; if (hbT <= 0) { hbT = 0.95; Sfx.play('heartbeat'); } }
      net.inT -= raw;
      if (net.inT <= 0 && me) { net.inT = INPUT_INT; sendInput(); }
      for (const key in buffs) if (buffs[key] > 0) buffs[key] = Math.max(0, buffs[key] - dt);
    }
    netLerp();
    petsNet(dt);
    updateVillage(dt);
    const k = view.k;
    for (const e of enemies) if (e.flash > 0) e.flash -= dt;
    for (const b of ebullets) {
      b.t += edt;
      if (b.g) b.vy += b.g * edt;
      b.x += b.vx * edt;
      b.y += b.vy * edt;
      if (b.spin) b.rot += b.spin * edt;
    }
    for (const pk of pickups) {
      pk.t += dt;
      pk.bob = Math.sin(pk.t * 4 + pk.ph) * 4 * k;
      pk.x = damp(pk.x, pk.tx, 16, dt);
      pk.y = damp(pk.y, pk.ty, 16, dt);
    }
    for (const h of hazards) { if (h.warn > 0) h.warn -= edt; else h.life = Math.max(0.01, h.life - edt); }
    updateBullets(dt);
    updateNova(dt);
    updateGhosts(dt);
    updateBolts(dt);
    updateParticles(dt);
    updatePopups(dt);
    updateHeartFx(dt);
    compact(bullets);
    compact(enemies);
    compact(ebullets);
    compact(pickups);
  }

  // ---- going down, coming back, leaving
  const shipName = (p) => (p.name || `P${p.pid}`).toUpperCase();
  function teammateDown(p) {
    explode(p.x, p.y, PAL.player, 2.2, C.cyan);
    P(p.x, p.y, 0, 0, 0.9, 260 * view.k, C.cyan, RING);
    sfx('bigExplode');
    popup(p.x, p.y - p.h, `${shipName(p)} IS DOWN!`, '#ff4d5e', 12, 1.8);
    fwd('pd', p.pid);
    onDown(p.pid);
    if (!players.some((q) => q.alive)) {
      // the whole team is down
      state = 'dying';
      dieT = 0;
      music(null);
      slowmo(1.4, 0.25);
      U.flash('white');
    }
  }
  /** Runs on every device when a ship goes down. */
  function onDown(pid) {
    const p = players.find((q) => q.pid === pid);
    if (p) { p.alive = false; p.fireOn = false; }
    if (me && pid === me.pid) {
      Input.vibrate([120, 60, 240]);
      UI.flash('white');
      Input.reset();
      const others = players.some((q) => q !== me && q.alive);
      specPid = others ? (players.find((q) => q !== me && q.alive) || {}).pid || 0 : 0;
      if (others) UI.netDown({ respawn: run.mode === 'classic' });
    } else if (specPid === pid) {
      spectate(1);
    }
  }
  /** Arcade co-op: fallen players warp back in at the start of the next wave. */
  function respawnDown() {
    for (const p of players) {
      if (p.alive || p.left) continue;
      p.alive = true;
      p.hp = p.maxHp;
      p.invuln = 3;
      p.intro = 1;
      p.dashT = 0;
      p.knockT = 0;
      p.x = p.homeX;
      p.y = view.h + p.h;
      if (p !== me) { p.in = { x: p.x, y: p.y, vx: 0, vy: 0, tilt: 0, intro: 1 }; p.nx = p.x; p.ny = p.y; }
      popup(p.homeX, view.h * 0.7, `${shipName(p)} IS BACK!`, '#56f08b', 12, 1.8);
      fwd('pr', p.pid);
      onBack(p.pid);
    }
  }
  function onBack(pid) {
    const p = players.find((q) => q.pid === pid);
    if (!p) return;
    p.alive = true;
    if (p === me) {
      p.intro = 1;
      p.x = p.homeX;
      p.y = view.h + p.h;
      p.invuln = 3;
      p.vx = p.vy = 0;
      Input.reset();
      specPid = 0;
      UI.netBack();
    }
  }
  /** A player left the room (or lost connection). */
  function dropPlayer(pid) {
    const i = players.findIndex((q) => q.pid === pid);
    if (i < 0) return;
    const p = players[i];
    p.left = true;
    p.alive = false;
    players.splice(i, 1);
    if (specPid === pid) spectate(1);
    if (net && net.role === 'host') {
      fwd('pl', pid);
      if ((state === 'playing') && !players.some((q) => q.alive)) {
        state = 'dying';
        dieT = 0;
        music(null);
      }
    }
  }
  /** The ship the camera cares about: yours, or the teammate you're watching after going down. */
  function viewTarget() {
    if (me && me.alive) return me;
    return players.find((p) => p.pid === specPid && p.alive) || me;
  }
  function spectate(dir) {
    const alive = players.filter((p) => p.alive && p !== me);
    if (!alive.length) { specPid = 0; return ''; }
    let i = alive.findIndex((p) => p.pid === specPid);
    i = i < 0 ? 0 : (i + dir + alive.length) % alive.length;
    specPid = alive[i].pid;
    return shipName(alive[i]);
  }

  // ================================================================ loop
  function handleActions() {
    if (Input.consume('pause')) {
      if (state === 'playing') { if (net && netMenu) resume(); else pause(); }
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
    if (!(net && net.role === 'guest')) darkT = Math.max(0, darkT - edt);
    dark = damp(dark, darkT > 0 && boss ? 1 : 0, 3, dt);
    if (net && net.role === 'guest') { guestUpdate(dt, raw, edt, playing); return; }
    if (playing) {
      runTime += dt;
      for (const key in buffs) if (buffs[key] > 0) buffs[key] = Math.max(0, buffs[key] - dt);
      if (debuffs.fatigue > 0) debuffs.fatigue = Math.max(0, debuffs.fatigue - dt);
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) resetCombo(); }
      if (Input.consume('dash')) { const f = Input.takeFlick(); tryDash(f ? f.x : null, f ? f.y : null); }
      if (Input.consume('nova')) useNova(me);
      for (const p of players) { player = p; updateShip(p, dt); moveTick(p, dt); ultTick(p, dt); }
      player = me;
      updateWave(edt);
      updateStorm(dt);
      updateDrones(dt);
      updatePets(dt);
      updateVillage(dt);
      updateFires(dt);
      if (buffs.timewarp > 0) { tickT -= dt; if (tickT <= 0) { tickT = 0.5; Sfx.play('tick'); } }
      if (me && me.alive && me.hp === 1) { hbT -= dt; if (hbT <= 0) { hbT = 0.95; Sfx.play('heartbeat'); } }
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
    updateHeartFx(dt);
    compact(bullets);
    for (const e of enemies) if (e.dead && e.wb) { e.wb = false; wave.cleared += 1; }
    compact(enemies);
    compact(ebullets);
    compact(pickups);
    if (state === 'dying') {
      dieT += raw;
      if (dieT > 2.2) gameOver();
    }
    if (net && net.role === 'host' && (state === 'playing' || state === 'dying')) hostSend(raw);
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
    if (state !== 'menu') drawVillage();
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
    // some bosses glow through the dark (Herobrine's eyes)
    if (boss && boss.def.overDark && boss.mode !== 'dying') { ctx.globalCompositeOperation = 'lighter'; boss.def.overDark(boss); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    drawBullets();
    drawBloodMoon();
    drawPlayers();
    drawEBullets();
    drawBolts();
    drawParticles();
    drawNova();
    drawPopups();
    drawFrame();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  /** Co-op on a differently shaped screen: dim the space outside the shared world and outline it. */
  function drawFrame() {
    if (!fixedWorld || (view.ox < 1 && view.oy < 1)) return;
    const d = view.dpr;
    const x = view.ox;
    const y = view.oy;
    const w = view.w * view.z;
    const h = view.h * view.z;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2,3,10,.82)';
    if (x >= 1) { ctx.fillRect(0, 0, x, view.sh); ctx.fillRect(x + w, 0, view.sw - x - w, view.sh); }
    if (y >= 1) { ctx.fillRect(x, 0, w, y); ctx.fillRect(x, y + h, w, view.sh - y - h); }
    ctx.strokeStyle = 'rgba(128,180,255,.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 0.75, y - 0.75, w + 1.5, h + 1.5);
  }
  function fillHud() {
    hud.score = score;
    hud.combo = combo;
    hud.mult = comboMult();
    hud.comboT = comboT / COMBO_TIME;
    // after going down in co-op the hearts show the teammate you're watching
    const vp = viewTarget();
    if (vp) {
      hud.hp = vp.hp;
      hud.maxHp = vp.maxHp;
      hud.weapon = vp.weapon;
      hud.power = vp.power;
      hud.dash = me && me.dashCd > 0 ? 1 - me.dashCd / moveOf(me).cd : 1;
      hud.alive = vp.alive;
      hud.totem = vp.totem;
    }
    hud.mp = !!net;
    hud.game = run.game;
    hud.village = run.game === 'raid' && village.max ? Math.max(0, village.hp) / village.max : -1;
    hud.villageHp = Math.ceil(village.hp);
    // your own skin's abilities (for the two buttons in the corner)
    hud.skin = me ? me.skin : skin.id;
    hud.spectating = net && me && !me.alive && vp && vp !== me ? shipName(vp) : '';
    hud.nova = nova;
    hud.wave = wave.n;
    hud.waveProg = net && net.role === 'guest' ? net.waveProg : waveProgress();
    hud.boss = boss ? Math.max(0, boss.hp / boss.maxHp) : -1;
    hud.bossPhase = boss ? boss.phase : 1;
    hud.bossArmor = !!(boss && boss.armor);
    hud.bossShield = boss && boss.shieldMax ? Math.max(0, boss.shield / boss.shieldMax) : 0;
    hud.bossHp = boss ? Math.max(0, Math.ceil(boss.hp)) : 0;
    hud.bossMaxHp = boss ? boss.maxHp : 0;
    hud.bossStatus = !boss ? '' : boss.mode === 'enter' ? 'INCOMING' : boss.stun > 0 ? 'STUNNED · x1.5 DMG' : boss.lastStand && boss.inv ? 'LAST STAND' : boss.shield > 0 ? 'SHIELDED' : boss.berserk ? 'BERSERK' : boss.armor ? 'ARMORED' : '';
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

    for (let i = 0; i < simSpeed; i++) update(dt, raw);
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
    eShoot, ring, fan, spiral, makeBeam, spawnEnemy, countType, bulletSpeed, bossF, aimAt, leadAim, hurtPlayer, knockPlayer, addHazard,
    dragPlayer: dragShip,
    tier: bossTier,
    hard: () => diffKey === 'hard',
    heavy: heavyDmg,
    setDark: (t) => { darkT = Math.max(darkT, t); },
    isDark: () => darkT > 0,
    setFatigue: (t) => { debuffs.fatigue = Math.max(debuffs.fatigue, t); },
    glow, blit, sprite, at, world, drawTentacles,
    // relayed to every player in co-op
    sfx, banner: U.banner, flash: U.flash,
    /** Run fn for every ship still flying (with `player` pointing at it), e.g. for lasers that hit anyone. */
    eachPlayer(fn) {
      const keep = player;
      for (const p of players) { if (!p.alive) continue; player = p; fn(p); }
      player = keep;
    },
  };

  // ================================================================ public API
  return {
    load,
    init() {
      BK = BossKit(api);
      applySkin();
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', () => setTimeout(resize, 150));
      Settings.onChange((key) => {
        if (key === 'quality') resize();
        if (key === 'skin') applySkin();
      });
      Input.init(canvas, {
        player: () => me || { x: view.w / 2, y: view.h * 0.8 },
        bounds,
        playing: () => state === 'playing' && !netMenu,
        // screen pixels → world units (they differ when a co-op world is scaled to fit)
        toWorld: (x, y) => ({ x: (x - view.ox) / view.z, y: (y - view.oy) / view.z }),
        zoom: () => view.z,
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
    nova() { if (state === 'playing') useNova(me); },
    get state() { return state; },
    // ---- co-op (see net.js and the lobby in ui.js)
    startNet,
    netRecv,
    netWorld,
    /** A player left the room mid-run. */
    netLeft(pid) { dropPlayer(pid); },
    /** Watch the next/previous teammate after going down; returns their name. */
    spectate(dir = 1) { return spectate(dir); },
    get net() { return net ? { role: net.role } : null; },
    get me() { return me ? { pid: me.pid, alive: me.alive } : null; },
    /** The current (or last) run: { game: 'arcade' | 'bossrush' | 'raid', mode: 'classic' | 'hardcore', tier }. */
    get run() { return { game: run.game, mode: run.mode, tier: run.tier }; },
    BUFF_MAX,
    /** Boss list for the How-to-play screen. */
    bossList(game) {
      if (!BK) return [];
      const list = gameOrder(game).map((kind, i) => ({ kind, wave: (i + 1) * 5, ...BK.ALL[kind] }));
      // the secret boss stays a mystery until you have beaten it
      for (const kind of Object.keys(BK.ALL)) if (BK.ALL[kind].secret) list.push({ kind, ...BK.ALL[kind], found: Trophies.has(kind) });
      return list;
    },
    // handy for testing from the console, e.g. Game.debug.boss(4) to fight the Ender Dragon
    debug: {
      god(on = true) { godMode = on; },
      speed(n = 1) { simSpeed = clamp(Math.round(n), 1, 8); },
      autopilot(on = true) { autoPilot = on; },
      power(v) { if (player) player.power = v; },
      wave(n) {
        for (const e of enemies) e.dead = true;
        boss = null;
        darkT = 0;
        hazards.length = 0;
        U.bossBar(false);
        U.letterbox(false);
        wave.n = n - 1;
        wave.state = 'clear';
        wave.breakT = 0.1;
      },
      boss(level) { bossLevel = level - 1; this.wave(5 * level); },
      /** The secret: show the face at the edge of the screen now / skip straight to the secret fight. */
      sighting() { spawnSighting(); },
      herobrine() { const e = spawnEnemy('sighting', view.w / 2, view.h * 0.2, { noElite: true }); killEnemy(e, 'bullet'); },
      spawn(type, x, y) { return !!spawnEnemy(type, x === undefined ? view.w / 2 : x, y === undefined ? view.h * 0.2 : y); },
      pickup(type, x, y) { if (player) spawnPickup(type, x === undefined ? player.x : x, y === undefined ? player.y - 120 * view.k : y, 0, 0); },
      weapon(n) { if (player) player.weapon = clamp(n, 1, 5); },
      nova() { nova = 100; },
      buff(name) { buffs[name] = BUFF_MAX[name]; if (name === 'drones') resetDrones(); },
      hurt() { if (player) { player.invuln = 0; hurtPlayer(); } },
      bossHp(frac) { if (boss) { boss.hp = boss.maxHp * frac; boss.shield = 0; } },
      breakShield() { if (boss && boss.shield > 0) breakShield(boss); },
      /** Testing: defeat the boss right now (death sequence + rewards as usual). */
      killBoss() { if (boss && boss.mode === 'fight') { boss.shield = 0; boss.hp = 0; boss.inv = false; killEnemy(boss, 'bullet'); } },
      attack(name) { if (boss && boss.mode === 'fight') { boss.atk = 99; boss.def.attack(boss, name); } },
      die() { if (player && player.alive) { godMode = false; buffs.shield = 0; player.totem = false; player.hp = 1; player.invuln = 0; player.dashT = 0; hurtPlayer(); } },
      // co-op testing (host): every ship, and hurting / downing one of them
      players() { return players.map((p) => ({ pid: p.pid, name: p.name, skin: p.skin, hp: p.hp, maxHp: p.maxHp, alive: p.alive, x: Math.round(p.x), y: Math.round(p.y), intro: +p.intro.toFixed(2), me: p === me })); },
      hurtPid(pid) { const p = players.find((q) => q.pid === pid); if (p) { buffs.shield = 0; p.invuln = 0; p.dashT = 0; p.intro = 0; hurtPlayer(1, p); } },
      killPid(pid) { const p = players.find((q) => q.pid === pid); if (p && p.alive) { buffs.shield = 0; p.totem = false; p.hp = 1; p.invuln = 0; p.dashT = 0; p.intro = 0; hurtPlayer(1, p); } },
      world() { return { w: view.w, h: view.h, z: +view.z.toFixed(3), ox: Math.round(view.ox), oy: Math.round(view.oy), fixed: !!fixedWorld }; },
      // ability testing: a ring of enemy bullets around you, and what your abilities are doing
      spawnBullets(n = 12, r = 90) { if (!me) return; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; eShoot(me.x + Math.cos(a) * r * view.k, me.y + Math.sin(a) * r * view.k, 0, 0, 'orb'); } },
      abilities() {
        return me && {
          skin: me.skin, move: moveOf(me).id, ult: ultOf(me).id, dashCd: +me.dashCd.toFixed(2), dashT: +me.dashT.toFixed(2), auraK: me.auraK || '', invuln: +me.invuln.toFixed(2),
          ultFx: me.ultFx ? me.ultFx.k : '', x: Math.round(me.x), y: Math.round(me.y), hp: me.hp, kills: stats.kills, fires: fires.length,
          shots: bullets.filter((b) => b.src === 'ult').length, magnet: +buffs.magnet.toFixed(1), shield: +buffs.shield.toFixed(1), drones: +buffs.drones.toFixed(1), timewarp: +buffs.timewarp.toFixed(1), nova, dark: darkT,
        };
      },
      player() { return player && { x: player.x, y: player.y, hp: player.hp, maxHp: player.maxHp, weapon: player.weapon, power: player.power, alive: player.alive, totem: player.totem, bubbleT: +(player.bubbleT || 0).toFixed(2), slowT: +(player.slowT || 0).toFixed(2), knockT: +(player.knockT || 0).toFixed(2), dragT: +(player.dragT || 0).toFixed(2) }; },
      /** Every mob on screen (type, position, health, mode). */
      enemies() { return enemies.filter((e) => !e.dead).map((e) => ({ type: e.type, x: Math.round(e.x), y: Math.round(e.y), bx: Math.round(e.bx || 0), hp: +e.hp.toFixed(1), mode: e.mode, poison: +(e.poisonT || 0).toFixed(1) })); },
      /** Every ship's pet (co-op testing). */
      pets() { return players.map((p) => ({ pid: p.pid, pet: p.pet ? p.pet.id : 'none', mode: p.pet ? p.pet.mode : '', x: p.pet ? Math.round(p.pet.x) : 0, y: p.pet ? Math.round(p.pet.y) : 0, sx: Math.round(p.x), sy: Math.round(p.y) })); },
      /** Debug: set the pet's ability timers (e.g. { gift: 0 }) to trigger them now. */
      petTimers(o) { if (me && me.pet) Object.assign(me.pet, o); },
      /** Your pet: what it is doing and what it has done. */
      pet() {
        const p = me;
        if (!p || !p.pet) return null;
        const pt = p.pet;
        return {
          id: pt.id, mode: pt.mode, dist: Math.round(Math.hypot(pt.x - p.x, pt.y - p.y)), rage: +pt.rage.toFixed(1), gift: +pt.gift.toFixed(1), regen: +pt.regen.toFixed(1), bubble: pt.bubble, acts: pt.acts || 0,
          kills: stats.kills, petKills: stats.petKills || 0, eaten: pt.eaten || 0, gifts: pt.gifts || 0, fetched: pt.fetched || 0, poisoned: enemies.filter((e) => e.poisonT > 0).length,
        };
      },
      info() {
        return {
          state, botHits, run: { ...run }, diff: diffKey, pickups: pickups.map((q) => q.type), enemies: enemies.length, bullets: bullets.length, ebullets: ebullets.length, hazards: hazards.length, parts: parts.length, wave: wave.n, hpMul: wave.hpMul, score, fps, nova,
          dashes: stats && stats.dashes, novas: stats && stats.novas, bossLevel, boss: boss && { kind: boss.kind, mode: boss.mode, phase: boss.phase, hp: Math.round(boss.hp), maxHp: boss.maxHp, mark: boss.mark, title: boss.title, shield: Math.round(boss.shield), stun: +boss.stun.toFixed(2), lastStand: boss.lastStand, berserk: boss.berserk, fightT: Math.round(boss.fightT), grow: +boss.grow.toFixed(3), level: boss.level },
          types: [...new Set(enemies.map((e) => e.type))],
          ebKinds: [...new Set(ebullets.map((b) => b.kind))],
          hazardKinds: [...new Set(hazards.map((h) => h.kind))],
        };
      },
    },
  };
})();
