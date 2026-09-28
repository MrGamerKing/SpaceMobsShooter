/* =========================================================================
   UI — menus, HUD, settings, trophies, banners, game over + boot sequence
   ========================================================================= */
const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const retrigger = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const MULT_COL = [null, '#ffffff', '#7ff0ff', '#6dff9a', '#ffe066', '#ffab40', '#ff6ad5', '#c78bff', '#ff4d5e'];
  const DIFF_LABEL = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' };

  const SVG = {
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
    muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 4.6-3.4 8.6-8 10-4.6-1.4-8-5.4-8-10v-6z" fill="#3ee6ff"/><path d="M11 6h2v12h-2zM7 10h10v2H7z" fill="#e9fdff" opacity=".8"/></svg>',
    magnet: '<svg viewBox="0 0 24 24"><path d="M5 4h4.4v7.4a2.6 2.6 0 0 0 5.2 0V4H19v7.4a7 7 0 0 1-14 0z" fill="#ff4d5e"/><path d="M5 4h4.4v3.2H5zM14.6 4H19v3.2h-4.4z" fill="#e6ecf7"/></svg>',
  };

  const screens = {
    menu: $('scrMenu'), how: $('scrHow'), settings: $('scrSettings'), about: $('scrAbout'),
    trophies: $('scrTrophies'), skins: $('scrSkins'), pause: $('scrPause'), over: $('scrOver'),
    modes: $('scrModes'), arcade: $('scrArcade'), hardcore: $('scrHardcore'),
    mp: $('scrMp'), create: $('scrCreate'), join: $('scrJoin'), lobby: $('scrLobby'), down: $('scrDown'), netMsg: $('scrNetMsg'),
  };
  const SUB_SCREENS = ['how', 'settings', 'about', 'trophies', 'skins', 'modes', 'arcade', 'hardcore', 'mp', 'create', 'join'];
  const TIER = Object.fromEntries(HARDCORE_TIERS.map((t) => [t.id, t]));
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const els = {
    hud: $('hud'), score: $('hudScore'), combo: $('hudCombo'), mult: $('hudMult'), comboBar: $('hudComboBar'),
    hits: $('hudHits'), pips: $('hudPips'), power: $('hudPower'), wave: $('hudWave'), waveProg: $('waveProg'), waveFill: $('waveProgFill'),
    hearts: $('hudHearts'), totem: $('hudTotem'), powers: $('hudPowers'),
    bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossFill'), bossLag: $('bossLag'),
    bossShield: $('bossShield'), bossTicks: $('bossTicks'), bossHpText: $('bossHpText'), bossStatus: $('bossStatus'),
    abDash: $('abDash'), abNova: $('abNova'), fps: $('fps'), fxLow: $('fxLow'), fxWarp: $('fxWarp'),
    specBar: $('specBar'), specName: $('specName'),
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
  function open(name) {
    if (name === 'trophies') renderTrophies();
    if (name === 'skins') renderSkins();
    if (name === 'modes') renderModes();
    if (name === 'arcade') renderArcade();
    if (name === 'hardcore') renderHardcore();
    stack.push(current);
    show(name);
    if (name === 'skins' && keyNav) {
      setTimeout(() => {
        const on = $('skinGrid').querySelector('.skin.on');
        if (on && current === 'skins') on.focus({ preventScroll: true });
      }, 100);
    }
  }
  function back() {
    const prev = stack.pop() || (Game.state === 'paused' ? 'pause' : 'menu');
    show(prev);
  }

  function refreshMenu() {
    const life = Scores.lifetime();
    $('menuBest').textContent = fmt(Scores.best());
    $('menuRuns').textContent = fmt(life.runs);
    $('menuTrophies').textContent = `${Trophies.count()}/${Trophies.LIST.length}`;
    const cp = Checkpoint.get();
    $('menuModeLine').innerHTML = cp
      ? `<button class="mode-pill" data-act="continue">▶ CONTINUE ARCADE · WAVE ${cp.wave}</button>`
      : '';
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

  /** opts: { mode: 'arcade' | 'hardcore', tier, checkpoint } (see Game.start) */
  function startGame(opts) {
    Sfx.unlock();
    stack = [];
    show(null);
    if (Settings.isTouch && !document.fullscreenElement) requestFs();
    Game.start(opts || { mode: 'arcade' });
  }
  /** Play the same kind of run again: Hardcore restarts the tier, Arcade goes back to the last checkpoint. */
  function retry() {
    const r = Game.run;
    if (r.mode === 'hardcore') { startGame({ mode: 'hardcore', tier: r.tier }); return; }
    const cp = Checkpoint.get();
    startGame(cp ? { mode: 'arcade', checkpoint: cp } : { mode: 'arcade' });
  }

  function hideSpec() {
    els.specBar.classList.remove('show');
    body.classList.remove('spectating');
    shown.spec = '';
  }
  /** Stop the current run (single player or co-op) and clear the in-game UI. */
  function leaveGame() {
    Game.toMenu();
    stack = [];
    specOn = false;
    els.hud.classList.remove('show');
    body.classList.remove('playing');
    bossBar(false);
    letterbox(false);
    els.fxLow.classList.remove('on');
    els.fxWarp.classList.remove('on');
    hideSpec();
    $('hint').classList.remove('show');
    refreshMenu();
  }

  let resetArmed = 0;
  let newArmed = 0;
  let specOn = false;
  const actions = {
    play: () => open('modes'),
    arcade: () => open('arcade'),
    hardcore: () => open('hardcore'),
    tier: (btn) => startGame({ mode: 'hardcore', tier: btn.dataset.tier }),
    continue: () => {
      const cp = Checkpoint.get();
      if (cp) startGame({ mode: 'arcade', checkpoint: cp });
    },
    newgame: (btn) => {
      // starting over erases the checkpoint, so ask once
      if (Checkpoint.get() && Date.now() - newArmed > 2500) {
        newArmed = Date.now();
        btn.textContent = 'ERASE CHECKPOINT & START?';
        btn.classList.add('armed');
        setTimeout(() => { btn.textContent = 'NEW GAME'; btn.classList.remove('armed'); }, 2500);
        return;
      }
      newArmed = 0;
      Checkpoint.clear();
      startGame({ mode: 'arcade' });
    },
    restart: retry,
    how: () => open('how'),
    settings: () => open('settings'),
    about: () => open('about'),
    trophies: () => open('trophies'),
    skins: () => open('skins'),
    back,
    resume: () => Game.resume(),
    menu: () => { leaveGame(); show('menu'); },

    // ---- multiplayer
    mp: () => open('mp'),
    mpCreate: () => { prefill('formCreate'); open('create'); },
    mpJoin: () => { prefill('formJoin'); open('join'); },
    lobbyStart: () => {
      if (Net.role !== 'host') return;
      const world = Game.netWorld(Net.roster.map((r) => r.ar));
      const roster = Net.startGame();
      if (!roster) return;
      const settings = { ...Net.settings };
      Net.broadcast({ t: 'start', world, roster, settings });
      launchNet('host', { world, roster, settings });
    },
    kick: (btn) => { const pid = +btn.dataset.pid; if (pid) Net.kick(pid); },
    leaveRoom: () => {
      Net.leave();
      if (Game.state !== 'menu') leaveGame();
      stack = [];
      show('menu');
      toast('LEFT THE ROOM');
    },
    lobbyBack: () => {
      // after a co-op run: everyone goes back to the room together
      leaveGame();
      if (Net.role === 'host') Net.backToLobby();
      showLobby();
    },
    spectate: () => { specOn = true; show(null); Game.spectate(0); },
    specPrev: () => { Game.spectate(-1); },
    specNext: () => { Game.spectate(1); },
    netMsgOk: () => { stack = []; show('menu'); },
    quit: () => window.close(),
    fullscreen: toggleFullscreen,
    mute: () => { const m = Sfx.toggleMute(); syncMute(); toast(m ? 'SOUND OFF' : 'SOUND ON'); },
    reset: (btn) => {
      const now = Date.now();
      if (now - resetArmed < 2500) {
        Scores.reset();
        Trophies.reset();
        refreshMenu();
        btn.textContent = 'DONE';
        resetArmed = 0;
        toast('SCORES & TROPHIES CLEARED');
      } else {
        resetArmed = now;
        btn.textContent = 'SURE?';
        setTimeout(() => { btn.textContent = 'RESET'; }, 2500);
      }
    },
  };

  // ================================================================ HUD
  const shown = { score: -1, comboOn: false, mult: 0, combo: -1, hp: -1, maxHp: -1, weapon: -1, power: -1, wave: -1, low: false, prog: -2, totem: null, warp: false, spec: '' };
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
    timewarp: { label: 'TIME WARP', color: '#7fd4ff', icon: '<img src="clock.png" alt="">' },
    storm: { label: 'STORM', color: '#5ff7e8', icon: '<img src="trident.png" alt="">' },
    drones: { label: 'ALLAYS', color: '#8fd8ff', icon: '<img src="allay.png" alt="">' },
    fatigue: { label: 'FATIGUE', color: '#c78bff', icon: '<img src="elder.png" alt="">', bad: true },
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

  function updatePowers(h) {
    for (const key in POWER_INFO) {
      const info = POWER_INFO[key];
      const t = info.bad ? h.debuffs[key] : h.buffs[key];
      let chip = chips[key];
      if (t > 0) {
        if (!chip) {
          chip = document.createElement('div');
          chip.className = info.bad ? 'chip bad' : 'chip';
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

    // hearts + totem
    if (h.hp !== shown.hp || h.maxHp !== shown.maxHp) {
      renderHearts(h.hp, h.maxHp);
      shown.hp = h.hp;
      shown.maxHp = h.maxHp;
    }
    if (h.totem !== shown.totem) { shown.totem = h.totem; els.totem.classList.toggle('on', h.totem); }
    // co-op: watching a teammate after going down
    const spec = specOn && h.spectating ? h.spectating : '';
    if (spec !== shown.spec) {
      shown.spec = spec;
      els.specBar.classList.toggle('show', !!spec);
      body.classList.toggle('spectating', !!spec);
      if (spec) els.specName.textContent = spec;
    }
    const low = h.alive && h.hp === 1;
    if (low !== shown.low) { shown.low = low; els.fxLow.classList.toggle('on', low); }
    const warp = h.buffs.timewarp > 0;
    if (warp !== shown.warp) { shown.warp = warp; els.fxWarp.classList.toggle('on', warp); }

    // weapon + power
    if (h.weapon !== shown.weapon) {
      Array.from(els.pips.children).forEach((p, i) => {
        const was = p.classList.contains('on');
        p.classList.toggle('on', i < h.weapon);
        if (!was && i < h.weapon && shown.weapon !== -1) retrigger(p, 'new');
      });
      shown.weapon = h.weapon;
    }
    if (h.power !== shown.power) {
      shown.power = h.power;
      els.power.textContent = h.power > 1.001 ? `+${Math.round((h.power - 1) * 100)}%` : '';
    }

    // wave + progress
    if (h.wave !== shown.wave) {
      shown.wave = h.wave;
      const tag = h.tier && TIER[h.tier] ? ` <i class="hud-tier ${h.tier}">☠ ${TIER[h.tier].name}</i>` : '';
      els.wave.innerHTML = (h.wave > 0 ? `WAVE <b>${h.wave}</b>` : 'GET READY') + tag;
    }
    const prog = h.waveProg < 0 ? -1 : Math.round(h.waveProg * 100) / 100;
    if (prog !== shown.prog) {
      shown.prog = prog;
      els.waveProg.classList.toggle('on', prog >= 0);
      if (prog >= 0) els.waveFill.style.transform = `scaleX(${prog})`;
    }

    // abilities
    setP(els.abDash, h.dash);
    els.abDash.classList.toggle('ready', h.dash >= 1);
    setP(els.abNova, h.nova / 100);
    els.abNova.classList.toggle('ready', h.nova >= 100);

    updatePowers(h);

    // boss
    if (h.boss >= 0) {
      const v = Math.max(0, h.boss);
      els.bossFill.style.transform = `scaleX(${v.toFixed(4)})`;
      bossLagV = v >= bossLagV ? v : Math.max(v, bossLagV - dt * 0.35);
      els.bossLag.style.transform = `scaleX(${bossLagV.toFixed(4)})`;
      els.bossBar.classList.toggle('enraged', h.bossPhase === 3);
      els.bossBar.classList.toggle('armored', h.bossArmor);
      const sh = Math.round(h.bossShield * 200) / 200;
      if (sh !== shown.bossShield) {
        shown.bossShield = sh;
        els.bossShield.style.transform = `scaleX(${sh})`;
        els.bossBar.classList.toggle('shielded', sh > 0);
      }
      if (h.bossHp !== shown.bossHp) {
        shown.bossHp = h.bossHp;
        els.bossHpText.textContent = `${fmt(h.bossHp)} / ${fmt(h.bossMaxHp)}`;
      }
      if (h.bossStatus !== shown.bossStatus) {
        shown.bossStatus = h.bossStatus;
        els.bossStatus.textContent = h.bossStatus;
        els.bossStatus.className = 'boss-status' + (h.bossStatus.startsWith('STUN') ? ' stun' : h.bossStatus === 'BERSERK' || h.bossStatus === 'LAST STAND' ? ' rage' : '');
      }
    }

    // fps
    fpsT -= dt;
    if (fpsT <= 0) {
      fpsT = 0.5;
      els.fps.textContent = Settings.get('showFps') ? `${h.fps} FPS` : '';
    }
  }

  function bossBar(on, name, phases) {
    els.bossBar.classList.toggle('show', !!on);
    if (on) {
      els.bossName.textContent = name || 'BOSS';
      bossLagV = 1;
      els.bossFill.style.transform = 'scaleX(1)';
      els.bossLag.style.transform = 'scaleX(1)';
      els.bossShield.style.transform = 'scaleX(0)';
      els.bossBar.classList.remove('enraged', 'armored', 'shielded');
      // tick marks where the boss changes phase (and where Last Stand kicks in)
      els.bossTicks.innerHTML = (phases || []).concat(0.1).map((p) => `<b style="left:${p * 100}%"></b>`).join('');
      Object.assign(shown, { bossShield: -1, bossHp: -1, bossStatus: null });
    }
  }
  function letterbox(on) { $('letterbox').classList.toggle('on', !!on); }

  // ================================================================ feedback
  function flash(kind) {
    const el = kind === 'white' ? $('fxWhite') : kind === 'gold' ? $('fxGold') : $('fxHurt');
    retrigger(el, 'hit');
  }

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

  // trophies pop up one at a time
  const trophyQueue = [];
  let trophyBusy = false;
  function nextTrophy() {
    const t = trophyQueue.shift();
    if (!t) { trophyBusy = false; return; }
    trophyBusy = true;
    const el = $('trophyToast');
    el.innerHTML = `<img src="${t.icon}" alt=""><div><small>TROPHY UNLOCKED</small><b>${t.name}</b></div>`;
    el.classList.add('show');
    Sfx.play('trophy');
    setTimeout(() => { el.classList.remove('show'); setTimeout(nextTrophy, 400); }, 2600);
  }
  function onTrophy(t) {
    trophyQueue.push(t);
    if (!trophyBusy) nextTrophy();
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
        ? ['<b>THUMB STICK</b> steer', '<b>FLICK</b> other side = dash', '<b>DOUBLE-TAP</b> = nova']
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
    stack = [];
    show(null);
    els.hearts.innerHTML = '';
    for (const key in chips) { chips[key].remove(); delete chips[key]; }
    Object.assign(shown, { score: -1, comboOn: false, mult: 0, combo: -1, hp: -1, maxHp: -1, weapon: -1, power: -1, wave: -1, low: false, prog: -2, totem: null, warp: false, spec: '' });
    dispScore = 0;
    lastScore = 0;
    els.combo.classList.remove('on');
    els.fxLow.classList.remove('on');
    els.fxWarp.classList.remove('on');
    bossBar(false);
    letterbox(false);
    $('banner').className = 'banner';
    els.hud.classList.add('show');
    hideSpec();
    specOn = false;
    body.classList.add('playing');
    if (Scores.lifetime().runs < 6) showHint();
  }
  function showPause(info) {
    $('pauseWave').textContent = info.wave || 1;
    $('pauseScore').textContent = fmt(info.score);
    const hc = info.mode === 'hardcore' && TIER[info.tier];
    $('pauseDiff').textContent = `${info.mp ? 'CO-OP · ' : ''}${hc ? `☠ ${hc.name}` : DIFF_LABEL[info.difficulty] || 'NORMAL'} · ${info.hearts}♥`;
    const cp = !hc && !info.mp && Checkpoint.get();
    $('btnRestart').textContent = hc ? 'RESTART FROM WAVE 1' : cp ? `LAST CHECKPOINT · WAVE ${cp.wave}` : 'RESTART';
    // co-op: the run belongs to the whole team, so there's no restart, only leaving
    $('btnRestart').classList.toggle('hidden', !!info.mp);
    $('btnPauseMenu').textContent = info.mp ? 'LEAVE GAME' : 'MAIN MENU';
    $('btnPauseMenu').dataset.act = info.mp ? 'leaveRoom' : 'menu';
    $('pauseMpNote').classList.toggle('hidden', !info.mp);
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
    els.fxWarp.classList.remove('on');
    letterbox(false);
    $('overNew').classList.toggle('hidden', !r.isBest);
    $('overBest').classList.toggle('hidden', r.isBest);
    $('overBest').textContent = 'BEST ' + fmt(r.best);
    const rank = r.score >= 60000 ? 'S' : r.score >= 30000 ? 'A' : r.score >= 12000 ? 'B' : r.score >= 4000 ? 'C' : 'D';
    const rk = $('overRank');
    rk.textContent = rank;
    rk.dataset.rank = rank;
    const mins = Math.floor(r.time / 60);
    const secs = String(Math.floor(r.time % 60)).padStart(2, '0');
    const hc = r.mode === 'hardcore' && TIER[r.tier];
    const stats = [
      ['WAVE', r.wave], ['MOBS', fmt(r.kills)], ['BOSSES', r.bosses],
      ['MAX COMBO', r.maxCombo], ['TIME', `${mins}:${secs}`], ['MODE', hc ? '☠ ' + hc.name : DIFF_LABEL[r.difficulty] || 'NORMAL'],
    ];
    $('overPrimary').textContent = r.mp ? 'BACK TO LOBBY' : hc ? 'TRY AGAIN' : r.checkpoint ? `CONTINUE · WAVE ${r.checkpoint.wave}` : 'PLAY AGAIN';
    $('overPrimary').dataset.act = r.mp ? 'lobbyBack' : 'restart';
    $('overSecondary').textContent = r.mp ? 'LEAVE ROOM' : 'MAIN MENU';
    $('overSecondary').dataset.act = r.mp ? 'leaveRoom' : 'menu';
    $('scrOver').querySelector('.over-title').textContent = r.mp ? 'TEAM WIPED OUT' : 'SHIP DESTROYED';
    specOn = false;
    hideSpec();
    $('overStats').innerHTML = stats.map(([l, v], i) => `<div class="stat" style="--i:${i}"><small>${l}</small><b>${v}</b></div>`).join('');
    $('overTrophiesWrap').classList.toggle('hidden', !r.trophies.length);
    $('overTrophies').innerHTML = r.trophies.map((t, i) => `<span style="animation-delay:${400 + i * 90}ms"><img src="${t.icon}" alt="">${t.name}</span>`).join('');
    $('overBoard').innerHTML = r.top.length
      ? r.top.map((e, i) => {
        const t = TIER[e.mode];
        const tag = e.mode === 'coop' ? '<span class="dtag coop">CO-OP</span>'
          : t ? `<span class="dtag hc ${t.id}">☠${t.name}</span>` : `<span class="dtag ${e.diff || 'normal'}">${(DIFF_LABEL[e.diff] || 'NORMAL').slice(0, 4)}</span>`;
        return `<li class="${e === r.entry ? 'me' : ''}"><span>#${i + 1}</span><span>${fmt(e.score)}</span>${tag}<span>W${e.wave}</span></li>`;
      }).join('')
      : '<li class="empty">NO SCORES YET</li>';
    $('overScore').textContent = '0';
    show('over');
    countUp($('overScore'), r.score, 1400);
    if (r.isBest) confetti();
    refreshMenu();
  }

  // ================================================================ trophies + boss list
  function renderTrophies() {
    $('trophyCount').textContent = `${Trophies.count()}/${Trophies.LIST.length}`;
    $('trophyGrid').innerHTML = Trophies.LIST.map((t) => {
      const got = Trophies.has(t.id);
      const prog = got ? '' : Trophies.progress(t.id);
      return `<div class="trophy ${got ? 'got' : 'locked'}"><img src="${t.icon}" alt=""><div><b>${got ? '★ ' : ''}${t.name}</b><p>${t.desc}</p>${prog ? `<small>${prog}</small>` : ''}</div></div>`;
    }).join('');
  }
  // ================================================================ modes
  function renderModes() {
    const cp = Checkpoint.get();
    $('modeArcadeFoot').textContent = cp ? `⚑ CHECKPOINT · WAVE ${cp.wave} · ${fmt(cp.score)} PTS` : 'NO CHECKPOINT YET';
    $('modeArcadeFoot').classList.toggle('on', !!cp);
  }
  function renderArcade() {
    const cp = Checkpoint.get();
    const cont = $('cpCard').querySelector('[data-act=continue]');
    const ng = $('btnNewGame');
    $('cpCard').classList.toggle('hidden', !cp);
    $('cpNone').classList.toggle('hidden', !!cp);
    ng.classList.toggle('btn-primary', !cp);
    ng.classList.remove('armed');
    ng.textContent = 'NEW GAME';
    cont.toggleAttribute('data-autofocus', !!cp);
    ng.toggleAttribute('data-autofocus', !cp);
    if (!cp) return;
    $('cpDiff').textContent = DIFF_LABEL[cp.diff] || 'NORMAL';
    $('cpDiff').className = 'diff-tag ' + (cp.diff || 'normal');
    const weapon = cp.weapon >= 5 ? `MAX · ${Math.round((cp.power || 1) * 100)}%` : `LV ${cp.weapon}`;
    const cells = [['WAVE', cp.wave], ['SCORE', fmt(cp.score)], ['HEARTS', `${cp.maxHp} ♥`], ['WEAPON', weapon]];
    if (cp.totem) cells.push(['TOTEM', '✓']);
    $('cpStats').innerHTML = cells.map(([l, v]) => `<span><small>${l}</small><b>${v}</b></span>`).join('');
    const list = Game.bossList();
    const next = list.length ? list[cp.bossLevel % list.length] : null;
    const mark = list.length ? Math.floor(cp.bossLevel / list.length) + 1 : 1;
    $('cpNext').innerHTML = next
      ? `Next boss: <b>${next.name}${mark > 1 ? ' MK ' + (ROMAN[mark - 1] || mark) : ''}</b> at wave ${Math.ceil(cp.wave / 5) * 5}`
      : '';
  }
  function renderHardcore() {
    $('tierList').innerHTML = HARDCORE_TIERS.map((t, i) => {
      const best = Scores.bestFor(t.id);
      const hearts = '<img src="heart.png" alt="">'.repeat(t.hearts);
      return `<button class="tier ${t.id}" data-act="tier" data-tier="${t.id}"${i === 0 ? ' data-autofocus' : ''}>`
        + `<span class="tier-top"><span class="tier-name">${t.name}</span><span class="tier-hearts" aria-label="${t.hearts} hearts">${hearts}</span></span>`
        + `<span class="tier-desc">${t.desc}</span>`
        + `<span class="tier-foot"><span class="tier-bonus">SCORE ×${t.bonus}</span>`
        + `<span class="tier-best">${best ? `BEST ${fmt(best.score)} · WAVE ${best.wave}` : 'NOT PLAYED YET'}</span>`
        + `${Trophies.has(t.id) ? '<span class="tier-won">★ BOSS BEATEN</span>' : ''}</span></button>`;
    }).join('');
  }

  // ================================================================ multiplayer (see net.js)
  const NET_ERRORS = {
    nolib: 'Online play could not load. Check your internet connection and reload the game.',
    network: "Can't reach the multiplayer service. Check your internet connection and try again.",
    timeout: 'The connection timed out. Check your internet connection and try again.',
    taken: 'A room with this name and password is already open. Pick another room name.',
    noroom: 'No room found with that name and password. Check both and try again.',
    password: 'Wrong password.',
    full: 'That room is full.',
    started: 'That game has already started. Try again when it finishes.',
    version: "Your game version doesn't match the host's. Everyone needs the latest version.",
    browser: "This browser doesn't support online play.",
    closed: 'The room closed the connection.',
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function prefill(formId) {
    const f = $(formId);
    if (!f.elements.name.value) f.elements.name.value = Settings.get('mpName') || '';
    if (!f.elements.room.value && Settings.get('mpRoom')) f.elements.room.value = Settings.get('mpRoom');
    f.querySelector('[data-status]').textContent = '';
    f.querySelector('[data-status]').className = 'form-status';
  }
  function formStatus(f, text, kind = '') {
    const st = f.querySelector('[data-status]');
    st.textContent = text;
    st.className = `form-status ${kind}`;
  }
  async function submitNet(e, create) {
    e.preventDefault();
    const f = e.currentTarget;
    const room = Net.cleanRoom(f.elements.room.value);
    const name = Net.cleanName(f.elements.name.value);
    const password = f.elements.password.value;
    if (room.length < 3) { formStatus(f, 'The room name needs at least 3 letters or numbers.', 'bad'); f.elements.room.focus(); return; }
    if (!name) { formStatus(f, 'Enter a username.', 'bad'); f.elements.name.focus(); return; }
    if (password.length < 4) { formStatus(f, 'The password needs at least 4 characters.', 'bad'); f.elements.password.focus(); return; }
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    formStatus(f, create ? 'CREATING ROOM…' : 'FINDING ROOM…', 'busy');
    Sfx.unlock();
    try {
      if (create) await Net.create({ room, name, password, skin: Settings.get('skin') });
      else await Net.join({ room, name, password, skin: Settings.get('skin') });
      Settings.set('mpName', name);
      Settings.set('mpRoom', room);
      f.elements.password.value = '';
      formStatus(f, '');
      Sfx.play('power');
      showLobby();
    } catch (err) {
      formStatus(f, NET_ERRORS[err && err.code] || NET_ERRORS.network, 'bad');
      Sfx.play('hurt');
    } finally {
      btn.disabled = false;
    }
  }
  const lobbySeen = new Set();
  function showLobby() {
    stack = [];
    lobbySeen.clear();
    renderLobby();
    show('lobby');
  }
  function renderLobby() {
    const host = Net.role === 'host';
    const s = Net.settings;
    const roster = Net.roster;
    $('lobbyRoom').textContent = Net.room.toUpperCase();
    $('lobbyCount').textContent = `${roster.length}/${s.max}`;
    $('lobbyShare').innerHTML = host
      ? 'Share the <b>room name</b> and <b>password</b> with your friends so they can join, then press <b>START</b>.'
      : 'You\'re in! The host picks the settings and starts the game.';
    const skinImg = (id) => (typeof SKINS !== 'undefined' && (SKINS.find((k) => k.id === id) || SKINS[0]).img) || 'player.png';
    let html = roster.map((r) => {
      const meTag = r.pid === Net.myPid ? '<i class="tag you">YOU</i>' : '';
      const hostTag = r.host ? '<i class="tag host">HOST</i>' : '';
      const ping = r.host ? '' : `<small class="ping ${r.ping > 250 ? 'bad' : r.ping > 120 ? 'mid' : ''}">${r.ping ? r.ping + ' MS' : '…'}</small>`;
      const kick = host && !r.host ? `<button class="kick" data-act="kick" data-pid="${r.pid}" aria-label="Remove ${esc(r.name)}">✕</button>` : '';
      // only newly arrived players slide in (the list refreshes every couple of seconds with pings)
      const fresh = !lobbySeen.has(`${r.pid}:${r.name}`);
      return `<li class="lp${fresh ? ' new' : ''}" style="--pc:${Net.color(r.pid)}"><img src="${esc(skinImg(r.skin))}" alt=""><b>${esc(r.name)}</b>${hostTag}${meTag}${ping}${kick}</li>`;
    }).join('');
    lobbySeen.clear();
    for (const r of roster) lobbySeen.add(`${r.pid}:${r.name}`);
    for (let i = roster.length; i < s.max; i++) html += '<li class="lp empty"><span class="slot-ring"></span><b>WAITING FOR PLAYER…</b></li>';
    $('lobbyList').innerHTML = html;
    // settings: the host edits, everyone else sees them
    const box = $('lobbySettings');
    box.classList.toggle('readonly', !host);
    $('lobbyHostOnly').classList.toggle('hidden', host);
    box.querySelectorAll('.seg[data-lobby]').forEach((seg) => {
      const v = String(s[seg.dataset.lobby]);
      seg.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.val === v));
        b.disabled = !host || (seg.dataset.lobby === 'max' && +b.dataset.val < roster.length);
      });
    });
    const hearts = box.querySelector('[data-lobby=hearts]');
    hearts.value = s.hearts;
    hearts.disabled = !host;
    hearts.style.setProperty('--v', ((s.hearts - 1) / 9) * 100 + '%');
    $('lobbyHeartsOut').textContent = `${s.hearts} ♥`;
    box.querySelectorAll('.lob-arcade').forEach((el) => el.classList.toggle('hidden', s.mode !== 'arcade'));
    box.querySelectorAll('.lob-hardcore').forEach((el) => el.classList.toggle('hidden', s.mode !== 'hardcore'));
    const tier = TIER[s.tier];
    $('lobbyRules').innerHTML = s.mode === 'hardcore'
      ? `<b>${tier.name}:</b> ${esc(tier.desc)} Always on HARD. <b>No respawns</b>: a downed player spectates until the run ends.`
      : `Downed players <b>rejoin at the start of the next wave</b>. It's game over when the whole team is down. Mob and boss health grow with the team.`;
    $('btnLobbyStart').classList.toggle('hidden', !host);
    $('lobbyWait').classList.toggle('hidden', host);
    $('lobbyWait').textContent = Net.phase === 'game' ? 'THE HOST IS STILL IN THE LAST RUN…' : 'WAITING FOR THE HOST TO START…';
  }
  function initLobby() {
    $('formCreate').addEventListener('submit', (e) => submitNet(e, true));
    $('formJoin').addEventListener('submit', (e) => submitNet(e, false));
    document.querySelectorAll('[data-eye]').forEach((b) => b.addEventListener('click', () => {
      const inp = b.parentElement.querySelector('input');
      inp.type = inp.type === 'password' ? 'text' : 'password';
      b.classList.toggle('on', inp.type === 'text');
    }));
    const box = $('lobbySettings');
    box.querySelectorAll('.seg[data-lobby]').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        if (Net.role !== 'host') return;
        const key = seg.dataset.lobby;
        Net.setSettings({ [key]: key === 'max' ? +b.dataset.val : b.dataset.val });
        Sfx.play('click');
      }));
    });
    const hearts = box.querySelector('[data-lobby=hearts]');
    hearts.addEventListener('input', () => { if (Net.role === 'host') Net.setSettings({ hearts: +hearts.value }); });

    Net.on('lobby', () => {
      // the host finished a run and brought everyone back to the room
      if (Net.role === 'guest' && Net.phase === 'lobby' && Game.net && (Game.state === 'over' || Game.state === 'dying')) {
        leaveGame();
        showLobby();
        return;
      }
      if (current === 'lobby') renderLobby();
    });
    Net.on('joined', (name) => { toast(`${name.toUpperCase()} JOINED`); Sfx.play('pop'); });
    Net.on('dropped', (pid, name, reason) => {
      toast(`${name.toUpperCase()} ${reason === 'kicked' ? 'WAS REMOVED' : 'LEFT'}`);
      if (Game.net) Game.netLeft(pid);
    });
    Net.on('start', (m) => {
      if (!m || !m.world || !Array.isArray(m.roster)) return;
      if (Game.net) leaveGame();
      launchNet('guest', m);
    });
    Net.on('game', (pid, m) => Game.netRecv(pid, m));
    Net.on('ended', (reason) => {
      const inGame = Game.state !== 'menu';
      if (inGame) leaveGame();
      const txt = {
        closed: ['ROOM CLOSED', 'The host closed the room.'],
        kicked: ['REMOVED', 'The host removed you from the room.'],
        lost: ['CONNECTION LOST', 'The connection to the host was lost.'],
      }[reason] || ['DISCONNECTED', 'You left the room.'];
      $('netMsgTitle').textContent = txt[0];
      $('netMsgText').textContent = txt[1];
      stack = [];
      show('netMsg');
    });
    // skins changed in the lobby are shown to the whole room
    Settings.onChange((key, v) => { if (key === 'skin' && Net.role && Net.phase === 'lobby') Net.setSkin(v); });
  }
  function launchNet(role, m) {
    Sfx.unlock();
    stack = [];
    specOn = false;
    show(null);
    if (Settings.isTouch && !document.fullscreenElement) requestFs();
    Game.startNet({
      role, world: m.world, roster: m.roster, mePid: Net.myPid, settings: m.settings,
      send: Net.send, broadcast: Net.broadcast, sendTo: Net.sendTo,
    });
  }
  /** Called by the game when your ship goes down in co-op. */
  function netDown(o) {
    specOn = false;
    $('downText').textContent = o.respawn
      ? "You'll warp back in at the start of the next wave. Watch your team until then, or leave."
      : 'No respawns in Hardcore. Your team fights on. Watch them until the end, or leave.';
    $('specHint').textContent = o.respawn ? 'BACK NEXT WAVE' : 'NO RESPAWNS';
    stack = [];
    show('down');
  }
  function netBack() {
    specOn = false;
    hideSpec();
    if (current === 'down') show(null);
    toast("YOU'RE BACK IN THE FIGHT!");
  }

  // ================================================================ skins
  const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
  function paintSkinStage(s) {
    const prev = $('skinPreview');
    prev.src = s.img;
    prev.style.setProperty('--ar', String(s.ar));
    prev.classList.remove('pop');
    void prev.offsetWidth;
    prev.classList.add('pop');
    $('scrSkins').style.setProperty('--skin', s.glow);
    $('skinName').textContent = s.name;
    $('skinDesc').textContent = s.desc;
  }
  function syncMenuSkin() {
    const s = skinById(Settings.get('skin'));
    $('menuSkin').src = s.img;
  }
  function renderSkins() {
    const cur = Settings.get('skin');
    $('skinCount').textContent = String(SKINS.length);
    $('skinGrid').innerHTML = SKINS.map((s) => `<button class="skin${s.id === cur ? ' on' : ''}" data-skin="${s.id}" style="--skin:${s.glow}" aria-pressed="${s.id === cur}"><img src="${s.img}" alt=""><b>${s.name}</b><span>${s.id === cur ? 'EQUIPPED' : 'EQUIP'}</span></button>`).join('');
    paintSkinStage(skinById(cur));
  }
  function equipSkin(id) {
    if (id === Settings.get('skin')) { Sfx.play('click'); return; }
    Settings.set('skin', id);
    $('skinGrid').querySelectorAll('.skin').forEach((b) => {
      const on = b.dataset.skin === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('span').textContent = on ? 'EQUIPPED' : 'EQUIP';
    });
    paintSkinStage(skinById(id));
    syncMenuSkin();
    Sfx.play('power');
    toast(`${skinById(id).name} EQUIPPED`);
  }
  function initSkins() {
    $('skinGrid').addEventListener('click', (e) => {
      const b = e.target.closest('.skin');
      if (b) equipSkin(b.dataset.skin);
    });
    $('skinGrid').addEventListener('focusin', (e) => {
      const b = e.target.closest('.skin');
      if (b) paintSkinStage(skinById(b.dataset.skin));
    });
    $('skinGrid').addEventListener('focusout', (e) => {
      if (!$('skinGrid').contains(e.relatedTarget)) paintSkinStage(skinById(Settings.get('skin')));
    });
    syncMenuSkin();
  }

  function renderBosses() {
    $('bossCards').innerHTML = Game.bossList().map((b) => `<div class="card"><img src="${b.img}.png" alt=""><div><b>${b.name}<span class="tag lvl">WAVE ${b.wave}</span></b><p>${b.desc}</p></div></div>`).join('');
  }

  // ================================================================ settings
  function paintRange(el) {
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);
    const v = parseFloat(el.value);
    el.style.setProperty('--v', ((v - min) / (max - min)) * 100 + '%');
    const key = el.dataset.set;
    const text = key === 'sensitivity' ? v.toFixed(2) + 'x' : key === 'hearts' ? `${v} ♥` : Math.round(v * 100) + '%';
    document.querySelectorAll(`[data-out="${key}"]`).forEach((out) => { out.textContent = text; });
  }
  function syncSetting(key) {
    document.querySelectorAll(`[data-set="${key}"]`).forEach((el) => {
      const v = Settings.get(key);
      if (el.type === 'range') { el.value = v; paintRange(el); }
      else if (el.classList.contains('toggle')) el.setAttribute('aria-checked', String(!!v));
      else if (el.classList.contains('seg')) el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === v)));
    });
    if (key === 'lefty') body.classList.toggle('lefty', !!Settings.get('lefty'));
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
    });
    ['music', 'sfx', 'hearts', 'sensitivity', 'autoFire', 'shake', 'vibration', 'difficulty', 'touchScheme', 'lefty', 'quality', 'showFps'].forEach(syncSetting);
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
      if (SUB_SCREENS.includes(current)) {
        e.preventDefault();
        e.stopPropagation();
        back();
        Sfx.play('click');
      }
      return;
    }
    const a = document.activeElement;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (a && a.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // sliders + text cursor
      e.preventDefault();
      moveFocus(e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (e.key === 'Enter' && current === 'menu' && !(a && screens.menu.contains(a))) {
      e.preventDefault();
      open('modes');
    }
  }
  function onMenuNav(a) {
    if (Intro.active) { Intro.poke(); return; }
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
        else if (SUB_SCREENS.includes(current)) back();
        break;
      case 'start':
        if (current === 'pause') Game.resume();
        else if (current === 'menu') open('modes');
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
    Trophies.onUnlock(onTrophy);

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
    initSkins();
    initLobby();
    syncMute();
    refreshMenu();
    Logo.mount($('menuLogo'), $('menuShine'));
    // assets load while the studio splash plays
    const ready = (async () => {
      await Game.load((p) => Intro.progress(p));
      if (document.fonts && document.fonts.load) {
        try { await Promise.race([document.fonts.load('12px "Press Start 2P"'), wait(1500)]); } catch (_) { /* offline */ }
      }
      Game.init();
      renderBosses();
    })();
    const hash = location.hash;
    await Intro.run(ready, { skip: hash === '#play' || hash === '#about' || hash === '#nointro' });
    Sfx.music('menu');
    show('menu');
    if (hash === '#play') setTimeout(startGame, 250);
    else if (hash === '#about') open('about');
  }

  boot();

  return {
    get current() { return current; },
    frame, bossBar, letterbox, banner, toast, flash, denied, syncMute,
    onStart, onResume, showPause, showGameOver, netDown, netBack,
  };
})();
