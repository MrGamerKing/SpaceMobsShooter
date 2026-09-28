/* =========================================================================
   Settings + local leaderboard (persisted in localStorage)
   ========================================================================= */
const Settings = (() => {
  const KEY = 'sms.settings.v2';
  const isTouch = window.matchMedia('(pointer: coarse)').matches
    || ('ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches);

  const defaults = {
    music: 0.55,
    sfx: 0.8,
    autoFire: true,
    shake: true,
    quality: 'high',       // 'high' | 'low'
    touchScheme: 'drag',   // 'drag' | 'joystick'
    sensitivity: 1.25,
    vibration: true,
    showFps: false,
    difficulty: 'normal',  // 'easy' | 'normal' | 'hard'
    hearts: 5,             // starting hearts, 1-10
    lefty: false,          // mirror touch buttons + joystick for left-handed play
    skin: 'phantom',       // player skin id (see skins.js)
  };

  const data = { ...defaults };
  try { Object.assign(data, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage blocked */ }

  const listeners = [];

  return {
    isTouch,
    get(k) { return data[k]; },
    set(k, v) {
      if (data[k] === v) return;
      data[k] = v;
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
      listeners.forEach((fn) => fn(k, v));
    },
    onChange(fn) { listeners.push(fn); },
  };
})();

/* Hardcore challenges: always Hard, no checkpoints, never more hearts than you start with.
   bonus = score multiplier · totemHearts = hearts a Totem of Undying revives you with */
const HARDCORE_TIERS = [
  {
    id: 'extreme', name: 'EXTREME', hearts: 5, bonus: 1.25, totemHearts: 3, heartDrops: true,
    desc: 'Start with 5 hearts. Heart pickups can heal you back up to 5, but never past it. A Totem of Undying revives you with 3 hearts.',
  },
  {
    id: 'insane', name: 'INSANE', hearts: 3, bonus: 1.5, totemHearts: 3, heartDrops: true,
    desc: 'Only 3 hearts. Heart pickups heal you up to 3 and no further. A Totem of Undying revives you with 3 hearts.',
  },
  {
    id: 'brutal', name: 'BRUTAL', hearts: 1, bonus: 2, totemHearts: 1, heartDrops: false,
    desc: 'One heart: a single hit ends your run. Hearts never drop. Only a Totem of Undying can save you, and it revives you with just 1 heart.',
  },
];

/* Arcade checkpoint: saved after every boss so a run can be continued later. */
const Checkpoint = (() => {
  const KEY = 'sms.checkpoint.v1';
  let cp = null;
  try { cp = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
  if (!cp || typeof cp.wave !== 'number') cp = null;
  return {
    get() { return cp ? JSON.parse(JSON.stringify(cp)) : null; },
    save(data) {
      cp = data;
      try { localStorage.setItem(KEY, JSON.stringify(cp)); } catch (e) { /* ignore */ }
    },
    clear() {
      cp = null;
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },
  };
})();

const Scores = (() => {
  const KEY = 'sms.scores.v2';
  const STATS = 'sms.lifetime.v2';
  let list = [];
  let life = { runs: 0, kills: 0, best: {} };
  try { list = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { /* ignore */ }
  try { life = Object.assign(life, JSON.parse(localStorage.getItem(STATS)) || {}); } catch (e) { /* ignore */ }
  if (!life.best) life.best = {};

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      localStorage.setItem(STATS, JSON.stringify(life));
    } catch (e) { /* ignore */ }
  };

  return {
    best() { return list.length ? list[0].score : 0; },
    top(n = 5) { return list.slice(0, n); },
    lifetime() { return { ...life }; },
    /** Best score and furthest wave for one mode ('arcade', 'extreme', 'insane', 'brutal'). */
    bestFor(mode) { return life.best[mode] || null; },
    /** Adds a finished run. Returns its leaderboard index (or -1 if it didn't place). */
    submit(entry) {
      life.runs += 1;
      life.kills += entry.kills || 0;
      const m = entry.mode || 'arcade';
      const b = life.best[m] || { score: 0, wave: 0 };
      life.best[m] = { score: Math.max(b.score, entry.score), wave: Math.max(b.wave, entry.wave) };
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      list = list.slice(0, 10);
      save();
      return list.indexOf(entry);
    },
    reset() { list = []; life = { runs: 0, kills: 0, best: {} }; save(); },
  };
})();
