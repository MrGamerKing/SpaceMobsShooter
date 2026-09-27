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

const Scores = (() => {
  const KEY = 'sms.scores.v2';
  const STATS = 'sms.lifetime.v2';
  let list = [];
  let life = { runs: 0, kills: 0 };
  try { list = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { /* ignore */ }
  try { life = Object.assign(life, JSON.parse(localStorage.getItem(STATS)) || {}); } catch (e) { /* ignore */ }

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
    /** Adds a finished run. Returns its leaderboard index (or -1 if it didn't place). */
    submit(entry) {
      life.runs += 1;
      life.kills += entry.kills || 0;
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      list = list.slice(0, 10);
      save();
      return list.indexOf(entry);
    },
    reset() { list = []; life = { runs: 0, kills: 0 }; save(); },
  };
})();
