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
    trophies: $('scrTrophies'), skins: $('scrSkins'), pets: $('scrPets'), pause: $('scrPause'), over: $('scrOver'),
    modes: $('scrModes'), variant: $('scrVariant'), arcade: $('scrArcade'), hardcore: $('scrHardcore'),
    mp: $('scrMp'), create: $('scrCreate'), join: $('scrJoin'), lobby: $('scrLobby'), down: $('scrDown'), netMsg: $('scrNetMsg'),
    relay: $('scrRelay'),
  };
  const SUB_SCREENS = ['how', 'settings', 'about', 'trophies', 'skins', 'pets', 'modes', 'variant', 'arcade', 'hardcore', 'mp', 'create', 'join', 'relay'];
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
    if (name === 'mp') renderRelayLine(); // also when coming back from CONNECTION SETUP
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
    if (name === 'pets') renderPets();
    if (name === 'modes') renderModes();
    if (name === 'variant') renderVariant();
    if (name === 'arcade') renderArcade();
    if (name === 'hardcore') renderHardcore();
    if (name === 'relay') renderRelay();
    if (name === 'mp') renderRelayLine();
    stack.push(current);
    show(name);
    if ((name === 'skins' || name === 'pets') && keyNav) {
      setTimeout(() => {
        const on = $(name === 'skins' ? 'skinGrid' : 'petGrid').querySelector('.skin.on');
        if (on && current === name) on.focus({ preventScroll: true });
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
    const cp = Checkpoint.latest();
    $('menuModeLine').innerHTML = cp
      ? `<button class="mode-pill" data-act="continueLatest">▶ CONTINUE ${gameOf(cp.game).name} · ${cpWhere(cp)}</button>`
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

  /** opts: { game, mode: 'classic' | 'hardcore', tier, checkpoint } (see Game.start) */
  function startGame(opts) {
    Sfx.unlock();
    stack = [];
    show(null);
    if (Settings.isTouch && !document.fullscreenElement) requestFs();
    Game.start(opts || { game: 'arcade', mode: 'classic' });
  }
  /** Play the same kind of run again: Hardcore restarts the tier, Classic goes back to the game's last checkpoint. */
  function retry() {
    const r = Game.run;
    if (r.mode === 'hardcore') { startGame({ game: r.game, mode: 'hardcore', tier: r.tier }); return; }
    const cp = Checkpoint.get(r.game);
    startGame(cp ? { game: r.game, mode: 'classic', checkpoint: cp } : { game: r.game, mode: 'classic' });
  }
  /** Where a checkpoint stands, in the words of its game: WAVE 11 · BOSS 4 · RAID 3. */
  function cpWhere(cp) {
    const g = gameOf(cp.game);
    return `${g.unit} ${cp.game === 'raid' ? Math.ceil(cp.wave / 5) : cp.wave}`;
  }

  const skinOf = (id) => (typeof SKINS !== 'undefined' && (SKINS.find((s) => s.id === id) || SKINS[0])) || null;
  const ultColor = (s) => (s.ult.id === 'nova' ? '#ff4fd8' : s.glow === '#ffffff' ? '#ffb0b0' : s.glow);
  /** The dash and special buttons show your skin's own abilities. */
  function paintAbilities(id) {
    const s = skinOf(id);
    if (!s || typeof ABILITY_ICONS === 'undefined') return;
    els.abDash.innerHTML = `${ABILITY_ICONS[s.move.id] || ''}<kbd>SHIFT</kbd>`;
    els.abNova.innerHTML = `${ABILITY_ICONS[s.ult.id] || ''}<kbd>B</kbd>`;
    els.abDash.setAttribute('aria-label', s.move.name);
    els.abNova.setAttribute('aria-label', s.ult.name);
    els.abDash.title = `${s.move.name} (SHIFT)`;
    els.abNova.title = `${s.ult.name} (B)`;
    els.abNova.dataset.ult = s.ult.id;
    els.abNova.style.setProperty('--c', ultColor(s));
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

  let pickedGame = 'arcade'; // the game chosen on the SELECT GAME screen
  let resetArmed = 0;
  let newArmed = 0;
  let specOn = false;
  const actions = {
    play: () => open('modes'),
    game: (btn) => { pickedGame = btn.dataset.game; open('variant'); },
    classic: () => open('arcade'),
    hardcore: () => open('hardcore'),
    tier: (btn) => startGame({ game: pickedGame, mode: 'hardcore', tier: btn.dataset.tier }),
    continue: () => {
      const cp = Checkpoint.get(pickedGame);
      if (cp) startGame({ game: pickedGame, mode: 'classic', checkpoint: cp });
    },
    continueLatest: () => {
      const cp = Checkpoint.latest();
      if (cp) startGame({ game: cp.game, mode: 'classic', checkpoint: cp });
    },
    newgame: (btn) => {
      // starting over erases the checkpoint, so ask once
      if (Checkpoint.get(pickedGame) && Date.now() - newArmed > 2500) {
        newArmed = Date.now();
        btn.textContent = 'ERASE CHECKPOINT & START?';
        btn.classList.add('armed');
        setTimeout(() => { btn.textContent = 'NEW GAME'; btn.classList.remove('armed'); }, 2500);
        return;
      }
      newArmed = 0;
      Checkpoint.clear(pickedGame);
      startGame({ game: pickedGame, mode: 'classic' });
    },
    restart: retry,
    how: () => open('how'),
    settings: () => open('settings'),
    about: () => open('about'),
    trophies: () => open('trophies'),
    skins: () => open('skins'),
    pets: () => open('pets'),
    back,
    resume: () => Game.resume(),
    menu: () => { leaveGame(); show('menu'); },

    // ---- multiplayer
    mp: () => open('mp'),
    mpCreate: () => { prefill('formCreate'); open('create'); },
    mpJoin: () => { prefill('formJoin'); open('join'); },
    relay: () => open('relay'),
    relayTest: () => runRelayTest(),
    relayClear: () => {
      Settings.set('relay', null);
      $('formRelay').reset();
      renderRelay();
      formStatus($('formRelay'), 'Relay removed. Only direct connections will be used.', '');
      Sfx.play('click');
    },
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
  const shown = { score: -1, comboOn: false, mult: 0, combo: -1, hp: -1, maxHp: -1, weapon: -1, power: -1, wave: -1, low: false, prog: -2, totem: null, warp: false, spec: '', skin: '', village: -2 };
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
      let txt = `WAVE <b>${h.wave}</b>`;
      if (h.game === 'bossrush') txt = `BOSS <b>${h.wave}</b>`;
      else if (h.game === 'raid') { const w = ((h.wave - 1) % 5) + 1; txt = `RAID <b>${Math.ceil(h.wave / 5)}</b> · ${w === 5 ? 'CAPTAIN' : `WAVE ${w}/4`}`; }
      els.wave.innerHTML = (h.wave > 0 ? txt : 'GET READY') + tag;
    }
    // Village Raid: the village's health
    const vil = h.village >= 0 ? Math.round(h.village * 100) / 100 : -1;
    if (vil !== shown.village) {
      const hit = vil >= 0 && shown.village >= 0 && vil < shown.village;
      shown.village = vil;
      $('hudVillage').classList.toggle('hidden', vil < 0);
      if (vil >= 0) {
        $('villageFill').style.transform = `scaleX(${vil})`;
        $('villageHp').textContent = h.villageHp;
        $('hudVillage').classList.toggle('low', vil <= 0.3);
        if (hit) retrigger($('hudVillage'), 'hit');
      }
    }
    const prog = h.waveProg < 0 ? -1 : Math.round(h.waveProg * 100) / 100;
    if (prog !== shown.prog) {
      shown.prog = prog;
      els.waveProg.classList.toggle('on', prog >= 0);
      if (prog >= 0) els.waveFill.style.transform = `scaleX(${prog})`;
    }

    // abilities: the two buttons belong to your skin
    if (h.skin !== shown.skin) { shown.skin = h.skin; paintAbilities(h.skin); }
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
    // your skin's own abilities
    const s = skinOf(Settings.get('skin'));
    const mv = s ? s.move.name.toLowerCase() : 'dash';
    const ul = s ? s.ult.name.toLowerCase() : 'nova';
    let items;
    if (dev === 'touch') {
      items = Settings.get('touchScheme') === 'joystick'
        ? ['<b>THUMB STICK</b> steer', `<b>FLICK</b> other side = ${mv}`, `<b>DOUBLE-TAP</b> = ${ul}`]
        : ['<b>DRAG</b> anywhere to fly', `<b>FLICK</b> = ${mv}`, `<b>2-FINGER TAP</b> = ${ul}`];
    } else if (dev === 'gamepad') {
      items = ['<b>L-STICK</b> fly', `<b>B</b> ${mv}`, `<b>X</b> ${ul}`, '<b>START</b> pause'];
    } else {
      items = ['<b>WASD</b> fly', `<b>SHIFT</b> ${mv}`, `<b>B</b> ${ul}`, '<b>HOLD CLICK</b> mouse fly', '<b>F</b> auto-fire'];
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
    Object.assign(shown, { score: -1, comboOn: false, mult: 0, combo: -1, hp: -1, maxHp: -1, weapon: -1, power: -1, wave: -1, low: false, prog: -2, totem: null, warp: false, spec: '', skin: '', village: -2 });
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
    const g = gameOf(info.game);
    $('pauseDiff').textContent = `${info.mp ? 'CO-OP · ' : ''}${g.id !== 'arcade' ? g.short + ' · ' : ''}${hc ? `☠ ${hc.name}` : DIFF_LABEL[info.difficulty] || 'NORMAL'} · ${info.hearts}♥`;
    const cp = !hc && !info.mp && Checkpoint.get(info.game);
    $('btnRestart').textContent = hc ? 'START OVER' : cp ? `LAST CHECKPOINT · ${cpWhere(cp)}` : 'RESTART';
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
    const g = gameOf(r.game);
    const where = cpWhere({ game: g.id, wave: r.wave }).split(' ');
    const stats = [
      [where[0], where[1]], [g.id === 'bossrush' ? 'GAME' : 'MOBS', g.id === 'bossrush' ? 'RUSH' : fmt(r.kills)], ['BOSSES', r.bosses],
      ['MAX COMBO', r.maxCombo], ['TIME', `${mins}:${secs}`], ['MODE', hc ? '☠ ' + hc.name : DIFF_LABEL[r.difficulty] || 'NORMAL'],
    ];
    $('overPrimary').textContent = r.mp ? 'BACK TO LOBBY' : hc ? 'TRY AGAIN' : r.checkpoint ? `CONTINUE · ${cpWhere(r.checkpoint)}` : 'PLAY AGAIN';
    $('overPrimary').dataset.act = r.mp ? 'lobbyBack' : 'restart';
    $('overSecondary').textContent = r.mp ? 'LEAVE ROOM' : 'MAIN MENU';
    $('overSecondary').dataset.act = r.mp ? 'leaveRoom' : 'menu';
    $('scrOver').querySelector('.over-title').textContent = r.fell ? 'VILLAGE LOST' : r.mp ? 'TEAM WIPED OUT' : 'SHIP DESTROYED';
    specOn = false;
    hideSpec();
    $('overStats').innerHTML = stats.map(([l, v], i) => `<div class="stat" style="--i:${i}"><small>${l}</small><b>${v}</b></div>`).join('');
    $('overTrophiesWrap').classList.toggle('hidden', !r.trophies.length);
    $('overTrophies').innerHTML = r.trophies.map((t, i) => `<span style="animation-delay:${400 + i * 90}ms"><img src="${t.icon}" alt="">${t.name}</span>`).join('');
    $('overBoard').innerHTML = r.top.length
      ? r.top.map((e, i) => {
        // tags look like 'arcade', 'extreme', 'bossrush', 'raid-insane' (see modeTag)
        const [ga, ti] = e.mode && e.mode.includes('-') ? e.mode.split('-') : GAMES.some((x) => x.id === e.mode) ? [e.mode, null] : ['arcade', e.mode];
        const t = TIER[ti];
        const pre = ga !== 'arcade' ? `${gameOf(ga).short} ` : '';
        const tag = e.mode === 'coop' ? '<span class="dtag coop">CO-OP</span>'
          : t ? `<span class="dtag hc ${t.id}">${pre}☠${pre ? t.name.slice(0, 3) : t.name}</span>` : `<span class="dtag ${e.diff || 'normal'}">${pre}${(DIFF_LABEL[e.diff] || 'NORMAL').slice(0, 4)}</span>`;
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
      // secret trophies stay hidden until you earn them
      const hide = t.secret && !got;
      return `<div class="trophy ${got ? 'got' : 'locked'}${hide ? ' secret' : ''}"><img src="${t.icon}" alt=""><div><b>${got ? '★ ' : ''}${hide ? '???' : t.name}</b><p>${hide ? t.hint : t.desc}</p>${prog ? `<small>${prog}</small>` : ''}</div></div>`;
    }).join('');
  }
  // ================================================================ modes
  // SELECT GAME (Arcade / Boss Rush / Village Raid) → CLASSIC or HARDCORE → checkpoint / tier
  const GAME_IC = {
    arcade: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM7 10h4v4H7zM13 10h4v4h-4z" opacity=".55"/><path d="M12 15l5 6H7z"/></svg>',
    bossrush: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4.5 3.5L12 4l4.5 6.5L21 7l-2 11H5z"/><rect x="5" y="19" width="14" height="2" rx="1"/></svg>',
    raid: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg>',
  };
  function renderModes() {
    $('gameGrid').innerHTML = GAMES.map((g, i) => {
      const cp = Checkpoint.get(g.id);
      const best = Scores.bestFor(modeTag(g.id, null));
      const foot = cp ? `⚑ CHECKPOINT · ${cpWhere(cp)} · ${fmt(cp.score)} PTS` : best ? `BEST ${fmt(best.score)}` : 'NOT PLAYED YET';
      return `<button class="mode-card game ${g.id}" data-act="game" data-game="${g.id}"${(g.id === pickedGame || (!i && !GAMES.some((x) => x.id === pickedGame))) ? ' data-autofocus' : ''}>`
        + `<span class="mode-ic">${GAME_IC[g.id]}</span><span class="mode-name">${g.name}</span><span class="mode-desc">${g.desc}</span>`
        + `<span class="mode-tags">${g.tags.map((t) => `<i>${t}</i>`).join('')}</span><span class="mode-foot${cp ? ' on' : ''}">${foot}</span></button>`;
    }).join('');
  }
  function renderVariant() {
    const g = gameOf(pickedGame);
    const cp = Checkpoint.get(pickedGame);
    $('variantTitle').textContent = g.name;
    $('modeArcadeFoot').textContent = cp ? `⚑ CHECKPOINT · ${cpWhere(cp)} · ${fmt(cp.score)} PTS` : 'NO CHECKPOINT YET';
    $('modeArcadeFoot').classList.toggle('on', !!cp);
    $('modeHcDesc').textContent = `No saves: die and you start ${pickedGame === 'bossrush' ? 'again from the first boss' : pickedGame === 'raid' ? 'again from the first raid' : 'again from wave 1'}. Always on HARD, and you can never gain extra hearts.`;
  }
  function renderArcade() {
    const g = gameOf(pickedGame);
    $('classicTitle').textContent = `${g.name} · CLASSIC`;
    const cp = Checkpoint.get(pickedGame);
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
    const where = cpWhere(cp).split(' ');
    const cells = [[where[0], where[1]], ['SCORE', fmt(cp.score)], ['HEARTS', `${cp.maxHp} ♥`], ['WEAPON', weapon]];
    if (cp.game === 'raid' && cp.village) cells.push(['VILLAGE', `${cp.village}/20`]);
    if (cp.totem) cells.push(['TOTEM', '✓']);
    $('cpStats').innerHTML = cells.map(([l, v]) => `<span><small>${l}</small><b>${v}</b></span>`).join('');
    const list = Game.bossList(pickedGame).filter((b) => !b.secret);
    const next = list.length ? list[cp.bossLevel % list.length] : null;
    const mark = list.length ? Math.floor(cp.bossLevel / list.length) + 1 : 1;
    const when = pickedGame === 'bossrush' ? 'next up' : pickedGame === 'raid' ? `leads raid ${Math.ceil(cp.wave / 5)}` : `at wave ${Math.ceil(cp.wave / 5) * 5}`;
    $('cpNext').innerHTML = next
      ? `${pickedGame === 'raid' ? 'Next captain' : 'Next boss'}: <b>${next.name}${mark > 1 ? ' MK ' + (ROMAN[mark - 1] || mark) : ''}</b> ${when}`
      : '';
  }
  function renderHardcore() {
    $('hcTitle').textContent = `${gameOf(pickedGame).name} · HARDCORE`;
    $('tierList').innerHTML = HARDCORE_TIERS.map((t, i) => {
      const best = Scores.bestFor(modeTag(pickedGame, t.id));
      const hearts = '<img src="heart.png" alt="">'.repeat(t.hearts);
      return `<button class="tier ${t.id}" data-act="tier" data-tier="${t.id}"${i === 0 ? ' data-autofocus' : ''}>`
        + `<span class="tier-top"><span class="tier-name">${t.name}</span><span class="tier-hearts" aria-label="${t.hearts} hearts">${hearts}</span></span>`
        + `<span class="tier-desc">${t.desc}</span>`
        + `<span class="tier-foot"><span class="tier-bonus">SCORE ×${t.bonus}</span>`
        + `<span class="tier-best">${best ? `BEST ${fmt(best.score)} · ${cpWhere({ game: pickedGame, wave: best.wave })}` : 'NOT PLAYED YET'}</span>`
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
    nat: "Found the room, but your two internet connections can't reach each other directly (this is normal between different networks or on mobile data). Set up a free relay server to fix it.",
    natrelay: "Found the room, but couldn't connect even through your relay. Press TEST in CONNECTION SETUP to check it, and ask the host to add a relay too.",
  };
  const RELAY_ERRORS = {
    login: 'The relay answered, but the username or password is wrong.',
    unreachable: "Couldn't reach that relay. Check the address (it should start with turn: or turns:) and your internet connection.",
    link: "Couldn't load that relay link. Check the link (and the API key in it).",
    empty: 'Enter a relay address, or a relay link.',
    address: "That relay address doesn't look right. It should look like turn:relay.example.com:3478",
  };
  /** What's typed in the relay form, as { urls, username, credential, link }. */
  function relayForm() {
    const f = $('formRelay');
    const r = {
      urls: f.elements.urls.value.trim(), username: f.elements.username.value.trim(),
      credential: f.elements.credential.value, link: f.elements.link.value.trim(),
    };
    return r.urls || r.link ? r : null;
  }
  function renderRelay() {
    const saved = Settings.get('relay');
    const f = $('formRelay');
    if (saved && !f.elements.urls.value && !f.elements.link.value) {
      f.elements.urls.value = saved.urls || '';
      f.elements.username.value = saved.username || '';
      f.elements.credential.value = saved.credential || '';
      f.elements.link.value = saved.link || '';
    }
    const shared = typeof NET_CONFIG !== 'undefined' && NET_CONFIG && (NET_CONFIG.relayLink || (NET_CONFIG.relays && NET_CONFIG.relays.length));
    const st = $('relayStatus');
    st.className = `relay-status ${saved || shared ? 'on' : ''}`;
    st.innerHTML = saved
      ? '<b>✓ RELAY SAVED ON THIS DEVICE</b><span>Friends far away can connect.</span>'
      : shared
        ? '<b>✓ RELAY SET BY THE GAME</b><span>netconfig.js has one, so this copy works for far-away friends.</span>'
        : '<b>DIRECT CONNECTIONS ONLY</b><span>Works on the same Wi-Fi. Add a relay to play across different internet connections.</span>';
    if (!f.querySelector('[data-status]').textContent) formStatus(f, '');
  }
  function renderRelayLine() {
    const on = Net.hasRelaySetup();
    const el = $('mpRelayLine');
    el.className = `relay-line ${on ? 'on' : ''}`;
    el.innerHTML = on ? '✓ RELAY READY · FAR-AWAY FRIENDS CAN JOIN' : '⚠ SAME WI-FI ONLY · SET UP A RELAY FOR FAR-AWAY FRIENDS ›';
  }
  async function runRelayTest() {
    const f = $('formRelay');
    const r = relayForm();
    if (!r) { formStatus(f, RELAY_ERRORS.empty, 'bad'); return; }
    formStatus(f, 'TESTING RELAY…', 'busy');
    const res = await Net.testRelay(r);
    if (res.ok) { formStatus(f, `✓ The relay works (answered in ${res.ms} ms). Press SAVE.`, 'good'); Sfx.play('power'); }
    else { formStatus(f, RELAY_ERRORS[res.reason] || RELAY_ERRORS.unreachable, 'bad'); Sfx.play('hurt'); }
    return res.ok;
  }
  async function saveRelay(e) {
    e.preventDefault();
    const f = $('formRelay');
    const r = relayForm();
    if (!r) { formStatus(f, RELAY_ERRORS.empty, 'bad'); return; }
    const okNow = await runRelayTest();
    if (!okNow) return;
    Settings.set('relay', r);
    renderRelay();
    formStatus(f, '✓ Saved. Friends on other networks can now connect to you (and you to them).', 'good');
    toast('RELAY SAVED');
  }
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
    f.querySelector('.relay-fix').classList.add('hidden');
    const slow = create ? 0 : setTimeout(() => { if (btn.disabled) formStatus(f, 'CONNECTING TO THE HOST…', 'busy'); }, 3500);
    Sfx.unlock();
    try {
      if (create) await Net.create({ room, name, password, skin: Settings.get('skin'), pet: Settings.get('pet') });
      else await Net.join({ room, name, password, skin: Settings.get('skin'), pet: Settings.get('pet') });
      Settings.set('mpName', name);
      Settings.set('mpRoom', room);
      f.elements.password.value = '';
      formStatus(f, '');
      Sfx.play('power');
      showLobby();
    } catch (err) {
      const code = err && err.code;
      formStatus(f, NET_ERRORS[code] || NET_ERRORS.network, 'bad');
      // "can't reach each other" → offer the relay setup right there
      f.querySelector('.relay-fix').classList.toggle('hidden', code !== 'nat' && code !== 'natrelay');
      Sfx.play('hurt');
    } finally {
      clearTimeout(slow);
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
      const pet = r.pet && r.pet !== 'none' && petById(r.pet).img ? `<img class="lp-pet" src="${esc(petById(r.pet).img)}" alt="" title="${esc(petById(r.pet).name)}">` : '';
      return `<li class="lp${fresh ? ' new' : ''}" style="--pc:${Net.color(r.pid)}"><img src="${esc(skinImg(r.skin))}" alt="">${pet}<b>${esc(r.name)}</b>${hostTag}${meTag}${ping}${kick}</li>`;
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
    box.querySelectorAll('.lob-classic').forEach((el) => el.classList.toggle('hidden', s.mode !== 'classic'));
    box.querySelectorAll('.lob-hardcore').forEach((el) => el.classList.toggle('hidden', s.mode !== 'hardcore'));
    const tier = TIER[s.tier];
    const game = gameOf(s.game);
    const gameLine = { arcade: 'Waves of mobs, a boss every 5 waves.', bossrush: 'Only bosses, all 11 back to back. Everyone starts with a level 3 gun.', raid: 'Defend the village from the illagers. Raiders that get through burn it — if it falls, the run is over.' }[game.id];
    $('lobbyRules').innerHTML = `<b>${game.name}:</b> ${gameLine} ` + (s.mode === 'hardcore'
      ? `<b>${tier.name}:</b> ${esc(tier.desc)} Always on HARD. <b>No respawns</b>: a downed player spectates until the run ends.`
      : `Downed players <b>rejoin at the start of the next ${game.id === 'bossrush' ? 'boss' : 'wave'}</b>. It's game over when the whole team is down. Mob and boss health grow with the team.`);
    $('btnLobbyStart').classList.toggle('hidden', !host);
    $('lobbyWait').classList.toggle('hidden', host);
    $('lobbyWait').textContent = Net.phase === 'game' ? 'THE HOST IS STILL IN THE LAST RUN…' : 'WAITING FOR THE HOST TO START…';
  }
  function initLobby() {
    $('formCreate').addEventListener('submit', (e) => submitNet(e, true));
    $('formJoin').addEventListener('submit', (e) => submitNet(e, false));
    $('formRelay').addEventListener('submit', saveRelay);
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
    // skins and pets changed in the lobby are shown to the whole room
    Settings.onChange((key, v) => {
      if (!Net.role || Net.phase !== 'lobby') return;
      if (key === 'skin') Net.setSkin(v);
      if (key === 'pet') Net.setPet(v);
    });
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
    const icon = (id) => (typeof ABILITY_ICONS !== 'undefined' && ABILITY_ICONS[id]) || '';
    $('skinAbils').innerHTML = [
      ['SHIFT', 'MOVE', s.move, `COOLDOWN ${s.move.cd}s`, s.glow === '#ffffff' ? '#cfe6ff' : s.glow],
      ['B', 'SPECIAL', s.ult, 'CHARGES FROM YOUR KILLS', ultColor(s)],
    ].map(([key, kind, a, foot, c]) => `<div class="abil" style="--ac:${c}"><span class="abil-ic">${icon(a.id)}</span><div><b><kbd>${key}</kbd>${esc(a.name)}</b><p>${esc(a.desc)}</p><small>${kind} · ${foot}</small></div></div>`).join('');
  }
  function syncMenuSkin() {
    const s = skinById(Settings.get('skin'));
    $('menuSkin').src = s.img;
  }
  function renderSkins() {
    const cur = Settings.get('skin');
    $('skinCount').textContent = String(SKINS.length);
    const icon = (id) => (typeof ABILITY_ICONS !== 'undefined' && ABILITY_ICONS[id]) || '';
    $('skinGrid').innerHTML = SKINS.map((s) => `<button class="skin${s.id === cur ? ' on' : ''}" data-skin="${s.id}" style="--skin:${s.glow}" aria-pressed="${s.id === cur}"><img src="${s.img}" alt=""><b>${s.name}</b><i class="skin-abs" title="${s.move.name} · ${s.ult.name}">${icon(s.move.id)}${icon(s.ult.id)}</i><span>${s.id === cur ? 'EQUIPPED' : 'EQUIP'}</span></button>`).join('');
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

  // ================================================================ pets
  const petById = (id) => (typeof PETS !== 'undefined' && (PETS.find((p) => p.id === id) || PETS[0])) || { id: 'none', name: 'NO PET', img: '', glow: '#7f8aa8', role: 'SOLO', desc: '', abil: [] };
  const PAW = '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="5.5" cy="10" rx="2.1" ry="2.7"/><ellipse cx="9.8" cy="5.6" rx="2.1" ry="2.7"/><ellipse cx="14.8" cy="5.6" rx="2.1" ry="2.7"/><ellipse cx="19" cy="10" rx="2.1" ry="2.7"/><path d="M12.3 11.2c3 0 6.3 4.6 6.3 7.3 0 1.9-1.5 2.7-3.2 2.7-1.4 0-2.2-.8-3.1-.8s-1.7.8-3.1.8C7.5 21.2 6 20.4 6 18.5c0-2.7 3.3-7.3 6.3-7.3z"/></svg>';
  const PET_SOUND = { wolf: 'bark', cat: 'meow', bee: 'buzz', allay: 'chime', frog: 'croak', axolotl: 'bubble' };
  const petPic = (d) => (d.img ? `<img src="${d.img}" alt="">` : `<span class="pet-none">${PAW}</span>`);
  function paintPetStage(d) {
    const prev = $('petPreview');
    prev.innerHTML = petPic(d);
    retrigger(prev, 'pop');
    $('scrPets').style.setProperty('--skin', d.glow);
    $('petName').innerHTML = `${esc(d.name)}<i class="pet-role">${esc(d.role)}</i>`;
    $('petDesc').textContent = d.desc;
    $('petAbils').innerHTML = d.abil.length
      ? d.abil.map((a, i) => `<div class="abil" style="--ac:${d.glow}"><span class="abil-ic pet-num">${i + 1}</span><div><b>${esc(a.name)}</b><p>${esc(a.desc)}</p><small>${i ? 'SECOND' : 'FIRST'} ABILITY · AUTOMATIC</small></div></div>`).join('')
      : '<p class="pet-solo">No pet, no help: just you and the void.</p>';
  }
  function syncMenuPet() {
    const d = petById(Settings.get('pet'));
    $('menuPet').innerHTML = d.img ? `<img src="${d.img}" alt="">` : PAW;
  }
  function renderPets() {
    const cur = Settings.get('pet');
    $('petCount').textContent = String(PETS.length - 1);
    $('petGrid').innerHTML = PETS.map((d) => `<button class="skin pet${d.id === cur ? ' on' : ''}" data-pet="${d.id}" style="--skin:${d.glow}" aria-pressed="${d.id === cur}">${petPic(d)}<b>${d.name}</b><i class="pet-role">${d.role}</i><span>${d.id === cur ? 'EQUIPPED' : 'EQUIP'}</span></button>`).join('');
    paintPetStage(petById(cur));
  }
  function equipPet(id) {
    if (id === Settings.get('pet')) { Sfx.play('click'); return; }
    Settings.set('pet', id);
    $('petGrid').querySelectorAll('.pet').forEach((b) => {
      const on = b.dataset.pet === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('span:last-child').textContent = on ? 'EQUIPPED' : 'EQUIP';
    });
    paintPetStage(petById(id));
    syncMenuPet();
    Sfx.play(PET_SOUND[id] || 'click');
    toast(id === 'none' ? 'NO PET' : `${petById(id).name} IS FOLLOWING YOU`);
  }
  function initPets() {
    $('petGrid').addEventListener('click', (e) => {
      const b = e.target.closest('.pet');
      if (b) equipPet(b.dataset.pet);
    });
    $('petGrid').addEventListener('focusin', (e) => {
      const b = e.target.closest('.pet');
      if (b) paintPetStage(petById(b.dataset.pet));
    });
    $('petGrid').addEventListener('focusout', (e) => {
      if (!$('petGrid').contains(e.relatedTarget)) paintPetStage(petById(Settings.get('pet')));
    });
    syncMenuPet();
  }

  function renderBosses() {
    $('bossCards').innerHTML = Game.bossList().map((b) => (b.secret && !b.found
      ? `<div class="card secret"><img src="${b.img}.png" alt=""><div><b>???<span class="tag lvl">SECRET</span></b><p>Some say a figure with white eyes watches from the edge of the void after wave 15... and that it does not like being shot at.</p></div></div>`
      : `<div class="card"><img src="${b.img}.png" alt=""><div><b>${b.name}<span class="tag lvl">${b.secret ? 'SECRET' : `WAVE ${b.wave}`}</span></b><p>${b.desc}</p></div></div>`)).join('');
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
    initPets();
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
