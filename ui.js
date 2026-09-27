/* =========================================================================
   UI — menus, HUD, settings, banners, game over + boot sequence
   ========================================================================= */
const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const retrigger = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const MULT_COL = [null, '#ffffff', '#7ff0ff', '#6dff9a', '#ffe066', '#ffab40', '#ff6ad5', '#c78bff', '#ff4d5e'];

  const SVG = {
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
    muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 4.6-3.4 8.6-8 10-4.6-1.4-8-5.4-8-10v-6z" fill="#3ee6ff"/><path d="M11 6h2v12h-2zM7 10h10v2H7z" fill="#e9fdff" opacity=".8"/></svg>',
    magnet: '<svg viewBox="0 0 24 24"><path d="M5 4h4.4v7.4a2.6 2.6 0 0 0 5.2 0V4H19v7.4a7 7 0 0 1-14 0z" fill="#ff4d5e"/><path d="M5 4h4.4v3.2H5zM14.6 4H19v3.2h-4.4z" fill="#e6ecf7"/></svg>',
  };

  const screens = {
    menu: $('scrMenu'), how: $('scrHow'), settings: $('scrSettings'),
    about: $('scrAbout'), pause: $('scrPause'), over: $('scrOver'),
  };
  const els = {
    hud: $('hud'), score: $('hudScore'), combo: $('hudCombo'), mult: $('hudMult'), comboBar: $('hudComboBar'),
    hits: $('hudHits'), pips: $('hudPips'), wave: $('hudWave'), hearts: $('hudHearts'), powers: $('hudPowers'),
    bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossFill'), bossLag: $('bossLag'),
    abDash: $('abDash'), abNova: $('abNova'), fps: $('fps'), fxLow: $('fxLow'),
  };

  let current = null;
  let stack = [];
  let keyNav = !Settings.isTouch;

  // ================================================================ screens
  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.classList.toggle('active', key === name);
    current = name;
    if (!name) {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      return;
    }
    const scr = screens[name];
    const pb = scr.querySelector('.panel-body');
    if (pb) pb.scrollTop = 0;
    if (keyNav) {
      const target = scr.querySelector('[data-autofocus]') || scr.querySelector('button');
      if (target) setTimeout(() => { if (current === name) target.focus({ preventScroll: true }); }, 90);
    }
  }
  function open(name) { stack.push(current); show(name); }
  function back() {
    const prev = stack.pop() || (Game.state === 'paused' ? 'pause' : 'menu');
    show(prev);
  }

  function refreshMenu() {
    const life = Scores.lifetime();
    $('menuBest').textContent = fmt(Scores.best());
    $('menuRuns').textContent = fmt(life.runs);
    $('menuKills').textContent = fmt(life.kills);
  }

  function requestFs() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return;
    try {
      const p = fn.call(el, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* not allowed */ }
  }
  function toggleFullscreen() {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      const fn = d.exitFullscreen || d.webkitExitFullscreen;
      if (fn) fn.call(d);
    } else {
      requestFs();
    }
  }
  function syncMute() { $('btnMute').innerHTML = Sfx.muted ? SVG.muted : SVG.sound; }

  function startGame() {
    Sfx.unlock();
    stack = [];
    show(null);
    if (Settings.isTouch && !document.fullscreenElement) requestFs();
    Game.start();
  }

  let resetArmed = 0;
  const actions = {
    play: startGame,
    restart: startGame,
    how: () => open('how'),
    settings: () => open('settings'),
    about: () => open('about'),
    back,
    resume: () => Game.resume(),
    menu: () => {
      Game.toMenu();
      stack = [];
      els.hud.classList.remove('show');
      body.classList.remove('playing');
      bossBar(false);
      els.fxLow.classList.remove('on');
      refreshMenu();
      show('menu');
    },
    quit: () => window.close(),
    fullscreen: toggleFullscreen,
    mute: () => { const m = Sfx.toggleMute(); syncMute(); toast(m ? 'SOUND OFF' : 'SOUND ON'); },
    reset: (btn) => {
      const now = Date.now();
      if (now - resetArmed < 2500) {
        Scores.reset();
        refreshMenu();
        btn.textContent = 'DONE';
        resetArmed = 0;
        toast('BEST SCORES CLEARED');
      } else {
        resetArmed = now;
        btn.textContent = 'SURE?';
        setTimeout(() => { btn.textContent = 'RESET'; }, 2500);
      }
    },
  };

  // ================================================================ HUD
  const shown = { score: -1, comboOn: false, mult: 0, combo: -1, hp: -1, maxHp: -1, weapon: -1, wave: -1, low: false };
  let dispScore = 0;
  let lastScore = 0;
  let lastBump = 0;
  let bossLagV = 1;
  let fpsT = 0;
  const chips = {};
  const POWER_INFO = {
    overdrive: { label: 'OVERDRIVE', color: '#a36bff', icon: '<img src="booster.png" alt="">' },
    shield: { label: 'SHIELD', color: '#3ee6ff', icon: SVG.shield },
    magnet: { label: 'MAGNET', color: '#ff4d5e', icon: SVG.magnet },
    double: { label: '2X SCORE', color: '#ffd23f', icon: '<img src="scoreinc2.png" alt="">' },
  };

  function setP(el, v) {
    const r = Math.round(v * 200) / 200;
    if (el._p === r) return;
    el._p = r;
    el.style.setProperty('--p', r);
  }

  function renderHearts(hp, max) {
    const wrap = els.hearts;
    while (wrap.children.length < max) {
      const h = document.createElement('i');
      h.className = 'heart';
      if (shown.maxHp !== -1) retrigger(h, 'gain');
      wrap.appendChild(h);
    }
    while (wrap.children.length > max) wrap.lastChild.remove();
    Array.from(wrap.children).forEach((h, i) => {
      const lost = i >= hp;
      if (lost && !h.classList.contains('lost')) {
        h.classList.add('lost');
        if (shown.hp !== -1) retrigger(h, 'break');
      } else if (!lost && h.classList.contains('lost')) {
        h.classList.remove('lost');
        retrigger(h, 'gain');
      }
    });
  }

  function updatePowers(buffs) {
    for (const key in POWER_INFO) {
      const t = buffs[key];
      let chip = chips[key];
      if (t > 0) {
        if (!chip) {
          const info = POWER_INFO[key];
          chip = document.createElement('div');
          chip.className = 'chip';
          chip.style.setProperty('--c', info.color);
          chip.innerHTML = `<span class="ic"><span>${info.icon}</span></span><b>${info.label}</b>`;
          els.powers.appendChild(chip);
          chips[key] = chip;
        }
        setP(chip, t / Game.BUFF_MAX[key]);
        chip.classList.toggle('low', t < 2);
      } else if (chip) {
        delete chips[key];
        chip.classList.add('out');
        setTimeout(() => chip.remove(), 300);
      }
    }
  }

  function frame(h, dt) {
    // score (counts up smoothly)
    dispScore += (h.score - dispScore) * Math.min(1, dt * 12);
    if (Math.abs(h.score - dispScore) < 1) dispScore = h.score;
    const s = Math.floor(dispScore);
    if (s !== shown.score) { shown.score = s; els.score.textContent = fmt(s); }
    if (h.score > lastScore) {
      const now = performance.now();
      if (now - lastBump > 140) { lastBump = now; retrigger(els.score, 'bump'); }
    }
    lastScore = h.score;

    // combo
    const on = h.combo >= 2;
    if (on !== shown.comboOn) { shown.comboOn = on; els.combo.classList.toggle('on', on); }
    if (on) {
      if (h.mult !== shown.mult) {
        shown.mult = h.mult;
        els.mult.textContent = 'x' + h.mult;
        els.combo.style.setProperty('--c', MULT_COL[h.mult]);
        retrigger(els.combo, 'pop');
      }
      if (h.combo !== shown.combo) { shown.combo = h.combo; els.hits.textContent = h.combo + ' HITS'; }
      els.comboBar.style.transform = `scaleX(${Math.max(0, h.comboT).toFixed(3)})`;
    } else {
      shown.mult = 0;
    }

    // hull
    if (h.hp !== shown.hp || h.maxHp !== shown.maxHp) {
      renderHearts(h.hp, h.maxHp);
      shown.hp = h.hp;
      shown.maxHp = h.maxHp;
    }
    const low = h.alive && h.hp === 1;
    if (low !== shown.low) { shown.low = low; els.fxLow.classList.toggle('on', low); }

    // weapon
    if (h.weapon !== shown.weapon) {
      Array.from(els.pips.children).forEach((p, i) => {
        const was = p.classList.contains('on');
        p.classList.toggle('on', i < h.weapon);
        if (!was && i < h.weapon && shown.weapon !== -1) retrigger(p, 'new');
      });
      shown.weapon = h.weapon;
    }

    // wave
    if (h.wave !== shown.wave) {
      shown.wave = h.wave;
      els.wave.innerHTML = h.wave > 0 ? `WAVE <b>${h.wave}</b>` : 'GET READY';
    }

    // abilities
    setP(els.abDash, h.dash);
    els.abDash.classList.toggle('ready', h.dash >= 1);
    setP(els.abNova, h.nova / 100);
    els.abNova.classList.toggle('ready', h.nova >= 100);

    updatePowers(h.buffs);

    // boss
    if (h.boss >= 0) {
      const v = Math.max(0, h.boss);
      els.bossFill.style.transform = `scaleX(${v.toFixed(4)})`;
      bossLagV = v >= bossLagV ? v : Math.max(v, bossLagV - dt * 0.35);
      els.bossLag.style.transform = `scaleX(${bossLagV.toFixed(4)})`;
      els.bossBar.classList.toggle('enraged', h.bossPhase === 3);
    }

    // fps
    fpsT -= dt;
    if (fpsT <= 0) {
      fpsT = 0.5;
      els.fps.textContent = Settings.get('showFps') ? `${h.fps} FPS` : '';
    }
  }

  function bossBar(on, name) {
    els.bossBar.classList.toggle('show', !!on);
    if (on) {
      els.bossName.textContent = name || 'THE WARDEN';
      bossLagV = 1;
      els.bossFill.style.transform = 'scaleX(1)';
      els.bossLag.style.transform = 'scaleX(1)';
      els.bossBar.classList.remove('enraged');
    }
  }

  // ================================================================ feedback
  function flash(kind) { retrigger(kind === 'white' ? $('fxWhite') : $('fxHurt'), 'hit'); }

  function banner(title, sub = '', kind = 'wave', dur = 2200) {
    const b = $('banner');
    b.className = 'banner';
    void b.offsetWidth;
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub;
    b.style.setProperty('--dur', dur + 'ms');
    b.classList.add('show', kind);
    if (kind === 'warning') retrigger($('hazard'), 'show');
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
  }

  function denied(which) {
    if (which === 'nova') retrigger(els.abNova, 'denied');
  }

  let hintTimer = 0;
  function showHint() {
    const dev = Input.device;
    let items;
    if (dev === 'touch') {
      items = Settings.get('touchScheme') === 'joystick'
        ? ['<b>LEFT THUMB</b> steer', '<b>FLICK</b> right side = dash', '<b>DOUBLE-TAP</b> right = nova']
        : ['<b>DRAG</b> anywhere to fly', '<b>FLICK</b> to dash', '<b>2-FINGER TAP</b> = nova'];
    } else if (dev === 'gamepad') {
      items = ['<b>L-STICK</b> fly', '<b>B</b> dash', '<b>X</b> nova', '<b>START</b> pause'];
    } else {
      items = ['<b>WASD</b> fly', '<b>SHIFT</b> dash', '<b>B</b> nova', '<b>HOLD CLICK</b> mouse fly', '<b>F</b> auto-fire'];
    }
    const el = $('hint');
    el.innerHTML = items.map((i) => `<span>${i}</span>`).join('');
    el.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.remove('show'), 5500);
  }

  // ================================================================ game hooks
  function onStart() {
    els.hearts.innerHTML = '';
    for (const key in chips) { chips[key].remove(); delete chips[key]; }
    Object.assign(shown, { score: -1, comboOn: false, mult: 0, combo: -1, hp: -1, maxHp: -1, weapon: -1, wave: -1, low: false });
    dispScore = 0;
    lastScore = 0;
    els.combo.classList.remove('on');
    els.fxLow.classList.remove('on');
    bossBar(false);
    $('banner').className = 'banner';
    els.hud.classList.add('show');
    body.classList.add('playing');
    if (Scores.lifetime().runs < 6) showHint();
  }
  function showPause(info) {
    $('pauseWave').textContent = info.wave || 1;
    $('pauseScore').textContent = fmt(info.score);
    stack = [];
    show('pause');
  }
  function onResume() {
    stack = [];
    show(null);
  }

  function countUp(el, to, ms) {
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function confetti() {
    const box = $('confetti');
    box.innerHTML = '';
    const cols = ['#3ee6ff', '#ff4fd8', '#ffd23f', '#56f08b', '#a36bff', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = cols[i % cols.length];
      c.style.setProperty('--t', (2.2 + Math.random() * 2) + 's');
      c.style.setProperty('--d', (Math.random() * 0.8) + 's');
      c.style.setProperty('--x', (Math.random() * 200 - 100) + 'px');
      c.style.setProperty('--r', (Math.random() * 1440 - 720) + 'deg');
      box.appendChild(c);
    }
    setTimeout(() => { box.innerHTML = ''; }, 5000);
  }
  function showGameOver(r) {
    stack = [];
    els.fxLow.classList.remove('on');
    $('overNew').classList.toggle('hidden', !r.isBest);
    $('overBest').classList.toggle('hidden', r.isBest);
    $('overBest').textContent = 'BEST ' + fmt(r.best);
    const rank = r.score >= 60000 ? 'S' : r.score >= 30000 ? 'A' : r.score >= 12000 ? 'B' : r.score >= 4000 ? 'C' : 'D';
    const rk = $('overRank');
    rk.textContent = rank;
    rk.dataset.rank = rank;
    const mins = Math.floor(r.time / 60);
    const secs = String(Math.floor(r.time % 60)).padStart(2, '0');
    const stats = [
      ['WAVE', r.wave], ['MOBS', fmt(r.kills)], ['MAX COMBO', r.maxCombo],
      ['BOSSES', r.bosses], ['TIME', `${mins}:${secs}`], ['GRAZES', r.grazes],
    ];
    $('overStats').innerHTML = stats.map(([l, v], i) => `<div class="stat" style="--i:${i}"><small>${l}</small><b>${v}</b></div>`).join('');
    $('overBoard').innerHTML = r.top.length
      ? r.top.map((e, i) => `<li class="${e === r.entry ? 'me' : ''}"><span>#${i + 1}</span><span>${fmt(e.score)}</span><span>WAVE ${e.wave}</span></li>`).join('')
      : '<li class="empty">NO SCORES YET</li>';
    $('overScore').textContent = '0';
    show('over');
    countUp($('overScore'), r.score, 1400);
    if (r.isBest) confetti();
    refreshMenu();
  }

  // ================================================================ settings
  function paintRange(el) {
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);
    el.style.setProperty('--v', ((parseFloat(el.value) - min) / (max - min)) * 100 + '%');
    const out = document.querySelector(`[data-out="${el.dataset.set}"]`);
    if (out) out.textContent = el.dataset.set === 'sensitivity' ? parseFloat(el.value).toFixed(2) + 'x' : Math.round(el.value * 100) + '%';
  }
  function syncSetting(key) {
    document.querySelectorAll(`[data-set="${key}"]`).forEach((el) => {
      const v = Settings.get(key);
      if (el.type === 'range') { el.value = v; paintRange(el); }
      else if (el.classList.contains('toggle')) el.setAttribute('aria-checked', String(!!v));
      else if (el.classList.contains('seg')) el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === v)));
    });
  }
  function initSettings() {
    document.querySelectorAll('[data-set]').forEach((el) => {
      const key = el.dataset.set;
      if (el.type === 'range') {
        el.addEventListener('input', () => { Settings.set(key, parseFloat(el.value)); paintRange(el); });
        el.addEventListener('change', () => Sfx.play('click'));
      } else if (el.classList.contains('toggle')) {
        el.addEventListener('click', () => { Settings.set(key, !Settings.get(key)); Sfx.play('click'); });
      } else if (el.classList.contains('seg')) {
        el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { Settings.set(key, b.dataset.val); Sfx.play('click'); }));
      }
      syncSetting(key);
    });
    Settings.onChange((key) => syncSetting(key));
  }

  function initTabs() {
    const tabs = document.querySelectorAll('[data-tab]');
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((o) => {
        o.setAttribute('aria-selected', String(o === t));
        $(o.dataset.tab).classList.toggle('active', o === t);
      });
      Sfx.play('click');
    }));
    $('howShield').innerHTML = SVG.shield;
    $('howMagnet').innerHTML = SVG.magnet;
  }

  // ================================================================ navigation
  function focusables(scr) {
    return Array.from(scr.querySelectorAll('button:not([disabled]), input, a[href]')).filter((el) => el.offsetParent !== null && !el.closest('.hidden'));
  }
  function moveFocus(dir) {
    const scr = screens[current];
    if (!scr) return;
    const items = focusables(scr);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const next = i === -1 ? items[0] : items[(i + dir + items.length) % items.length];
    next.focus({ preventScroll: false });
    Sfx.play('hover');
  }
  function nudgeRange(el, dir) {
    const step = parseFloat(el.step) || 0.05;
    el.value = Math.min(parseFloat(el.max), Math.max(parseFloat(el.min), parseFloat(el.value) + dir * step));
    el.dispatchEvent(new Event('input'));
  }

  function onKeyDown(e) {
    keyNav = true;
    if (!current) return;
    if (e.key === 'Escape') {
      if (current === 'how' || current === 'settings' || current === 'about') {
        e.preventDefault();
        e.stopPropagation();
        back();
        Sfx.play('click');
      }
      return;
    }
    const a = document.activeElement;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (a && a.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      e.preventDefault();
      moveFocus(e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (e.key === 'Enter' && current === 'menu' && !(a && screens.menu.contains(a))) {
      e.preventDefault();
      startGame();
    }
  }
  function onMenuNav(a) {
    keyNav = true;
    if (!current) return;
    const el = document.activeElement;
    const inScreen = el && screens[current].contains(el);
    switch (a) {
      case 'up': moveFocus(-1); break;
      case 'down': moveFocus(1); break;
      case 'left':
      case 'right':
        if (inScreen && el.type === 'range') nudgeRange(el, a === 'left' ? -1 : 1);
        else moveFocus(a === 'left' ? -1 : 1);
        break;
      case 'confirm':
        if (inScreen) el.click(); else moveFocus(1);
        break;
      case 'back':
        if (current === 'pause') Game.resume();
        else if (current === 'how' || current === 'settings' || current === 'about') back();
        break;
      case 'start':
        if (current === 'pause') Game.resume();
        else if (current === 'menu') startGame();
        break;
      default:
        break;
    }
  }

  function setDeviceClass(dev) {
    body.classList.toggle('touch', dev === 'touch');
    if (dev === 'touch' || dev === 'mouse') keyNav = false;
    if (dev === 'keyboard' || dev === 'gamepad') keyNav = true;
  }

  // ================================================================ boot
  function bind() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      Sfx.unlock();
      Sfx.play('click');
      const fn = actions[b.dataset.act];
      if (fn) fn(b);
    });
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.target.closest('.btn, .icon-btn, .tabs button, .seg button, .toggle');
      if (b && !b.contains(e.relatedTarget)) Sfx.play('hover');
    });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', (e) => {
      setDeviceClass(e.pointerType === 'mouse' ? 'mouse' : 'touch');
    }, true);

    // HUD buttons respond on press (not release) for zero-latency
    const press = (el, fn) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Sfx.unlock();
      retrigger(el, 'pressed');
      setTimeout(() => el.classList.remove('pressed'), 120);
      fn();
    });
    press(els.abDash, () => Game.dash());
    press(els.abNova, () => Game.nova());
    press($('btnPause'), () => Game.pause());

    Input.onMenu(onMenuNav);
    Input.onDevice((dev) => setDeviceClass(dev));

    // audio can only start after a user gesture
    const unlock = () => Sfx.unlock();
    ['pointerdown', 'pointerup', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));

    if (/Electron/i.test(navigator.userAgent)) $('btnQuit').classList.remove('hidden');
  }

  async function boot() {
    setDeviceClass(Settings.isTouch ? 'touch' : 'keyboard');
    bind();
    initSettings();
    initTabs();
    syncMute();
    refreshMenu();
    await Game.load((p) => { $('loadFill').style.width = Math.round(p * 100) + '%'; });
    if (document.fonts && document.fonts.load) {
      try { await Promise.race([document.fonts.load('12px "Press Start 2P"'), wait(1500)]); } catch (_) { /* offline */ }
    }
    Game.init();
    Sfx.music('menu');
    $('loader').classList.add('done');
    show('menu');
    if (location.hash === '#play') setTimeout(startGame, 250);
    else if (location.hash === '#about') open('about');
  }

  boot();

  return {
    get current() { return current; },
    frame, bossBar, banner, toast, flash, denied, syncMute,
    onStart, onResume, showPause, showGameOver,
  };
})();
