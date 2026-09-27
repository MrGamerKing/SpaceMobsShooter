/* =========================================================================
   Audio — every sound is synthesized with WebAudio (no audio files needed)
   ========================================================================= */
const Sfx = (() => {
  let ctx = null;
  let master, musicBus, sfxBus, noiseBuf;
  let muted = false;
  let ducked = false;
  const last = {};

  // Minimum seconds between two plays of the same sound (keeps rapid fire pleasant)
  const THROTTLE = { shoot: 0.055, hit: 0.03, explode: 0.035, eshoot: 0.07, graze: 0.05, shield: 0.08, hover: 0.04 };

  function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(comp);
      comp.connect(ctx.destination);
      musicBus = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus.connect(master);
      sfxBus.connect(master);
      applyVolumes();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(Settings.get('music') * 0.5 * (ducked ? 0.35 : 1), t, 0.08);
    sfxBus.gain.setTargetAtTime(Settings.get('sfx'), t, 0.03);
  }
  Settings.onChange((k) => { if (k === 'music' || k === 'sfx') applyVolumes(); });

  // ------------------------------------------------------------ primitives
  function tone(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.out || sfxBus);
    osc.start(t);
    osc.stop(t + o.d + 0.05);
  }

  function noise(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 2000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    src.connect(f);
    f.connect(g);
    g.connect(o.out || sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.d + 0.05);
  }

  const semi = (f, n) => f * Math.pow(2, n / 12);

  // ------------------------------------------------------------ sound bank
  const bank = {
    shoot(lv = 1) {
      const f = 720 + lv * 70 + Math.random() * 60;
      tone({ type: 'square', f, f2: f * 0.45, d: 0.07, v: 0.035, lp: 2600 });
    },
    missile() { noise({ type: 'bandpass', f: 900, f2: 2600, d: 0.18, v: 0.06, q: 2 }); },
    hit() {
      noise({ type: 'bandpass', f: 2800, d: 0.04, v: 0.08, q: 1.5 });
      tone({ type: 'triangle', f: 320, f2: 140, d: 0.05, v: 0.05 });
    },
    explode(size = 1) {
      const s = Math.min(size, 2.2);
      noise({ f: 2200, f2: 90, d: 0.25 + s * 0.2, v: 0.22 * Math.min(1.4, s) });
      tone({ type: 'sine', f: 150, f2: 38, d: 0.18 + s * 0.14, v: 0.32 });
    },
    bigExplode() {
      noise({ f: 3200, f2: 60, d: 1.4, v: 0.45 });
      tone({ type: 'sine', f: 120, f2: 28, d: 1.1, v: 0.55 });
      tone({ type: 'sawtooth', f: 90, f2: 30, d: 0.8, v: 0.12, lp: 500 });
      noise({ f: 1400, f2: 80, d: 0.9, v: 0.25, delay: 0.18 });
    },
    eshoot() { tone({ type: 'triangle', f: 520, f2: 240, d: 0.09, v: 0.03 }); },
    sonic() {
      tone({ type: 'sawtooth', f: 180, f2: 70, d: 0.3, v: 0.09, lp: 900 });
      noise({ type: 'bandpass', f: 600, f2: 200, d: 0.3, v: 0.08, q: 3 });
    },
    pickup() {
      [0, 4, 7, 12].forEach((n, i) => tone({ type: 'triangle', f: semi(880, n), d: 0.12, v: 0.08, delay: i * 0.045 }));
    },
    power() {
      tone({ type: 'square', f: 220, f2: 1760, d: 0.35, v: 0.05, lp: 3000 });
      [0, 7, 12, 19].forEach((n, i) => tone({ type: 'triangle', f: semi(660, n), d: 0.18, v: 0.07, delay: 0.08 + i * 0.06 }));
    },
    levelup() {
      [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone({ type: 'square', f: semi(523, n), d: 0.14, v: 0.045, lp: 3500, delay: i * 0.05 }));
    },
    hurt() {
      tone({ type: 'sawtooth', f: 420, f2: 70, d: 0.35, v: 0.16, lp: 1800 });
      noise({ f: 1800, f2: 200, d: 0.3, v: 0.2 });
    },
    shield() { tone({ type: 'triangle', f: 1300, f2: 600, d: 0.12, v: 0.07 }); },
    dash() {
      noise({ type: 'bandpass', f: 500, f2: 3200, d: 0.2, v: 0.14, q: 1.2 });
      tone({ type: 'sine', f: 300, f2: 900, d: 0.14, v: 0.05 });
    },
    nova() {
      tone({ type: 'sine', f: 90, f2: 26, d: 1.3, v: 0.6 });
      noise({ f: 5000, f2: 100, d: 1.5, v: 0.35 });
      tone({ type: 'triangle', f: 300, f2: 2400, d: 0.7, v: 0.08 });
      [0, 5, 12, 17, 24].forEach((n, i) => tone({ type: 'sine', f: semi(880, n), d: 0.3, v: 0.05, delay: 0.1 + i * 0.06 }));
    },
    ready() { [0, 12].forEach((n, i) => tone({ type: 'sine', f: semi(1046, n), d: 0.2, v: 0.08, delay: i * 0.08 })); },
    graze() { tone({ type: 'sine', f: 2400 + Math.random() * 400, d: 0.04, v: 0.025 }); },
    combo(m = 2) {
      const f = semi(660, Math.min(m, 8) * 2);
      tone({ type: 'square', f, d: 0.1, v: 0.05, lp: 4000 });
      tone({ type: 'square', f: f * 1.5, d: 0.16, v: 0.04, lp: 4000, delay: 0.07 });
    },
    fuse() { noise({ type: 'highpass', f: 3000, d: 0.7, v: 0.06, a: 0.05 }); },
    vex() { tone({ type: 'sawtooth', f: 900, f2: 1600, d: 0.14, v: 0.04, lp: 3000 }); },
    cast() { [0, 3, 7, 10].forEach((n, i) => tone({ type: 'sine', f: semi(440, n), d: 0.3, v: 0.05, delay: i * 0.09 })); },
    charge() {
      tone({ type: 'sawtooth', f: 60, f2: 400, d: 1.0, v: 0.09, lp: 1200, a: 0.3 });
      noise({ type: 'bandpass', f: 300, f2: 3000, d: 1.0, v: 0.06, a: 0.4, q: 4 });
    },
    beam() {
      noise({ f: 4000, f2: 300, d: 0.8, v: 0.3 });
      tone({ type: 'sawtooth', f: 110, f2: 55, d: 0.7, v: 0.2, lp: 1500 });
    },
    roar() {
      tone({ type: 'sawtooth', f: 95, f2: 45, d: 1.6, v: 0.28, lp: 700, a: 0.08 });
      tone({ type: 'sawtooth', f: 98, f2: 47, d: 1.6, v: 0.2, lp: 500, a: 0.1, detune: 25 });
      noise({ f: 700, f2: 120, d: 1.5, v: 0.22, a: 0.1 });
    },
    warning() {
      for (let i = 0; i < 4; i++) {
        tone({ type: 'square', f: 440, d: 0.22, v: 0.06, lp: 2000, delay: i * 0.5 });
        tone({ type: 'square', f: 330, d: 0.22, v: 0.06, lp: 2000, delay: i * 0.5 + 0.25 });
      }
    },
    wave() { [0, 4, 7].forEach((n) => tone({ type: 'triangle', f: semi(392, n), d: 0.6, v: 0.06, a: 0.02 })); tone({ type: 'sine', f: 196, d: 0.8, v: 0.1 }); },
    clear() { [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone({ type: 'square', f: semi(523, n), d: 0.16, v: 0.045, lp: 3000, delay: i * 0.07 })); },
    gameover() { [12, 7, 3, 0, -5].forEach((n, i) => tone({ type: 'triangle', f: semi(440, n), d: 0.4, v: 0.1, delay: i * 0.18 })); },
    hover() { tone({ type: 'sine', f: 1900, d: 0.03, v: 0.02 }); },
    click() { tone({ type: 'square', f: 1200, f2: 800, d: 0.05, v: 0.04, lp: 3500 }); },
  };

  function play(name, arg) {
    if (!ctx || muted || ctx.state !== 'running' || Settings.get('sfx') <= 0) return;
    const now = ctx.currentTime;
    const gap = THROTTLE[name];
    if (gap && last[name] && now - last[name] < gap) return;
    last[name] = now;
    bank[name](arg);
  }

  // ------------------------------------------------------------ music sequencer
  // Three moods share one 4-bar step sequencer (16 steps per bar).
  const SONGS = {
    menu: { bpm: 92, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] },   // Am F C G
    game: { bpm: 124, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] },
    boss: { bpm: 146, prog: [[52, 55, 59], [53, 57, 60], [52, 55, 59], [50, 53, 57]] },  // Em F Em Dm
  };
  let song = null;
  let pending;          // undefined = no change queued; null = stop at next bar
  let step = 0;
  let nextTime = 0;
  let timer = null;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function voice(type, f, t, d, v, lp, a) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (a || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let n = o;
    if (lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = lp;
      o.connect(fl);
      n = fl;
    }
    n.connect(g);
    g.connect(musicBus);
    o.start(t);
    o.stop(t + d + 0.03);
  }
  function drum(kind, t, v = 1) {
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.5 * v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(musicBus);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const d = kind === 'snare' ? 0.14 : 0.035;
    f.type = kind === 'snare' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 'snare' ? 1800 : 8000;
    g.gain.setValueAtTime((kind === 'snare' ? 0.22 : 0.06) * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f);
    f.connect(g);
    g.connect(musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + d + 0.02);
  }

  function scheduleStep(s, t) {
    const S = SONGS[song];
    const bar = Math.floor(s / 16) % 4;
    const sub = s % 16;
    const ch = S.prog[bar];
    const root = ch[0];
    const sixteenth = 60 / S.bpm / 4;

    if (song === 'menu') {
      if (sub === 0) ch.forEach((n) => voice('triangle', hz(n), t, sixteenth * 15, 0.035, 1400, 0.4));
      if (sub === 0 || sub === 8) voice('sine', hz(root - 12), t, sixteenth * 7, 0.09, 0, 0.02);
      if (sub % 2 === 0) {
        const arp = [ch[0], ch[1], ch[2], ch[1] + 12][(sub / 2) % 4] + 12;
        voice('sine', hz(arp), t, sixteenth * 2.5, 0.03);
      }
      return;
    }

    const boss = song === 'boss';
    // drums
    if (sub % 4 === 0 || (boss && sub === 14)) drum('kick', t);
    if (sub === 4 || sub === 12) drum('snare', t);
    if (boss ? true : sub % 2 === 0) drum('hat', t, sub % 4 === 2 ? 1 : 0.5);
    // bass
    if (boss) {
      voice('sawtooth', hz(root - 24 + (sub % 8 === 6 ? 12 : 0)), t, sixteenth * 0.9, 0.09, 520);
    } else if (sub % 2 === 0) {
      voice('sawtooth', hz(root - 24 + (sub % 4 === 2 ? 12 : 0)), t, sixteenth * 1.7, 0.09, 650);
    }
    // arpeggio
    const pattern = boss ? [0, 1, 2, 1] : (bar % 2 ? [3, 2, 1, 0] : [0, 1, 2, 3]);
    const notes = [ch[0], ch[1], ch[2], ch[0] + 12];
    voice('square', hz(notes[pattern[sub % 4]] + 12), t, sixteenth * 0.9, boss ? 0.022 : 0.02, boss ? 2000 : 2600);
    // pad swell at bar start
    if (sub === 0) ch.forEach((n) => voice('triangle', hz(n), t, sixteenth * 16, 0.018, 1100, 0.25));
  }

  function tick() {
    if (!ctx || !song) return;
    while (nextTime < ctx.currentTime + 0.12) {
      if (pending !== undefined && step % 16 === 0) {
        song = pending;
        pending = undefined;
        if (!song) return stop();
      }
      scheduleStep(step, nextTime);
      nextTime += 60 / SONGS[song].bpm / 4;
      step = (step + 1) % 64;
    }
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    song = null;
  }

  function music(mode) {
    if (!ctx) { pending = mode; return; }
    if (mode === song) { pending = undefined; return; }
    if (!song) {
      if (!mode) return;
      song = mode;
      pending = undefined;
      step = 0;
      nextTime = ctx.currentTime + 0.06;
      clearInterval(timer);
      timer = setInterval(tick, 25);
      return;
    }
    pending = mode;
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  return {
    unlock() {
      const first = !ctx;
      unlock();
      if (first && pending) {
        const m = pending;
        pending = undefined;
        music(m);
      }
    },
    play,
    music,
    duck(on) { ducked = on; applyVolumes(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
      return muted;
    },
    get muted() { return muted; },
  };
})();
