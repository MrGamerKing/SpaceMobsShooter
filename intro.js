/* =========================================================================
   Game logo (drawn in code) + the startup intro:
   VarexGames → Made in Pakistan → title screen → "press any key" → menu
   ========================================================================= */

// ---------------------------------------------------------------- logo
// Chunky 3D pixel letters in the style of a block-game title. Painted once to a
// canvas and reused as an image for the title screen and the main menu.
const Logo = (() => {
  const GLYPHS = {
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    '@': ['ggggg', 'ggggg', 'ddgdd', 'ggdgg', 'gdddg', 'gdgdg', 'ggggg'], // creeper face
  };
  // face gradients (top → bottom) and extrusion colours
  const PAL = {
    cyan: { face: [[200, 253, 255], [80, 220, 255], [47, 123, 255], [74, 54, 201]], ext: [[40, 34, 120], [14, 12, 52]] },
    fire: { face: [[255, 246, 176], [255, 201, 60], [255, 122, 31], [216, 37, 59]], ext: [[110, 20, 34], [44, 7, 16]] },
    creeper: { face: [[150, 240, 140], [96, 200, 90], [62, 160, 62], [40, 120, 44]], ext: [[20, 70, 26], [8, 30, 12]] },
    dark: { face: [[22, 44, 24], [16, 34, 18]], ext: [[20, 70, 26], [8, 30, 12]] },
  };
  const LINES = [
    { text: 'SPACE M@BS', cell: 16, pal: 'cyan' },
    { text: 'SHOOTER', cell: 22, pal: 'fire' },
  ];
  const PAD = 26;
  const GAP = 16;
  const SCALE = 2;

  // tiny seeded random so the texture is the same every launch
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const ramp = (stops, t) => {
    const f = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(f));
    return mix(stops[i], stops[i + 1], f - i);
  };
  const css = (c, m = 1) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v * m)))).join(',')})`;

  function layout(line) {
    const cells = [];
    let gx = 0;
    for (const ch of line.text) {
      if (ch === ' ') { gx += 3; continue; }
      const g = GLYPHS[ch];
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 5; x++) {
          const k = g[y][x];
          if (k !== '.') cells.push({ x: gx + x, y, pal: k === 'g' ? 'creeper' : k === 'd' ? 'dark' : line.pal });
        }
      }
      gx += 6;
    }
    return { cells, width: (gx - 1) * line.cell, height: 7 * line.cell, depth: Math.round(line.cell * 0.5) };
  }

  function paintLine(line, L) {
    const c = line.cell;
    const o = 3;
    const cv = document.createElement('canvas');
    cv.width = (L.width + o * 2 + L.depth) * SCALE;
    cv.height = (L.height + o * 2 + L.depth) * SCALE;
    const g = cv.getContext('2d');
    g.scale(SCALE, SCALE);
    g.translate(o, o);
    const has = new Set(L.cells.map((q) => q.x + ',' + q.y));
    const at = (x, y) => has.has(x + ',' + y);

    // outline around the whole extruded shape
    g.fillStyle = '#05060f';
    for (let i = 0; i <= L.depth; i++) {
      for (const q of L.cells) g.fillRect(q.x * c - o + i * 0.3, q.y * c - o + i, c + o * 2, c + o * 2);
    }
    // extrusion, darkest at the back
    for (let i = L.depth; i >= 1; i--) {
      for (const q of L.cells) {
        const e = PAL[q.pal].ext;
        g.fillStyle = css(mix(e[0], e[1], i / L.depth));
        g.fillRect(q.x * c + i * 0.3, q.y * c + i, c + 0.5, c + 0.5);
      }
    }
    // textured faces on their own layer so the gloss only touches them
    const fc = document.createElement('canvas');
    fc.width = cv.width;
    fc.height = cv.height;
    const f = fc.getContext('2d');
    f.scale(SCALE, SCALE);
    f.translate(o, o);
    const sub = c / 4;
    for (const q of L.cells) {
      const stops = PAL[q.pal].face;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          let m = 1 + (rnd() - 0.5) * 0.16;
          if (sy === 0 && !at(q.x, q.y - 1)) m *= 1.28;
          if (sy === 3 && !at(q.x, q.y + 1)) m *= 0.78;
          if (sx === 0 && !at(q.x - 1, q.y)) m *= 1.1;
          if (sx === 3 && !at(q.x + 1, q.y)) m *= 0.88;
          f.fillStyle = css(ramp(stops, (q.y * 4 + sy + 0.5) / 28), m);
          f.fillRect(q.x * c + sx * sub, q.y * c + sy * sub, sub + 0.35, sub + 0.35);
        }
      }
    }
    f.globalCompositeOperation = 'source-atop';
    const gl = f.createLinearGradient(0, 0, 0, L.height);
    gl.addColorStop(0, 'rgba(255,255,255,0.32)');
    gl.addColorStop(0.46, 'rgba(255,255,255,0.08)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0)');
    gl.addColorStop(1, 'rgba(0,0,0,0.18)');
    f.fillStyle = gl;
    f.fillRect(-o, -o, L.width + o * 2, L.height + o * 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(fc, 0, 0);
    return cv;
  }

  let url = null;
  function paint() {
    seed = 7;
    const lays = LINES.map(layout);
    const W = Math.max(...lays.map((L) => L.width + L.depth)) + PAD * 2;
    const H = lays.reduce((s, L) => s + L.height + L.depth, 0) + GAP * (LINES.length - 1) + PAD * 2;
    const cv = document.createElement('canvas');
    cv.width = W * SCALE;
    cv.height = H * SCALE;
    const g = cv.getContext('2d');
    let y = PAD;
    LINES.forEach((line, i) => {
      const L = lays[i];
      const img = paintLine(line, L);
      g.drawImage(img, Math.round(((W - L.width) / 2 - 3) * SCALE), Math.round((y - 3) * SCALE));
      y += L.height + L.depth + GAP;
    });
    return cv;
  }

  function getUrl() {
    if (!url) {
      try { url = paint().toDataURL('image/png'); } catch (_) { url = 'logo.png'; }
    }
    return url;
  }
  return {
    /** PNG data URL of the logo (painted on first use). */
    url: getUrl,
    /** Puts the logo into an <img>, and uses its shape as the mask for a shine overlay. */
    mount(img, shine) {
      const u = getUrl();
      img.src = u;
      if (shine) {
        shine.style.webkitMaskImage = `url("${u}")`;
        shine.style.maskImage = `url("${u}")`;
      }
    },
  };
})();

// ---------------------------------------------------------------- intro
const Intro = (() => {
  const $ = (id) => document.getElementById(id);
  const root = $('intro');
  const stages = { brand: $('introBrand'), pk: $('introPk'), title: $('introTitle') };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let active = false;
  let poke = null;       // called on any key / tap / gamepad button
  let guardUntil = 0;    // swallow keys for a moment after continuing (held Enter must not start a run)

  // "Made in Pakistan" letters animate one by one
  let i = 0;
  document.querySelectorAll('[data-split]').forEach((el) => {
    el.innerHTML = el.textContent.split('').map((ch) => (ch === ' ' ? ' ' : `<span class="ch" style="--i:${i++}">${ch}</span>`)).join('');
  });

  function onInput(e) {
    if (!active && performance.now() > guardUntil) return;
    if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
    if (e.type === 'keydown' && e.key === 'F11') return;
    e.preventDefault();
    e.stopPropagation();
    if (!active) return;
    Sfx.unlock();
    if (poke && !(e.type === 'keydown' && e.repeat)) poke();
  }
  ['keydown', 'pointerdown'].forEach((t) => window.addEventListener(t, onInput, true));

  /** Waits `ms`, or until the player presses something (after `min` ms). */
  function waitSkip(ms, min = 400) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const done = () => { clearTimeout(timer); poke = null; resolve(); };
      const timer = setTimeout(done, ms);
      poke = () => { if (performance.now() - t0 >= min) done(); };
    });
  }
  function waitPress() {
    return new Promise((resolve) => { poke = () => { poke = null; resolve(); }; });
  }

  async function splash(el, hold, sound) {
    el.classList.add('show');
    Sfx.play(sound);
    await waitSkip(hold);
    el.classList.add('out');
    await wait(750);
    el.classList.remove('show', 'out');
  }

  async function run(ready, opts = {}) {
    let loaded = false;
    ready.then(() => { loaded = true; });
    if (opts.skip) {
      await ready;
      root.classList.add('gone');
      return;
    }
    active = true;
    // the desktop app may play sound straight away; browsers wait for the first tap/key
    const act = navigator.userActivation;
    if (/Electron/i.test(navigator.userAgent) || (act && act.hasBeenActive)) Sfx.unlock();

    await wait(350);
    await splash(stages.brand, 3300, 'brand');
    await wait(200);
    await splash(stages.pk, 2700, 'pk');

    // title: the live game background shows through
    const title = stages.title;
    Logo.mount($('titleLogo'), $('titleShine'));
    if (!loaded) root.classList.add('loading');
    title.classList.add('show');
    Sfx.play('title');
    Sfx.music('menu');
    await Promise.all([ready, wait(700)]);
    root.classList.remove('loading');
    root.classList.add('see-through');
    await wait(500);
    title.classList.add('ready');
    await waitPress();

    // classic "press start" flicker, then into the menu
    Sfx.unlock();
    Sfx.music('menu');
    Sfx.play('start');
    guardUntil = performance.now() + 900;
    active = false;
    title.classList.add('leaving');
    await wait(420);
    root.classList.add('done');
    await wait(300);
    setTimeout(() => root.classList.add('gone'), 700);
  }

  return {
    run,
    progress(p) { $('introFill').style.width = Math.round(p * 100) + '%'; },
    get active() { return active; },
    /** Gamepad buttons come in through the UI's menu navigation. */
    poke() { if (active && poke) poke(); },
  };
})();
