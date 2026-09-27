/* =========================================================================
   Bosses — ten bosses, one every 5 waves, in this order:
     Warden · Wither · Elder Guardian · Ender Dragon · Ravager ·
     Magma King · Blaze King · Illusioner · Ghast Queen · Phantom Overlord
   After the tenth they return as MK II, MK III... with more bullets, faster
   attacks, extra moves and a new colour. `mark` = which lap this is (1, 2, 3...).

   Every boss is a plain object of hooks the engine (game.js) calls:
     tick(e, dt)      movement + ongoing effects, every frame
     busy(e)          true while a multi-step attack is running
     moves(e)         attack names available right now (repeats = more likely)
     attack(e, name)  start an attack
     onFight / onPhase / onDeath, drawBack / drawFront / drawFx / glowFx, block
   ========================================================================= */
const BossKit = (K) => {
  const { TAU, rand, randi, pick, clamp, lerp, damp, easeOutCubic, easeInOut, C, PAL, view, enemies } = K;
  const later = (e, t, fn) => e.queue.push({ t, fn });
  const pl = () => K.player();
  const sp = (base, e) => K.bulletSpeed(base) * K.bossF(e);

  // ------------------------------------------------------------ shared moves
  /** Dive at the player (Ender Dragon, Phantom Overlord). */
  function startSwoop(e, count) {
    const p = pl();
    e.swoop = { t: 0, stage: 'warn', n: count, x0: e.x, y0: e.y, tx: p.x, ty: clamp(p.y, view.h * 0.3, view.h - e.h * 0.3) };
    Sfx.play('charge');
  }
  function updateSwoop(e, dt) {
    const s = e.swoop;
    const k = view.k;
    s.t += dt;
    if (s.stage === 'warn') {
      e.x += rand(-1.5, 1.5) * k;
      if (s.t > 0.75) { s.stage = 'dive'; s.t = 0; Sfx.play('dash'); }
    } else if (s.stage === 'dive') {
      const u = Math.min(1, s.t / 0.55);
      const ov = 1.15;
      e.x = lerp(s.x0, s.x0 + (s.tx - s.x0) * ov, u * u);
      e.y = lerp(s.y0, s.y0 + (s.ty - s.y0) * ov, u * u);
      if (K.hiQ() && Math.random() < 0.5) K.P(e.x, e.y - e.h * 0.2, 0, 0, 0.25, e.w * 0.16, e.def.glow, K.GLOW, 2);
      if (u >= 1) { s.stage = 'back'; s.t = 0; s.bx = e.x; s.by = e.y; }
    } else {
      const u = Math.min(1, s.t / 0.8);
      e.x = lerp(s.bx, s.x0, easeOutCubic(u));
      e.y = lerp(s.by, e.ty, easeOutCubic(u));
      if (u >= 1) {
        s.n -= 1;
        if (s.n > 0) {
          const p = pl();
          Object.assign(s, { t: 0, stage: 'warn', x0: e.x, y0: e.y, tx: p.x, ty: clamp(p.y, view.h * 0.3, view.h - e.h * 0.3) });
        } else {
          e.swoop = null;
        }
      }
    }
  }
  function drawSwoop(e) {
    const s = e.swoop;
    if (!s || s.stage !== 'warn') return;
    const k = view.k;
    K.world();
    const ctx = K.ctx;
    ctx.globalAlpha = Math.sin(s.t * 30) > 0 ? 0.9 : 0.4;
    ctx.strokeStyle = '#ff4d5e';
    ctx.lineWidth = 3 * k;
    ctx.setLineDash([12 * k, 10 * k]);
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.tx, s.ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(s.tx, s.ty, 34 * k, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function drawLine(x0, y0, x1, y1, color, width, alpha, dash) {
    const ctx = K.ctx;
    K.world();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  const floatAcross = (e, dt, speed = 0.5, bob = 16, rate = 2.2) => {
    const t = view.w / 2 + Math.sin(e.mt * speed) * Math.max(0, view.w / 2 - e.w * 0.55);
    e.x = damp(e.x, t, rate, dt);
    e.y = damp(e.y, e.ty + Math.sin(e.mt * 1.3) * bob * view.k, 3, dt);
  };
  const summonAround = (e, type, n, o) => {
    const k = view.k;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const m = spawn(type, clamp(e.x + side * e.w * (0.35 + 0.15 * (i >> 1)), 40 * k, view.w - 40 * k), e.y, o);
      K.P(m.x, m.y, 0, 0, 0.4, 60 * k, e.def.glow, K.RING);
    }
    Sfx.play('cast');
  };
  const spawn = (type, x, y, o) => {
    const m = K.spawnEnemy(type, x, y, Object.assign({ noElite: true }, o));
    m.spawn = 0;
    return m;
  };

  // ================================================================ 1. WARDEN
  const heartbeat = (e) => {
    const x = (e.t * (e.phase === 3 ? 1.7 : 1.1)) % 1;
    return Math.pow(Math.max(0, Math.sin(x * TAU)), 12) + 0.6 * Math.pow(Math.max(0, Math.sin((x - 0.17) * TAU)), 12);
  };
  const warden = {
    name: 'THE WARDEN', img: 'warden', w: 330, h: 168, hp: 420, score: 8000, glow: C.teal, pal: PAL.warden,
    music: 'boss', warning: 'SPACE ANCIENT ZONE ALERT!!', entry: 'drop', phases: [0.66, 0.33], mouthY: 0.18, mouthColor: C.cyan,
    intro: ['SONIC VOLLEYS · SONIC BOOM · SUMMONS', 'MK II · NEW: TWIN BOOM · SHRIEKERS · DARKNESS', 'MK III · NEW: SWEEPING BOOM · SONIC CHARGE · TWIN SPIRAL'],
    phaseText: { 2: ['THE WARDEN STIRS', 'PHASE 2'], 3: ['ENRAGED!', 'BEWARE THE SONIC BOOM'] },
    desc: 'Sonic volleys, sonic boom beams and summons. Later laps add darkness, shriekers and a body slam.',
    pulse: heartbeat,
    onPhase(e) { K.ring(e.x, e.y, 16, sp(200, e), 'orb'); },
    tick(e, dt) {
      if (e.charge) { updateCharge(e, dt); return; }
      const lead = e.beams.find((b) => b.track);
      if (lead) {
        e.x = damp(e.x, lead.x, 6, dt);
        e.y = damp(e.y, e.ty + Math.sin(e.mt * 1.3) * 16 * view.k, 3, dt);
      } else {
        floatAcross(e, dt);
      }
    },
    busy: (e) => !!e.charge,
    moves(e) {
      const m = e.mark;
      const ph = e.phase;
      const list = ['volley', 'volley', 'rain'];
      if (ph >= 2) list.push('ring', 'summon');
      if (ph >= 3) list.push('beam', 'beam', 'spiral');
      if (m >= 2) { list.push('gapring'); if (ph >= 2) list.push(K.countType('shrieker') < 2 ? 'shriekers' : 'ring', K.isDark() ? 'rain' : 'darkness'); }
      if (m >= 3) { list.push('charge'); if (ph >= 2) list.push('sweep'); }
      return list;
    },
    attack(e, a) {
      const k = view.k;
      const m = e.mark;
      const mx = e.x;
      const my = e.y + e.h * 0.18;
      const s = sp(300, e);
      switch (a) {
        case 'volley': {
          const shots = 1 + (m >= 2 ? 1 : 0) + (m >= 4 ? 1 : 0);
          for (let i = 0; i < shots; i++) {
            later(e, i ? 0.3 : 0, () => {
              const n = Math.min(11, (e.phase === 1 ? 5 : 7) + (m - 1) * 2);
              K.fan(e.x, e.y + e.h * 0.18, n, 0.16, s, 'sonic');
              e.mouth = 0.35;
              Sfx.play('sonic');
            });
          }
          e.atk = 1.4;
          break;
        }
        case 'rain': {
          const n = 12 + (m - 1) * 3;
          for (let i = 0; i < n; i++) {
            const ang = Math.PI / 2 + (i - (n - 1) / 2) * (2 / n);
            const v = s * 0.7 * rand(0.85, 1.15);
            K.eShoot(mx, my, Math.cos(ang) * v, Math.sin(ang) * v, 'orb');
          }
          e.mouth = 0.3;
          e.atk = 1.5;
          Sfx.play('sonic');
          break;
        }
        case 'ring':
          K.ring(mx, my, 18 + (m - 1) * 4 + (e.phase === 3 ? 6 : 0), s * 0.75, 'orb');
          K.P(mx, my, 0, 0, 0.5, 140 * k, C.teal, K.RING);
          e.mouth = 0.4;
          e.atk = 1.7;
          Sfx.play('sonic');
          break;
        case 'gapring': {
          // a dense ring with two safe gaps — find them!
          const n = 32;
          const g1 = randi(0, n - 1);
          const g2 = (g1 + n / 2 + randi(-3, 3)) % n;
          const near = (i, g) => { const d = Math.abs(i - g); return Math.min(d, n - d) <= 2; };
          const off = rand(TAU);
          for (let i = 0; i < n; i++) {
            if (near(i, g1) || near(i, g2)) continue;
            const ang = off + (i * TAU) / n;
            K.eShoot(mx, my, Math.cos(ang) * s * 0.65, Math.sin(ang) * s * 0.65, 'orb');
          }
          K.P(mx, my, 0, 0, 0.5, 160 * k, C.teal, K.RING);
          e.mouth = 0.4;
          e.atk = 1.6;
          Sfx.play('sonic');
          break;
        }
        case 'summon':
          if (enemies.length < 12) {
            for (const side of [-1, 1]) {
              spawn(m >= 3 ? 'creeper' : 'zombie', e.x + side * e.w * 0.45, e.y + e.h * 0.2);
              spawn('vex', e.x + side * e.w * 0.3, e.y + e.h * 0.4);
            }
            Sfx.play('cast');
          }
          e.atk = 1.8;
          break;
        case 'beam': {
          const p = pl();
          e.beams.push(K.makeBeam(p.x, true, false, 'teal'));
          if (m >= 2) {
            const x2 = p.x < view.w / 2 ? p.x + view.w * 0.38 : p.x - view.w * 0.38;
            e.beams.push(K.makeBeam(clamp(x2, 40 * k, view.w - 40 * k), false, true, 'teal'));
          }
          Sfx.play('charge');
          e.atk = 1.6;
          break;
        }
        case 'sweep': {
          // a sky beam sweeps from the player's side toward the middle — get to the far side
          const fromRight = pl().x > view.w / 2;
          const x0 = fromRight ? view.w * 0.96 : view.w * 0.04;
          const x1 = fromRight ? view.w * 0.34 : view.w * 0.66;
          const b = K.makeBeam(x0, false, true, 'teal');
          b.warn = 1.1;
          b.fire = 1.5;
          b.w = 56 * k;
          b.sweep = true;
          b.vx = (x1 - x0) / b.fire;
          e.beams.push(b);
          Sfx.play('charge');
          e.atk = 1.4;
          break;
        }
        case 'shriekers': {
          const pos = [[0.14, 0.34], [0.86, 0.34], [0.3, 0.5], [0.7, 0.5]];
          const n = m >= 4 ? 4 : 2;
          for (let i = 0; i < n; i++) {
            const sh = spawn('shrieker', e.x, e.y + e.h * 0.2);
            sh.tx = pos[i][0] * view.w;
            sh.ty = pos[i][1] * view.h;
          }
          Sfx.play('shriek');
          e.atk = 1.3;
          break;
        }
        case 'darkness':
          K.setDark(5 + m * 0.5);
          Sfx.play('darkness');
          K.popup(e.x, e.y + e.h * 0.6, 'DARKNESS', '#8ffff2', 12, 1.4);
          e.atk = 0.9;
          break;
        case 'charge': {
          const p = pl();
          e.charge = { t: 0, x: p.x, y0: e.y, ty: clamp(p.y - 10 * k, e.ty, view.h - e.h * 0.4), hit: false };
          Sfx.play('charge');
          e.atk = 1.2;
          break;
        }
        case 'spiral':
          K.spiral(e, { time: 2.6, arms: 3, twin: m >= 3, kind: 'orb', speed: 230, oy: 0.18, rate: 0.085 });
          e.atk = 1.4;
          break;
        default:
          break;
      }
    },
    drawFx(e) {
      const c = e.charge;
      if (!c || c.t >= 0.85) return;
      K.world();
      K.ctx.globalAlpha = 1;
      K.ctx.fillStyle = `rgba(255,60,80,${Math.sin(c.t * 30) > 0 ? 0.28 : 0.14})`;
      K.ctx.fillRect(c.x - e.w * 0.4, e.y, e.w * 0.8, c.ty + e.h * 0.5 - e.y);
    },
  };
  function updateCharge(e, dt) {
    const c = e.charge;
    const k = view.k;
    c.t += dt;
    if (c.t < 0.85) {
      e.x = damp(e.x, c.x, 6, dt) + rand(-1.5, 1.5) * k;
      e.y = damp(e.y, c.y0 - 24 * k, 4, dt);
    } else if (c.t < 1.27) {
      const u = (c.t - 0.85) / 0.42;
      e.y = lerp(c.y0 - 24 * k, c.ty, u * u);
    } else if (c.t < 1.52) {
      e.y = c.ty;
      if (!c.hit) {
        c.hit = true;
        K.shake(0.8);
        K.P(e.x, e.y + e.h * 0.4, 0, 0, 0.6, 260 * k, C.teal, K.RING);
        K.ring(e.x, e.y + e.h * 0.3, 14, sp(220, e), 'orb');
        Sfx.play('explode', 2);
        Input.vibrate(50);
      }
    } else if (c.t < 2.42) {
      e.y = lerp(c.ty, c.y0, easeOutCubic((c.t - 1.52) / 0.9));
    } else {
      e.charge = null;
    }
  }

  // ================================================================ 2. WITHER
  const HEADS = [[0, -0.22], [-0.37, -0.02], [0.37, -0.02]];
  function skullVolley(e) {
    const per = 1 + Math.min(2, e.mark - 1) + (e.phase === 3 ? 1 : 0);
    const s = sp(290, e);
    for (const [hx, hy] of HEADS) K.fan(e.x + hx * e.w, e.y + hy * e.h, per, 0.13, s, 'wskull');
    e.mouth = 0.3;
    Sfx.play('wshoot');
  }
  function skullRing(e) {
    K.ring(e.x, e.y, 20 + e.mark * 2, sp(220, e), 'wskull');
    K.P(e.x, e.y, 0, 0, 0.7, 320 * view.k, C.purple, K.RING);
    K.shake(0.5);
    Sfx.play('explode', 2);
  }
  const wither = {
    name: 'THE WITHER', img: 'wither', w: 300, h: 180, hp: 480, score: 10000, glow: C.purple, pal: PAL.wither,
    music: 'wither', warning: 'THE WITHER IS RISING!!', entry: 'grow', phases: [0.5, 0.2], mouthY: -0.22, mouthColor: C.purple,
    intro: ['WITHER SKULLS · BLUE SKULLS · WITHER ARMOR', 'MK II · NEW: SKULL STORM · DIVE BOMBING · SKELETON ARMY', 'MK III · NEW: TRIPLE BLUE SKULLS · DOUBLE RAGE NOVA'],
    phaseText: { 2: ['WITHER ARMOR', 'BULLETS DEAL HALF DAMAGE'], 3: ['WITHER RAGE!', 'DODGE THE SKULL NOVA'] },
    desc: 'Three heads of exploding skulls and homing blue skulls. Grows armor at half health.',
    onFight(e) { K.explode(e.x, e.y, PAL.wither, 2.5, C.blue); UI.flash('white'); },
    onPhase(e, ph) {
      if (ph === 2) e.armor = true;
      else later(e, 0.6, skullRing);
    },
    tick(e, dt) {
      if (e.dash) updateWDash(e, dt);
      else floatAcross(e, dt, 0.7, 20, 2);
      e.rot = Math.sin(e.mt * 1.3) * 0.04;
      if (e.armor && K.hiQ() && Math.random() < dt * 10) K.P(e.x + rand(-0.45, 0.45) * e.w, e.y + rand(-0.4, 0.4) * e.h, 0, -30 * view.k, 0.6, 10 * view.k, C.blue, K.GLOW, 1);
    },
    busy: (e) => !!e.dash,
    moves(e) {
      const m = e.mark;
      const ph = e.phase;
      const list = ['skulls', 'skulls', 'blueskull'];
      if (ph >= 2) list.push(K.countType('wskel') < 4 ? 'summonws' : 'skulls', 'dash');
      if (ph >= 3) list.push('skulls', 'ragering');
      if (m >= 2) { list.push('storm'); if (ph >= 2) list.push('dashbomb'); }
      if (m >= 3) list.push('blueskull');
      return list;
    },
    attack(e, a) {
      const m = e.mark;
      switch (a) {
        case 'skulls': {
          const n = 1 + (m >= 3 ? 1 : 0) + (e.phase === 3 ? 1 : 0);
          for (let i = 0; i < n; i++) later(e, i ? 0.3 : 0, skullVolley);
          e.atk = 1.3;
          break;
        }
        case 'blueskull': {
          const n = m >= 3 ? 3 : e.phase >= 2 ? 2 : 1;
          K.fan(e.x, e.y - e.h * 0.22, n, 0.45, K.bulletSpeed(150), 'bskull');
          e.mouth = 0.4;
          Sfx.play('wshoot');
          e.atk = 1.5;
          break;
        }
        case 'summonws':
          summonAround(e, 'wskel', m >= 2 ? 4 : 2);
          e.atk = 1.8;
          break;
        case 'dash':
        case 'dashbomb': {
          const dir = e.x < view.w / 2 ? 1 : -1;
          e.dash = { t: 0, dir, dur: a === 'dashbomb' ? 1.6 : 1.25, x0: e.x, x1: dir > 0 ? view.w - e.w * 0.45 : e.w * 0.45, y0: e.y, low: a === 'dashbomb', drop: 0 };
          Sfx.play('charge');
          e.atk = 1.1;
          break;
        }
        case 'storm':
          K.spiral(e, { time: 2.8, arms: 2, twin: m >= 3, kind: 'wskull', speed: 210, oy: -0.22, rate: 0.11 });
          Sfx.play('wither');
          e.atk = 1.3;
          break;
        case 'ragering':
          skullRing(e);
          if (m >= 3) later(e, 0.55, skullRing);
          e.atk = 1.8;
          break;
        default:
          break;
      }
    },
    glowFx(e) {
      const g = e.grow;
      for (const [hx, hy] of HEADS) K.glow(C.blue, e.x + hx * e.w * g, e.y + hy * e.h * g, 26 * view.k * g, 0.35 + 0.25 * Math.sin(K.time() * 5 + hx * 4));
    },
    drawFx(e) {
      const d = e.dash;
      if (!d || d.t >= 0.7) return;
      const k = view.k;
      const ctx = K.ctx;
      K.world();
      ctx.globalAlpha = Math.sin(d.t * 30) > 0 ? 0.9 : 0.4;
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 3 * k;
      ctx.setLineDash([12 * k, 10 * k]);
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const x = lerp(d.x0, d.x1, u);
        const y = d.low ? d.y0 + Math.sin(u * Math.PI) * Math.max(0, view.h * 0.45 - d.y0) : d.y0;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    },
  };
  function updateWDash(e, dt) {
    const d = e.dash;
    d.t += dt;
    if (d.t < 0.7) { e.x += rand(-1, 1) * 2 * view.k; return; }
    const u = Math.min(1, (d.t - 0.7) / d.dur);
    e.x = lerp(d.x0, d.x1, easeInOut(u));
    if (d.low) e.y = d.y0 + Math.sin(u * Math.PI) * Math.max(0, view.h * 0.45 - d.y0);
    d.drop -= dt;
    if (d.drop <= 0) {
      d.drop = d.low ? 0.1 : 0.14;
      K.eShoot(e.x, e.y + e.h * 0.3, rand(-30, 30) * view.k, K.bulletSpeed(260), 'wskull');
    }
    if (u >= 1) e.dash = null;
  }

  // ================================================================ 3. ELDER GUARDIAN
  const elder = {
    name: 'ELDER GUARDIAN', img: 'elder', w: 230, h: 230, hp: 520, score: 11000, glow: C.teal, pal: PAL.elder,
    music: 'boss', warning: 'SOMETHING STIRS IN THE DEEP!!', entry: 'drop', phases: [0.6, 0.3], mouthY: 0, mouthColor: C.pink,
    intro: ['EYE LASER · SPIKE BURST · GUARDIANS', 'MK II · NEW: TWIN LASERS · MINING FATIGUE', 'MK III · NEW: TRACKING TRIPLE LASER · BUBBLE STORM'],
    phaseText: { 2: ['THE DEEP AWAKENS', 'MINING FATIGUE INCOMING'], 3: ['ELDER FURY', 'NOWHERE TO HIDE'] },
    desc: 'Charges an eye laser that follows you, bursts spikes and curses you with Mining Fatigue (slow).',
    init(e) { e.lasers = []; e.curse = 0; },
    tick(e, dt) {
      floatAcross(e, dt, 0.6, 14, 2);
      e.rot = Math.sin(e.mt * 0.8) * 0.06;
      if (e.curse > 0) e.curse -= dt;
      const p = pl();
      for (const L of e.lasers) {
        L.t += dt;
        const aim = Math.atan2(p.y - e.y, p.x - e.x) + L.off;
        if (L.t < L.warn) {
          L.ang = K.turnToward(L.ang, aim, 1.6 * dt);
        } else if (L.t < L.warn + L.fire) {
          if (e.mark >= 3) L.ang = K.turnToward(L.ang, aim, 0.5 * dt);
          if (!L.fired) { L.fired = true; Sfx.play('beam'); K.shake(0.4); }
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const along = dx * Math.cos(L.ang) + dy * Math.sin(L.ang);
          const perp = Math.abs(dx * Math.sin(L.ang) - dy * Math.cos(L.ang));
          if (p.alive && along > 0 && perp < 18 * view.k + p.r) K.hurtPlayer();
        } else {
          L.done = true;
        }
      }
      for (let i = e.lasers.length - 1; i >= 0; i--) if (e.lasers[i].done) e.lasers.splice(i, 1);
    },
    busy: (e) => e.lasers.length > 0,
    moves(e) {
      const list = ['laser', 'spikes', 'spikes', K.countType('guardian') < 3 ? 'summon' : 'spikes'];
      if (e.phase >= 2) list.push(e.mark >= 2 ? 'fatigue' : 'laser', 'bubble');
      if (e.phase >= 3) list.push('laser', 'spikes');
      return list;
    },
    attack(e, a) {
      const k = view.k;
      const m = e.mark;
      switch (a) {
        case 'laser': {
          const offs = m >= 3 ? [-0.35, 0, 0.35] : m >= 2 ? [-0.3, 0.3] : [0];
          const p = pl();
          const base = Math.atan2(p.y - e.y, p.x - e.x);
          for (const off of offs) e.lasers.push({ t: 0, off, ang: base + off, warn: 1.4, fire: 0.5, fired: false, done: false });
          Sfx.play('charge');
          e.atk = 1.3;
          break;
        }
        case 'spikes': {
          const n = 16 + (m - 1) * 6;
          K.ring(e.x, e.y, n, sp(240, e), 'spike');
          later(e, 0.35, () => K.ring(e.x, e.y, n, sp(200, e), 'spike'));
          K.P(e.x, e.y, 0, 0, 0.4, e.w * 0.8, C.orange, K.RING);
          Sfx.play('sonic');
          e.atk = 1.6;
          break;
        }
        case 'fatigue':
          K.setFatigue(4 + m);
          e.curse = 1.4;
          K.popup(pl().x, pl().y - 60 * k, 'MINING FATIGUE', '#c78bff', 12, 1.6);
          Sfx.play('darkness');
          e.atk = 1;
          break;
        case 'summon': {
          const n = 2 + (m >= 2 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const g = spawn('guardian', e.x + (i - (n - 1) / 2) * 90 * k, e.y + e.h * 0.3);
            g.ty = view.h * rand(0.28, 0.45);
          }
          Sfx.play('cast');
          e.atk = 1.6;
          break;
        }
        case 'bubble':
          K.spiral(e, { time: 2.4, arms: 4, twin: m >= 3, kind: 'orb', speed: 190, oy: 0, rate: 0.12 });
          e.atk = 1.4;
          break;
        default:
          break;
      }
    },
    drawFx(e) {
      const k = view.k;
      const far = Math.hypot(view.w, view.h) * 1.2;
      for (const L of e.lasers) {
        const x1 = e.x + Math.cos(L.ang) * far;
        const y1 = e.y + Math.sin(L.ang) * far;
        if (L.t < L.warn) {
          const u = L.t / L.warn;
          drawLine(e.x, e.y, x1, y1, u > 0.7 ? '#ffe066' : '#c78bff', (1.5 + u * 3) * k, 0.4 + u * 0.5, [10 * k, 8 * k]);
        } else {
          K.ctx.globalCompositeOperation = 'lighter';
          drawLine(e.x, e.y, x1, y1, 'rgba(199,139,255,0.5)', 34 * k, 1);
          drawLine(e.x, e.y, x1, y1, '#ffffff', 10 * k, 1);
          K.ctx.globalCompositeOperation = 'source-over';
        }
      }
      if (e.curse > 0) {
        // the famous ghostly face that appears when you get Mining Fatigue
        const s = Math.min(view.w, view.h) * 0.7;
        K.ctx.globalAlpha = Math.min(1, e.curse) * 0.35;
        K.blit(K.sprite('elder', s, s), view.w / 2, view.h / 2, s, s, 0, 1 + (1.4 - e.curse) * 0.2, 1 + (1.4 - e.curse) * 0.2);
        K.ctx.globalAlpha = 1;
      }
    },
  };

  // ================================================================ 4. ENDER DRAGON
  function spawnCrystals(e, n) {
    const slots = [[0.12, 0.2], [0.88, 0.2], [0.3, 0.12], [0.7, 0.12], [0.5, 0.3]];
    for (let i = 0; i < n && K.countType('crystal') < 5; i++) {
      const c = spawn('crystal', slots[i][0] * view.w, -40 * view.k);
      c.tx = slots[i][0] * view.w;
      c.ty = Math.max(slots[i][1] * view.h, 90 * view.k);
    }
    K.popup(view.w / 2, view.h * 0.35, 'DESTROY THE END CRYSTALS!', '#ff6ad5', 12, 2.2);
  }
  const dragon = {
    name: 'ENDER DRAGON', img: 'dragon', w: 170, h: 106, hp: 560, score: 12000, glow: C.purple, pal: PAL.dragon,
    music: 'wither', warning: 'THE DRAGON AWAKENS!!', entry: 'drop', phases: [0.66, 0.33], mouthY: 0.38, mouthColor: C.pink,
    intro: ['END CRYSTALS HEAL IT · DRAGON BREATH · SWOOP', 'MK II · NEW: TRIPLE BREATH · MORE CRYSTALS', 'MK III · NEW: DOUBLE SWOOP · ACID STORM'],
    phaseText: { 2: ['THE DRAGON ROARS', 'CRYSTALS REBUILT'], 3: ['DRAGON FURY', 'THE END IS NEAR'] },
    desc: 'End Crystals heal it — shoot them first! Breathes acid clouds and swoops down at you.',
    init(e) { e.swoop = null; e.flap = 0; },
    onFight(e) { spawnCrystals(e, 2 + (e.mark >= 2 ? 1 : 0) + (e.mark >= 3 ? 1 : 0)); },
    onPhase(e, ph) {
      if (ph === 2) spawnCrystals(e, 2);
      K.ring(e.x, e.y, 18, sp(200, e), 'magic', C.pink);
    },
    tick(e, dt) {
      e.flap += dt * (e.swoop && e.swoop.stage === 'dive' ? 16 : 6);
      if (e.swoop) { updateSwoop(e, dt); return; }
      const tx = view.w / 2 + Math.sin(e.mt * 0.55) * Math.max(0, view.w / 2 - e.w * 1.3);
      e.x = damp(e.x, tx, 2.2, dt);
      e.y = damp(e.y, e.ty + Math.sin(e.mt * 1.1) * 30 * view.k, 2.5, dt);
      e.rot = Math.cos(e.mt * 0.55) * 0.12;
    },
    busy: (e) => !!e.swoop,
    moves(e) {
      const list = ['breath', 'scatter', 'swoop'];
      if (e.phase >= 2) list.push('roar', 'breath');
      if (e.phase >= 3) list.push('swoop', 'scatter');
      if (e.mark >= 3) list.push('acidstorm');
      return list;
    },
    attack(e, a) {
      const m = e.mark;
      const k = view.k;
      switch (a) {
        case 'breath': {
          const n = m >= 2 ? 3 : 1;
          const base = K.aimAt(e.x, e.y + e.h * 0.38);
          for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * 0.3;
            const s = K.bulletSpeed(190);
            const b = K.eShoot(e.x, e.y + e.h * 0.38, Math.cos(ang) * s, Math.sin(ang) * s, 'dfire');
            b.fuse = 1.7;
          }
          e.mouth = 0.5;
          Sfx.play('ghast');
          e.atk = 1.5;
          break;
        }
        case 'scatter':
          K.fan(e.x, e.y + e.h * 0.38, 10 + (m - 1) * 2, 0.13, sp(260, e), 'magic', C.pink);
          e.mouth = 0.3;
          Sfx.play('eshoot');
          e.atk = 1.2;
          break;
        case 'swoop':
          startSwoop(e, m >= 3 ? 2 : 1);
          e.atk = 1.1;
          break;
        case 'roar':
          K.ring(e.x, e.y, 20 + m * 2, sp(210, e), 'magic', C.pink);
          K.P(e.x, e.y, 0, 0, 0.6, 300 * k, C.purple, K.RING);
          K.shake(0.6);
          Sfx.play('roar');
          e.atk = 1.4;
          break;
        case 'acidstorm':
          for (let i = 0; i < 5; i++) K.addHazard('acid', rand(0.1, 0.9) * view.w, rand(0.45, 0.9) * view.h, 60 * k, 3.5, 0.9);
          Sfx.play('darkness');
          e.atk = 1.6;
          break;
        default:
          break;
      }
    },
    drawBack(e, sx, sy) {
      // big flapping wings
      const ctx = K.ctx;
      const k = view.k;
      const flap = Math.sin(e.flap);
      K.at(e.x, e.y, sx, sy, e.rot);
      for (const side of [-1, 1]) {
        const span = e.w * 1.25;
        const lift = flap * e.h * 0.55;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#141418';
        ctx.beginPath();
        ctx.moveTo(side * e.w * 0.22, -e.h * 0.15);
        ctx.lineTo(side * span, -e.h * 0.35 - lift);
        ctx.lineTo(side * span * 0.85, e.h * 0.1 - lift * 0.4);
        ctx.lineTo(side * span * 0.55, e.h * 0.3 - lift * 0.2);
        ctx.lineTo(side * e.w * 0.25, e.h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#6a2c8a';
        ctx.lineWidth = 2 * k;
        ctx.stroke();
        ctx.strokeStyle = '#2a2a33';
        ctx.lineWidth = 3 * k;
        ctx.beginPath();
        ctx.moveTo(side * e.w * 0.22, -e.h * 0.15);
        ctx.lineTo(side * span * 0.85, e.h * 0.1 - lift * 0.4);
        ctx.stroke();
      }
    },
    drawFx(e) {
      drawSwoop(e);
      // pink healing beams from every living crystal
      for (const c of enemies) {
        if (c.type !== 'crystal' || c.dead) continue;
        K.ctx.globalCompositeOperation = 'lighter';
        drawLine(c.x, c.y, e.x, e.y, 'rgba(255,106,213,0.55)', (3 + Math.sin(K.time() * 20) * 1.5) * view.k, 1);
        K.ctx.globalCompositeOperation = 'source-over';
      }
    },
  };

  // ================================================================ 5. RAVAGER
  const ravager = {
    name: 'RAVAGER', img: 'ravager', w: 250, h: 208, hp: 600, score: 12000, glow: C.red, pal: PAL.ravager,
    music: 'boss', warning: 'A RAID IS COMING!!', entry: 'drop', phases: [0.6, 0.3], mouthY: 0.32, mouthColor: C.orange,
    intro: ['RAM CHARGE · ROAR · ROCK STOMP', 'MK II · NEW: DOUBLE CHARGE · RAID PARTY', 'MK III · NEW: TRIPLE CHARGE · BOULDER STORM'],
    phaseText: { 2: ['THE RAID GROWS', 'RAIDERS INCOMING'], 3: ['RAVAGER RAMPAGE', 'KEEP MOVING'] },
    desc: 'Rams straight at you, roars you away and stomps boulders down from the sky.',
    init(e) { e.rush = null; e.step = 0; },
    tick(e, dt) {
      if (e.rush) { updateRush(e, dt); return; }
      const tx = view.w / 2 + Math.sin(e.mt * 0.5) * Math.max(0, view.w / 2 - e.w * 0.55);
      e.x = damp(e.x, tx, 2, dt);
      e.y = damp(e.y, e.ty - Math.abs(Math.sin(e.mt * 3)) * 8 * view.k, 6, dt);
      const s = Math.floor(e.mt * 3 / Math.PI);
      if (s !== e.step) { e.step = s; K.shake(0.06); }
    },
    busy: (e) => !!e.rush,
    moves(e) {
      const list = ['stomp', 'charge', 'roar'];
      if (e.phase >= 2) list.push(enemies.length < 10 ? 'summon' : 'stomp', 'charge');
      if (e.phase >= 3) list.push('stomp', 'roar');
      return list;
    },
    attack(e, a) {
      const m = e.mark;
      const k = view.k;
      switch (a) {
        case 'charge': {
          const p = pl();
          e.rush = { t: 0, stage: 'warn', n: 1 + (m >= 2 ? 1 : 0) + (m >= 3 ? 1 : 0), hx: e.x, hy: e.ty, tx: p.x, ty: clamp(p.y, e.ty, view.h - e.h * 0.35), x0: e.x, y0: e.y };
          Sfx.play('charge');
          e.atk = 1.2;
          break;
        }
        case 'roar': {
          const p = pl();
          e.mouth = 0.6;
          const R = 320 * k;
          for (const b of K.bullets) if (!b.dead && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < R * R) { b.dead = true; K.spark(b.x, b.y, C.white, 1); }
          if ((p.x - e.x) ** 2 + (p.y - e.y) ** 2 < (R * 1.4) ** 2) K.knockPlayer(e.x, e.y, 900 * k);
          K.ring(e.x, e.y + e.h * 0.3, 18 + m * 3, sp(230, e), 'orb', C.red);
          K.P(e.x, e.y, 0, 0, 0.6, R, C.red, K.RING);
          K.shake(0.7);
          Sfx.play('roar');
          e.atk = 1.5;
          break;
        }
        case 'stomp': {
          const n = 8 + (m - 1) * 4 + (e.phase === 3 ? 3 : 0);
          for (let i = 0; i < n; i++) {
            const b = K.eShoot(rand(0.05, 0.95) * view.w, -rand(60, 320) * k, rand(-25, 25) * k, K.bulletSpeed(250) * rand(0.85, 1.2), 'rock');
            if (m >= 3 && i % 3 === 0) b.r *= 1.6;
          }
          K.P(e.x, e.y + e.h * 0.45, 0, 0, 0.5, e.w, C.grey, K.RING);
          K.shake(0.6);
          Sfx.play('explode', 1.8);
          e.atk = 1.4;
          break;
        }
        case 'summon':
          summonAround(e, 'skeleton', 2);
          if (m >= 2) spawn('evoker', e.x, e.y + e.h * 0.3);
          else spawn('zombie', e.x, e.y + e.h * 0.4);
          e.atk = 1.8;
          break;
        default:
          break;
      }
    },
    drawFx(e) {
      const r = e.rush;
      if (!r || r.stage !== 'warn') return;
      const k = view.k;
      drawLine(r.x0, r.y0, r.tx, r.ty, `rgba(255,60,80,${Math.sin(r.t * 30) > 0 ? 0.3 : 0.15})`, e.w * 0.6, 1);
      drawLine(r.x0, r.y0, r.tx, r.ty, '#ff4d5e', 2 * k, 0.9, [10 * k, 8 * k]);
    },
  };
  function updateRush(e, dt) {
    const r = e.rush;
    r.t += dt;
    if (r.stage === 'warn') {
      e.x = r.x0 + rand(-2, 2) * view.k;
      if (r.t > 0.7) { r.stage = 'go'; r.t = 0; Sfx.play('dash'); }
    } else if (r.stage === 'go') {
      const u = Math.min(1, r.t / 0.45);
      e.x = lerp(r.x0, r.tx, u * u);
      e.y = lerp(r.y0, r.ty, u * u);
      if (u >= 1) {
        r.stage = 'back';
        r.t = 0;
        r.bx = e.x;
        r.by = e.y;
        K.shake(0.5);
        K.P(e.x, e.y + e.h * 0.4, 0, 0, 0.5, e.w * 0.9, C.grey, K.RING);
        K.ring(e.x, e.y, 10 + e.mark * 2, sp(200, e), 'orb', C.red);
      }
    } else {
      const u = Math.min(1, r.t / 0.75);
      e.x = lerp(r.bx, r.hx, easeOutCubic(u));
      e.y = lerp(r.by, r.hy, easeOutCubic(u));
      if (u >= 1) {
        r.n -= 1;
        if (r.n > 0) {
          const p = pl();
          Object.assign(r, { t: 0, stage: 'warn', x0: e.x, y0: e.y, tx: p.x, ty: clamp(p.y, e.ty, view.h - e.h * 0.35) });
          Sfx.play('charge');
        } else {
          e.rush = null;
        }
      }
    }
  }

  // ================================================================ 6. MAGMA KING
  const magma = {
    name: 'MAGMA KING', img: 'magma', w: 200, h: 200, hp: 580, score: 12500, glow: C.orange, pal: PAL.magma,
    music: 'wither', warning: 'THE NETHER BOILS!!', entry: 'drop', phases: [0.6, 0.3], mouthY: 0.3, mouthColor: C.orange, crown: true,
    intro: ['LAVA HOPS · METEOR SLAM · LAVA SPIT', 'MK II · NEW: LAVA POOLS · BIGGER SPLITS', 'MK III · NEW: DOUBLE SLAM · FIRE NOVA'],
    phaseText: { 2: ['THE KING SPLITS', 'MAGMA CUBES INCOMING'], 3: ['MELTDOWN', 'THE FLOOR IS LAVA'] },
    desc: 'A giant bouncing magma cube. Every landing sprays fire; its slam lands right where you are.',
    init(e) { e.hop = null; e.sq = 0; },
    onPhase(e) {
      const n = 2 + (e.mark >= 2 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const c = spawn('magmacube', e.x + (i - (n - 1) / 2) * 60 * view.k, e.y, { size: 2 });
        c.gy = e.y;
        c.mode = 1;
        c.hop = 0;
        c.hdur = 0.5;
        c.hh = 60 * view.k;
        c.hx0 = c.x;
        c.hx1 = clamp(c.x + (i - (n - 1) / 2) * 120 * view.k, c.w, view.w - c.w);
      }
    },
    tick(e, dt) {
      if (e.hop) { updateHop(e, dt); return; }
      e.y = damp(e.y, e.ty, 3, dt);
      e.sq = damp(e.sq, Math.sin(e.t * 3) * 0.08, 6, dt);
    },
    busy: (e) => !!e.hop,
    scale: (e, s) => [s * (1 + e.sq * 0.2), s * (1 - e.sq * 0.2)],
    moves(e) {
      const list = ['hop', 'hop', 'spit'];
      if (e.phase >= 2) list.push('slam', 'hop');
      if (e.phase >= 3) list.push('slam', 'spit');
      return list;
    },
    attack(e, a) {
      const m = e.mark;
      const k = view.k;
      const p = pl();
      switch (a) {
        case 'hop': {
          const tx = clamp(lerp(e.x, p.x, 0.6) + rand(-120, 120) * k, e.w * 0.55, view.w - e.w * 0.55);
          e.hop = { t: 0, kind: 'hop', stage: 'pre', x0: e.x, x1: tx, y0: e.ty, peak: 150 * k, n: 1 };
          e.atk = 0.6;
          break;
        }
        case 'slam':
          e.hop = { t: 0, kind: 'slam', stage: 'pre', x0: e.x, y0: e.y, n: m >= 3 ? 2 : 1 };
          e.atk = 1.2;
          break;
        case 'spit': {
          const n = 3 + (m - 1);
          for (let i = 0; i < n; i++) {
            const tx = rand(0.1, 0.9) * view.w;
            const b = K.eShoot(e.x, e.y, (tx - e.x) * 0.9, -420 * view.vs, 'lavab');
            b.g = 700 * view.vs;
            b.ty = rand(0.5, 0.92) * view.h;
          }
          e.mouth = 0.4;
          Sfx.play('blaze');
          e.atk = 1.3;
          break;
        }
        default:
          break;
      }
    },
    drawFx(e) {
      const h = e.hop;
      if (!h || h.kind !== 'slam' || h.stage !== 'aim') return;
      // the shadow shows exactly where it will land
      const k = view.k;
      const ctx = K.ctx;
      const u = Math.min(1, h.t / 1.1);
      K.world();
      ctx.globalAlpha = 0.25 + u * 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(h.tx, h.ty + e.h * 0.4, e.w * 0.5 * (0.4 + u * 0.6), e.h * 0.14, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ff7a14';
      ctx.lineWidth = 3 * k;
      ctx.globalAlpha = Math.sin(h.t * 25) > 0 ? 0.9 : 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
  };
  function magmaLand(e, big) {
    const k = view.k;
    const n = (big ? 20 : 10) + (e.mark - 1) * 4;
    K.ring(e.x, e.y + e.h * 0.3, n, sp(big ? 240 : 210, e), 'fire');
    if (e.mark >= 3 && big) K.ring(e.x, e.y, 12, sp(160, e), 'shard');
    K.shake(big ? 1 : 0.5);
    K.P(e.x, e.y + e.h * 0.45, 0, 0, 0.5, e.w * (big ? 1.4 : 0.9), C.orange, K.RING);
    for (let i = 0; i < (K.hiQ() ? 12 : 5); i++) K.P(e.x + rand(-0.5, 0.5) * e.w, e.y + e.h * 0.45, rand(-200, 200) * k, -rand(60, 260) * k, 0.7, rand(5, 10) * k, pick(PAL.magma), K.CUBE, 2, 500 * k);
    if (e.mark >= 2 || big) K.addHazard('lava', e.x, e.y + e.h * 0.35, (big ? 90 : 60) * k, big ? 4 : 3, 0);
    e.sq = 1;
    Sfx.play('explode', big ? 2 : 1.4);
    Input.vibrate(big ? 60 : 25);
  }
  function updateHop(e, dt) {
    const h = e.hop;
    const k = view.k;
    h.t += dt;
    if (h.stage === 'pre') {
      e.sq = damp(e.sq, 1, 10, dt);
      if (h.t > 0.32) { h.stage = h.kind === 'hop' ? 'air' : 'up'; h.t = 0; Sfx.play('slime'); }
    } else if (h.stage === 'air') {
      const u = Math.min(1, h.t / 0.7);
      e.x = lerp(h.x0, h.x1, u);
      e.y = h.y0 - Math.sin(u * Math.PI) * h.peak;
      e.sq = damp(e.sq, -0.5 * (1 - u), 10, dt);
      if (u >= 1) { magmaLand(e, false); e.hop = null; }
    } else if (h.stage === 'up') {
      const u = Math.min(1, h.t / 0.5);
      e.y = lerp(h.y0, -e.h, u * u);
      e.sq = -0.5;
      if (u >= 1) {
        const p = pl();
        h.stage = 'aim';
        h.t = 0;
        h.tx = clamp(p.x, e.w * 0.5, view.w - e.w * 0.5);
        h.ty = clamp(p.y - 20 * k, view.h * 0.32, view.h * 0.72);
        e.x = h.tx;
      }
    } else if (h.stage === 'aim') {
      const p = pl();
      if (h.t < 0.6) { h.tx = damp(h.tx, clamp(p.x, e.w * 0.5, view.w - e.w * 0.5), 3, dt); h.ty = damp(h.ty, clamp(p.y - 20 * k, view.h * 0.32, view.h * 0.72), 3, dt); }
      e.x = h.tx;
      if (h.t > 1.1) { h.stage = 'down'; h.t = 0; }
    } else if (h.stage === 'down') {
      const u = Math.min(1, h.t / 0.25);
      e.y = lerp(-e.h, h.ty, u * u);
      if (u >= 1) { magmaLand(e, true); h.stage = 'rest'; h.t = 0; }
    } else if (h.stage === 'rest') {
      if (h.t > 0.45) { h.stage = 'return'; h.t = 0; h.rx = e.x; h.ry = e.y; }
    } else {
      const u = Math.min(1, h.t / 0.8);
      e.x = lerp(h.rx, clamp(h.rx, e.w * 0.6, view.w - e.w * 0.6), u);
      e.y = lerp(h.ry, e.ty, easeOutCubic(u)) - Math.sin(u * Math.PI) * 80 * k;
      if (u >= 1) {
        h.n -= 1;
        if (h.n > 0) Object.assign(h, { t: 0, stage: 'pre', y0: e.y });
        else e.hop = null;
      }
    }
  }

  // ================================================================ 7. BLAZE KING
  function rodPositions(e) {
    const rings = e.mark >= 2 ? 2 : 1;
    const out = [];
    for (let r = 0; r < rings; r++) {
      const n = r ? 8 : 10;
      const R = e.w * (r ? 0.62 : 0.85);
      const a0 = e.rodA * (r ? -1.3 : 1);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU;
        out.push([e.x + Math.cos(a) * R, e.y + Math.sin(a) * R * 0.6, Math.sin(a)]);
      }
    }
    return out;
  }
  function drawKingRods(e, front) {
    const k = view.k;
    const ctx = K.ctx;
    const rw = 9 * k;
    const rh = 26 * k;
    K.world();
    ctx.globalAlpha = 1;
    for (const [x, y, depth] of rodPositions(e)) {
      if ((depth > 0) !== front) continue;
      ctx.fillStyle = front ? '#ffcf3a' : '#a8741a';
      ctx.fillRect(x - rw / 2, y - rh / 2, rw, rh);
      ctx.fillStyle = front ? '#fff2a8' : '#c99532';
      ctx.fillRect(x - rw / 2, y - rh / 2, rw * 0.4, rh);
    }
  }
  const blazeking = {
    name: 'BLAZE KING', img: 'blaze', w: 170, h: 170, hp: 620, score: 13000, glow: C.orange, pal: PAL.blaze,
    music: 'boss', warning: 'THE FORTRESS BURNS!!', entry: 'grow', phases: [0.6, 0.3], mouthY: 0.25, mouthColor: C.orange, crown: true,
    intro: ['ROD SHIELD BLOCKS SHOTS · FIRESTORM · FLAME PILLARS', 'MK II · NEW: DOUBLE ROD RING · HOMING FLAMES', 'MK III · NEW: INFERNO PILLARS · FASTER SPIN'],
    phaseText: { 2: ['THE KING IGNITES', 'HOMING FLAMES'], 3: ['INFERNO', 'THE RODS SPIN FASTER'] },
    desc: 'Spinning blaze rods block your bullets — shoot through the gaps. Calls down pillars of fire.',
    init(e) { e.rodA = 0; e.heat = 0; },
    tick(e, dt) {
      e.rodA += dt * (e.phase === 3 ? 2.2 : 1.3) * (1 + (e.mark - 1) * 0.2);
      e.heat = damp(e.heat, e.queue.length ? 1 : 0.2, 4, dt);
      floatAcross(e, dt, 0.45, 18, 1.8);
      if (K.hiQ() && Math.random() < dt * 14) K.P(e.x + rand(-0.4, 0.4) * e.w, e.y + e.h * 0.4, rand(-10, 10) * view.k, -rand(40, 90) * view.k, rand(0.5, 0.9), 22 * view.k, C.smoke, K.SMOKE, 1);
    },
    busy: () => false,
    moves(e) {
      const list = ['burst', 'firestorm', 'pillars'];
      if (e.phase >= 2) list.push('homing', K.countType('blaze') < 4 ? 'summon' : 'burst');
      if (e.phase >= 3) list.push('pillars', 'firestorm');
      return list;
    },
    attack(e, a) {
      const m = e.mark;
      const k = view.k;
      switch (a) {
        case 'burst':
          for (let i = 0; i < 4 + (m - 1); i++) {
            later(e, i ? 0.18 : 0, () => { K.fan(e.x, e.y + e.h * 0.25, 3, 0.2, sp(320, e), 'fire'); Sfx.play('blaze'); });
          }
          e.atk = 1.3;
          break;
        case 'firestorm':
          K.spiral(e, { time: 2.6, arms: 3, twin: m >= 2, kind: 'fire', speed: 230, oy: 0, rate: 0.1 });
          e.atk = 1.4;
          break;
        case 'pillars': {
          const n = 3 + (m - 1) + (e.phase === 3 ? 1 : 0);
          const xs = [pl().x];
          for (let i = 1; i < n; i++) xs.push(rand(0.06, 0.94) * view.w);
          for (const x of xs) {
            const b = K.makeBeam(clamp(x, 30 * k, view.w - 30 * k), false, true, 'fire');
            b.w = 60 * k;
            b.warn = 1;
            b.fire = 0.6;
            e.beams.push(b);
          }
          Sfx.play('charge');
          e.atk = 1.5;
          break;
        }
        case 'homing': {
          const n = 4 + (m >= 2 ? 2 : 0);
          for (let i = 0; i < n; i++) {
            const a0 = (i / n) * TAU;
            const s = K.bulletSpeed(150);
            K.eShoot(e.x + Math.cos(a0) * e.w * 0.6, e.y + Math.sin(a0) * e.h * 0.4, Math.cos(a0) * s, Math.sin(a0) * s, 'hfire');
          }
          Sfx.play('blaze');
          e.atk = 1.5;
          break;
        }
        case 'summon':
          summonAround(e, 'blaze', 2);
          e.atk = 1.8;
          break;
        default:
          break;
      }
    },
    /** Rods physically block the player's bullets. */
    block(e, b) {
      const rr = 14 * view.k + b.r;
      for (const [x, y] of rodPositions(e)) {
        if ((b.x - x) ** 2 + (b.y - y) ** 2 < rr * rr) {
          K.spark(b.x, b.y, C.orange, 3);
          Sfx.play('armor');
          return true;
        }
      }
      return false;
    },
    glowFx(e) { K.glow(C.orange, e.x, e.y, e.w * (1 + e.heat * 0.4), 0.2 + e.heat * 0.3); },
    drawBack(e) { drawKingRods(e, false); },
    drawFront(e) { drawKingRods(e, true); },
  };

  // ================================================================ 8. ILLUSIONER
  function illusionSlots(e, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push([lerp(0.15, 0.85, n === 1 ? 0.5 : i / (n - 1)) * view.w, e.ty + Math.sin(i * 2.1) * 30 * view.k]);
    return out;
  }
  const illusioner = {
    name: 'THE ILLUSIONER', img: 'illusioner', w: 150, h: 150, hp: 520, score: 13000, glow: C.blue, pal: PAL.illusion,
    music: 'wither', warning: 'NOTHING IS WHAT IT SEEMS!!', entry: 'grow', phases: [0.6, 0.3], mouthY: 0.2, mouthColor: C.blue,
    intro: ['MIRROR CLONES · EVOKER FANGS · ARROW RAIN', 'MK II · NEW: MORE CLONES · TRIPLE FANGS', 'MK III · NEW: CLONES ATTACK · LONGER BLINDNESS'],
    phaseText: { 2: ['NOW YOU SEE ME', 'BLINDNESS'], 3: ['GRAND ILLUSION', 'FIND THE REAL ONE'] },
    desc: 'Hides among mirror clones — only one is real. Summons evoker fangs from below.',
    init(e) { e.hx = e.x; e.blinkT = 4; },
    onDeath() { for (const m of enemies) if (m.type === 'illusion' && !m.dead) { m.dead = true; K.burst(m.x, m.y, C.blue, 10); } },
    tick(e, dt) {
      e.x = damp(e.x, e.hx, 4, dt);
      e.y = damp(e.y, e.ty + Math.sin(e.mt * 1.4) * 12 * view.k, 3, dt);
      e.blinkT -= dt;
      if (e.blinkT <= 0 && !e.queue.length) {
        e.blinkT = rand(4, 6);
        K.burst(e.x, e.y, C.blue, 12);
        e.hx = rand(0.15, 0.85) * view.w;
        e.x = e.hx;
        K.burst(e.x, e.y, C.blue, 12);
        Sfx.play('teleport');
      }
    },
    busy: () => false,
    moves(e) {
      const list = ['volley', 'arrows', 'fangs', K.countType('illusion') ? 'volley' : 'clones'];
      if (e.phase >= 2) list.push(K.isDark() ? 'fangs' : 'blind', 'fangs', 'clones');
      if (e.phase >= 3) list.push('arrows', 'volley');
      return list;
    },
    attack(e, a) {
      const m = e.mark;
      const k = view.k;
      switch (a) {
        case 'volley':
          K.fan(e.x, e.y + e.h * 0.2, 5 + (m - 1) * 2, 0.18, sp(250, e), 'magic', C.blue);
          if (m >= 3) for (const c of enemies) if (c.type === 'illusion' && !c.dead) K.fan(c.x, c.y + c.h * 0.2, 3, 0.2, sp(220, e), 'magic', C.blue);
          e.mouth = 0.3;
          Sfx.play('eshoot');
          e.atk = 1.2;
          break;
        case 'arrows': {
          const n = 14 + (m - 1) * 6;
          for (let i = 0; i < n; i++) {
            const a0 = Math.PI / 2 + rand(-0.15, 0.15);
            const s = K.bulletSpeed(380) * rand(0.9, 1.1);
            K.eShoot(rand(0.03, 0.97) * view.w, -rand(10, 260) * k, Math.cos(a0) * s, Math.sin(a0) * s, 'arrow');
          }
          Sfx.play('eshoot');
          e.atk = 1.4;
          break;
        }
        case 'fangs': {
          const offs = m >= 2 ? [-0.4, 0, 0.4] : [0];
          const base = K.aimAt(e.x, e.y);
          for (const off of offs) {
            const ang = base + off;
            for (let i = 0; i < 16; i++) {
              const d = (70 + i * 46) * k;
              const x = e.x + Math.cos(ang) * d;
              const y = e.y + Math.sin(ang) * d;
              if (x < -20 || x > view.w + 20 || y > view.h + 20) break;
              K.addHazard('fang', x, y, 26 * k, 0.35, 0.45 + i * 0.06);
            }
          }
          Sfx.play('cast');
          e.atk = 1.6;
          break;
        }
        case 'clones': {
          for (const c of enemies) if (c.type === 'illusion') c.dead = true;
          const n = 3 + (m - 1);
          const slots = illusionSlots(e, n + 1);
          const real = randi(0, slots.length - 1);
          K.burst(e.x, e.y, C.blue, 16);
          slots.forEach(([x, y], i) => {
            if (i === real) { e.hx = x; e.x = x; e.y = y; }
            else {
              const c = spawn('illusion', x, y);
              c.bx = x;
              c.ty = y;
            }
            K.burst(x, y, C.blue, 12);
          });
          Sfx.play('teleport');
          e.blinkT = 7;
          e.atk = 1.4;
          break;
        }
        case 'blind':
          K.setDark(3.5 + (m >= 3 ? 1.5 : 0));
          K.popup(pl().x, pl().y - 60 * k, 'BLINDNESS', '#8fb0ff', 12, 1.4);
          Sfx.play('darkness');
          e.atk = 1;
          break;
        default:
          break;
      }
    },
  };

  // ================================================================ 9. GHAST QUEEN
  const ghastqueen = {
    name: 'GHAST QUEEN', img: 'ghast', w: 250, h: 250, hp: 680, score: 14000, glow: C.white, pal: PAL.ghast,
    music: 'boss', warning: 'THE SKY IS CRYING!!', entry: 'drop', phases: [0.6, 0.3], mouthY: 0.25, mouthColor: C.red, crown: true,
    intro: ['FIREBALL BARRAGE · CRYING RAIN · SCREAM', 'MK II · NEW: HOMING TEARS · GHAST ESCORT', 'MK III · NEW: MEGA FIREBALL · DOUBLE SCREAM'],
    phaseText: { 2: ['THE QUEEN WEEPS', 'GHASTS INCOMING'], 3: ['HEARTBREAK', 'THE SKY FALLS'] },
    desc: 'Barrages of fireballs you can shoot back at her, rains of tears and a deafening scream.',
    tick(e, dt) {
      floatAcross(e, dt, 0.4, 14, 1.8);
      if (K.hiQ() && Math.random() < dt * 6) K.P(e.x + rand(-0.25, 0.25) * e.w, e.y + e.h * 0.1, 0, 90 * view.k, 0.8, 7 * view.k, C.blue, K.GLOW, 0.5);
    },
    busy: () => false,
    moves(e) {
      const list = ['barrage', 'tears', 'scream'];
      if (e.phase >= 2) list.push(K.countType('ghast') < 3 ? 'summon' : 'tears', 'barrage');
      if (e.phase >= 3) list.push('tears', 'scream');
      if (e.mark >= 3 && e.phase >= 2) list.push('mega');
      return list;
    },
    attack(e, a) {
      const m = e.mark;
      const k = view.k;
      switch (a) {
        case 'barrage': {
          const n = 3 + (m - 1);
          const base = K.aimAt(e.x, e.y + e.h * 0.25);
          for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * 0.3;
            const s = K.bulletSpeed(170);
            const b = K.eShoot(e.x, e.y + e.h * 0.25, Math.cos(ang) * s, Math.sin(ang) * s, 'ghastball');
            b.fuse = 1.9;
          }
          e.mouth = 0.5;
          Sfx.play('ghast');
          e.atk = 1.6;
          break;
        }
        case 'tears': {
          const n = 18 + (m - 1) * 6;
          for (let i = 0; i < n; i++) {
            const b = K.eShoot(rand(0.03, 0.97) * view.w, -rand(10, 300) * k, 0, K.bulletSpeed(220) * rand(0.85, 1.15), 'tear');
            if (m >= 2) b.home = 0.5;
          }
          Sfx.play('pop');
          e.atk = 1.4;
          break;
        }
        case 'scream': {
          const doScream = () => {
            K.ring(e.x, e.y, 24, sp(210, e), 'fire');
            K.P(e.x, e.y, 0, 0, 0.6, 320 * k, C.red, K.RING);
            K.shake(0.8);
            Sfx.play('ghast');
            Sfx.play('shriek');
          };
          doScream();
          if (m >= 3) later(e, 0.4, doScream);
          e.mouth = 0.7;
          e.atk = 1.5;
          break;
        }
        case 'summon':
          summonAround(e, 'ghast', 2);
          e.atk = 2;
          break;
        case 'mega': {
          const ang = K.aimAt(e.x, e.y);
          const s = K.bulletSpeed(130);
          const b = K.eShoot(e.x, e.y + e.h * 0.25, Math.cos(ang) * s, Math.sin(ang) * s, 'ghastball');
          b.r *= 1.6;
          b.hp = 8;
          b.fuse = 2.4;
          b.big = true;
          Sfx.play('ghast');
          e.atk = 2;
          break;
        }
        default:
          break;
      }
    },
    drawBack(e) { K.drawTentacles(e); },
  };

  // ================================================================ 10. PHANTOM OVERLORD
  const phantomlord = {
    name: 'PHANTOM OVERLORD', img: 'phantomlord', w: 380, h: 226, hp: 720, score: 15000, glow: C.red, pal: PAL.phantom,
    music: 'wither', warning: 'YOU HAVE NOT SLEPT!!', entry: 'drop', phases: [0.66, 0.33], mouthY: -0.35, mouthColor: C.red,
    intro: ['PHANTOM SWARM · DIVE BOMB · FEATHER STORM', 'MK II · NEW: INSOMNIA · WIND WALLS', 'MK III · NEW: TRIPLE DIVE · ENDLESS SWARM'],
    phaseText: { 2: ['INSOMNIA', 'THE SWARM GROWS'], 3: ['NIGHTMARE', 'THE FINAL DREAM'] },
    desc: 'The final boss. Dives from the sky, calls phantom swarms and throws walls of wind.',
    init(e) { e.swoop = null; e.flap = 0; },
    tick(e, dt) {
      e.flap += dt * 7;
      if (e.swoop) { updateSwoop(e, dt); return; }
      const tx = view.w / 2 + Math.sin(e.mt * 0.8) * Math.max(0, view.w / 2 - e.w * 0.45);
      e.x = damp(e.x, tx, 2.4, dt);
      e.y = damp(e.y, e.ty + Math.sin(e.mt * 1.6) * 24 * view.k, 2.5, dt);
      e.rot = Math.cos(e.mt * 0.8) * 0.1;
    },
    busy: (e) => !!e.swoop,
    scale: (e, s) => [s * (1 + Math.sin(e.flap) * 0.05), s],
    moves(e) {
      const list = ['feathers', 'dive', K.countType('phantom') < 8 ? 'swarm' : 'feathers'];
      if (e.phase >= 2) list.push(e.mark >= 2 ? 'insomnia' : 'swarm', 'wall');
      if (e.phase >= 3) list.push('dive', 'wall', 'feathers');
      return list;
    },
    attack(e, a) {
      const m = e.mark;
      const k = view.k;
      switch (a) {
        case 'feathers':
          for (let i = 0; i < 3; i++) {
            later(e, i ? 0.25 : 0, () => {
              const n = 9 + (m - 1) * 2;
              const base = K.aimAt(e.x, e.y) + (i - 1) * 0.12;
              for (let j = 0; j < n; j++) {
                const ang = base + (j - (n - 1) / 2) * 0.17;
                const s = sp(260, e);
                K.eShoot(e.x, e.y, Math.cos(ang) * s, Math.sin(ang) * s, 'magic', C.red);
              }
              Sfx.play('eshoot');
            });
          }
          e.atk = 1.4;
          break;
        case 'dive':
          startSwoop(e, Math.min(3, m));
          e.atk = 1.1;
          break;
        case 'swarm': {
          const n = 4 + (m - 1) * 2;
          for (let i = 0; i < n; i++) spawn('phantom', rand(0.1, 0.9) * view.w, -40 * k - i * 20 * k);
          Sfx.play('vex');
          e.atk = 1.8;
          break;
        }
        case 'insomnia': {
          K.setDark(3);
          K.popup(pl().x, pl().y - 60 * k, 'INSOMNIA', '#ff6a7a', 12, 1.4);
          for (let i = 0; i < 4; i++) {
            const left = i % 2 === 0;
            const ph = spawn('phantom', left ? -30 * k : view.w + 30 * k, rand(0.2, 0.5) * view.h);
            ph.bx = left ? 80 * k : view.w - 80 * k;
          }
          Sfx.play('darkness');
          e.atk = 1.2;
          break;
        }
        case 'wall': {
          const walls = 1 + (m >= 2 ? 1 : 0);
          for (let w = 0; w < walls; w++) {
            later(e, w ? 0.9 : 0, () => {
              const n = 14;
              const gap = randi(1, n - 4);
              for (let i = 0; i < n; i++) {
                if (i >= gap && i < gap + 3) continue;
                K.eShoot(((i + 0.5) / n) * view.w, -12 * k, 0, K.bulletSpeed(150), 'orb', C.red);
              }
              Sfx.play('sonic');
            });
          }
          e.atk = 1.8;
          break;
        }
        default:
          break;
      }
    },
    drawFx(e) { drawSwoop(e); },
  };

  const ALL = { warden, wither, elder, dragon, ravager, magma, blazeking, illusioner, ghastqueen, phantomlord };
  return { ALL, ORDER: Object.keys(ALL) };
};
