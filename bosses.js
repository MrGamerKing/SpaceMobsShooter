/* =========================================================================
   Bosses — ten bosses, one every 5 waves, in this order:
     Warden · Wither · Elder Guardian · Ender Dragon · Ravager ·
     Magma King · Blaze King · Illusioner · Ghast Queen · Phantom Overlord
   After the tenth they return as MK II, MK III... with more bullets, faster
   attacks, extra moves and a new colour. `mark` = which lap this is (1, 2, 3...).

   Difficulty scales every attack through `tier` (see K.tier): it grows with the
   boss phase, the lap (MK) and Hard mode, and adds bullets, waves and speed.

   Every boss is a plain object of hooks the engine (game.js) calls:
     tick(e, dt)      movement + ongoing effects, every frame
     busy(e)          true while a multi-step attack is running
     moves(e)         attack names available right now (repeats = more likely)
     attack(e, name)  start an attack
     harass(e)        small aimed shots fired between attacks (no safe gaps)
     ultimate(e)      the Last Stand attack at 10% health
     onFight / onPhase / onDeath, drawBack / drawFront / drawFx / glowFx, block
   ========================================================================= */
const BossKit = (K) => {
  const { TAU, rand, randi, pick, clamp, lerp, damp, easeOutCubic, easeInOut, C, PAL, view, enemies } = K;
  const later = (e, t, fn) => e.queue.push({ t, fn });
  const pl = () => K.player();
  const sp = (base, e) => K.bulletSpeed(base) * K.bossF(e);
  const T = (e) => K.tier(e);

  // ------------------------------------------------------------ shared moves
  /** Dive at the player (Ender Dragon, Phantom Overlord). */
  function startSwoop(e, count) {
    const p = pl();
    e.swoop = { t: 0, stage: 'warn', n: count, x0: e.x, y0: e.y, tx: p.x, ty: clamp(p.y, view.h * 0.3, view.h - e.h * 0.3) };
    K.sfx('charge');
  }
  function updateSwoop(e, dt) {
    const s = e.swoop;
    const k = view.k;
    s.t += dt;
    const warn = Math.max(0.45, 0.75 - T(e) * 0.05);
    if (s.stage === 'warn') {
      e.x += rand(-1.5, 1.5) * k;
      // keep re-aiming during the first half of the warning
      if (s.t < warn * 0.5) { const p = pl(); s.tx = p.x; s.ty = clamp(p.y, view.h * 0.3, view.h - e.h * 0.3); }
      if (s.t > warn) { s.stage = 'dive'; s.t = 0; K.sfx('dash'); }
    } else if (s.stage === 'dive') {
      const u = Math.min(1, s.t / 0.5);
      const ov = 1.15;
      e.x = lerp(s.x0, s.x0 + (s.tx - s.x0) * ov, u * u);
      e.y = lerp(s.y0, s.y0 + (s.ty - s.y0) * ov, u * u);
      if (K.hiQ() && Math.random() < 0.5) K.P(e.x, e.y - e.h * 0.2, 0, 0, 0.25, e.w * 0.16, e.def.glow, K.GLOW, 2);
      if (u >= 1) {
        s.stage = 'back';
        s.t = 0;
        s.bx = e.x;
        s.by = e.y;
        if (T(e) >= 2) K.ring(e.x, e.y, 10 + T(e) * 2, sp(200, e), 'magic', e.def.glow);
      }
    } else {
      const u = Math.min(1, s.t / 0.7);
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
  const spawn = (type, x, y, o) => {
    const m = K.spawnEnemy(type, x, y, Object.assign({ noElite: true }, o));
    m.spawn = 0;
    return m;
  };
  const summonAround = (e, type, n, o) => {
    const k = view.k;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const m = spawn(type, clamp(e.x + side * e.w * (0.35 + 0.15 * (i >> 1)), 40 * k, view.w - 40 * k), e.y, o);
      K.P(m.x, m.y, 0, 0, 0.4, 60 * k, e.def.glow, K.RING);
    }
    K.sfx('cast');
  };
  /** Several rings in a row, each rotated half a step so the gaps move. */
  const rings = (e, count, gap, fn) => { for (let i = 0; i < count; i++) later(e, i ? gap : 0, fn); };
  const ultBanner = (e) => K.banner('LAST STAND!', e.def.ultName, 'warning', 2200);

  // ================================================================ 1. WARDEN
  const heartbeat = (e) => {
    const x = (e.t * (e.phase === 3 ? 1.7 : 1.1)) % 1;
    return Math.pow(Math.max(0, Math.sin(x * TAU)), 12) + 0.6 * Math.pow(Math.max(0, Math.sin((x - 0.17) * TAU)), 12);
  };
  function sonicVolley(e, lead) {
    const n = Math.min(13, 5 + T(e) * 2);
    K.fan(e.x, e.y + e.h * 0.18, n, 0.15, sp(310, e), 'sonic', null, lead);
    e.mouth = 0.35;
    K.sfx('sonic');
  }
  function sonicRing(e, n, speed) {
    K.ring(e.x, e.y + e.h * 0.18, n, sp(speed, e), 'orb');
    K.P(e.x, e.y + e.h * 0.18, 0, 0, 0.5, 150 * view.k, C.teal, K.RING);
    e.mouth = 0.4;
    K.sfx('sonic');
  }
  const warden = {
    name: 'THE WARDEN', img: 'warden', w: 330, h: 168, hp: 750, hpw: 1, score: 8000, glow: C.teal, pal: PAL.warden,
    music: 'boss', warning: 'SPACE ANCIENT ZONE ALERT!!', entry: 'drop', phases: [0.66, 0.33], mouthY: 0.18, mouthColor: C.cyan,
    intro: ['SONIC VOLLEYS · SONIC BOOM · SUMMONS', 'MK II · NEW: TRIPLE BOOM · SHRIEKERS · DARKNESS', 'MK III · NEW: SWEEPING BOOM · SONIC CHARGE · TWIN SPIRAL'],
    phaseText: { 2: ['THE WARDEN STIRS', 'SONIC BOOM UNLOCKED'], 3: ['ENRAGED!', 'IT CAN SMELL YOU'] },
    ultName: 'SONIC CATACLYSM',
    desc: 'Sonic volleys, sonic boom beams and summons. Later phases add darkness, shriekers and a body slam.',
    pulse: heartbeat,
    harassRate: 1.15,
    harass(e) { K.fan(e.x, e.y + e.h * 0.18, 2 + (e.phase >= 3 ? 1 : 0), 0.14, sp(290, e), 'orb', null, e.phase >= 2); },
    onPhase(e) { rings(e, 2, 0.3, () => sonicRing(e, 18 + T(e) * 2, 210)); },
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
      const hard = K.hard();
      const list = ['volley', 'volley', 'rain', 'ring'];
      if (ph >= 2) list.push('summon', 'beam', 'gapring', 'spiral');
      if (ph >= 3) list.push('beam', 'charge', K.isDark() ? 'ring' : 'darkness');
      if (m >= 2 || (hard && ph >= 3)) list.push(K.countType('shrieker') < 2 ? 'shriekers' : 'ring');
      if (m >= 2 && ph >= 2) list.push('sweep', 'charge');
      return list;
    },
    attack(e, a) {
      const k = view.k;
      const t = T(e);
      switch (a) {
        case 'volley': {
          const shots = 2 + (t >= 2 ? 1 : 0) + (t >= 4 ? 1 : 0);
          for (let i = 0; i < shots; i++) later(e, i ? 0.28 : 0, () => sonicVolley(e, i % 2 === 1));
          e.atk = 1.0;
          break;
        }
        case 'rain': {
          const wave = () => {
            const n = 12 + t * 2;
            for (let i = 0; i < n; i++) {
              const ang = Math.PI / 2 + (i - (n - 1) / 2) * (2.2 / n);
              const v = sp(230, e) * rand(0.9, 1.1);
              K.eShoot(e.x, e.y + e.h * 0.18, Math.cos(ang) * v, Math.sin(ang) * v, 'orb');
            }
            e.mouth = 0.3;
            K.sfx('sonic');
          };
          rings(e, t >= 3 ? 2 : 1, 0.45, wave);
          e.atk = 1.1;
          break;
        }
        case 'ring':
          rings(e, 1 + (t >= 1 ? 1 : 0) + (t >= 4 ? 1 : 0), 0.3, () => sonicRing(e, 20 + t * 4, 220));
          e.atk = 1.2;
          break;
        case 'gapring': {
          // a dense ring with safe gaps — find them! (only one gap on higher tiers)
          const n = 36;
          const g1 = randi(0, n - 1);
          const g2 = t >= 3 ? -99 : (g1 + n / 2 + randi(-3, 3)) % n;
          const near = (i, g) => { const d = Math.abs(i - g); return Math.min(d, n - d) <= 2; };
          const off = rand(TAU);
          const v = sp(200, e);
          for (let i = 0; i < n; i++) {
            if (near(i, g1) || near(i, g2)) continue;
            const ang = off + (i * TAU) / n;
            K.eShoot(e.x, e.y + e.h * 0.18, Math.cos(ang) * v, Math.sin(ang) * v, 'orb');
          }
          K.P(e.x, e.y, 0, 0, 0.5, 160 * k, C.teal, K.RING);
          e.mouth = 0.4;
          e.atk = 1.2;
          K.sfx('sonic');
          break;
        }
        case 'summon':
          if (enemies.length < 14) {
            for (const side of [-1, 1]) {
              spawn(t >= 2 ? 'creeper' : 'zombie', e.x + side * e.w * 0.45, e.y + e.h * 0.2);
              spawn('vex', e.x + side * e.w * 0.3, e.y + e.h * 0.4);
              if (t >= 3) spawn('skeleton', e.x + side * e.w * 0.6, e.y);
            }
            K.sfx('cast');
          }
          e.atk = 1.2;
          break;
        case 'beam': {
          const p = pl();
          e.beams.push(K.makeBeam(p.x, true, false, 'teal'));
          const extra = (t >= 2 ? 1 : 0) + (t >= 4 ? 1 : 0);
          for (let i = 0; i < extra; i++) {
            const side = i === 0 ? (p.x < view.w / 2 ? 1 : -1) : (p.x < view.w / 2 ? -1 : 1);
            e.beams.push(K.makeBeam(clamp(p.x + side * view.w * 0.3, 40 * k, view.w - 40 * k), false, true, 'teal'));
          }
          K.sfx('charge');
          e.atk = 1.1;
          break;
        }
        case 'sweep': {
          // a sky beam sweeps from the player's side toward the middle — get to the far side
          const fromRight = pl().x > view.w / 2;
          const x0 = fromRight ? view.w * 0.96 : view.w * 0.04;
          const x1 = fromRight ? view.w * 0.3 : view.w * 0.7;
          const b = K.makeBeam(x0, false, true, 'teal');
          b.warn = 1;
          b.fire = 1.4;
          b.w = 60 * k;
          b.sweep = true;
          b.vx = (x1 - x0) / b.fire;
          e.beams.push(b);
          K.sfx('charge');
          e.atk = 1.1;
          break;
        }
        case 'shriekers': {
          const pos = [[0.14, 0.34], [0.86, 0.34], [0.3, 0.5], [0.7, 0.5]];
          const n = t >= 4 ? 4 : 2;
          for (let i = 0; i < n; i++) {
            const sh = spawn('shrieker', e.x, e.y + e.h * 0.2);
            sh.tx = pos[i][0] * view.w;
            sh.ty = pos[i][1] * view.h;
          }
          K.sfx('shriek');
          e.atk = 1.0;
          break;
        }
        case 'darkness':
          K.setDark(5 + t * 0.5);
          e.harassT = 0;
          K.sfx('darkness');
          K.popup(e.x, e.y + e.h * 0.6, 'DARKNESS', '#8ffff2', 12, 1.4);
          e.atk = 0.6;
          break;
        case 'charge': {
          const p = pl();
          e.charge = { t: 0, x: p.x, y0: e.y, ty: clamp(p.y - 10 * k, e.ty, view.h - e.h * 0.4), hit: false, n: 1 + (t >= 3 ? 1 : 0) };
          K.sfx('charge');
          e.atk = 1.0;
          break;
        }
        case 'spiral':
          K.spiral(e, { time: 3, arms: 3 + (t >= 3 ? 1 : 0), twin: t >= 2, kind: 'orb', speed: 230, oy: 0.18, rate: 0.085 });
          e.atk = 1.0;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      const k = view.k;
      later(e, 0.2, () => {
        const p = pl();
        for (const off of [-0.3, 0, 0.3]) e.beams.push(Object.assign(K.makeBeam(clamp(p.x + off * view.w, 40 * k, view.w - 40 * k), false, true, 'teal'), { warn: 1.2 }));
        K.sfx('charge');
      });
      rings(e, 3, 0.35, () => sonicRing(e, 24 + T(e) * 3, 230));
      for (let i = 0; i < 3; i++) later(e, 0.3, () => sonicVolley(e, i === 1));
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
      if (c.t < 0.5) c.x = damp(c.x, pl().x, 4, dt);
      e.x = damp(e.x, c.x, 6, dt) + rand(-1.5, 1.5) * k;
      e.y = damp(e.y, c.y0 - 24 * k, 4, dt);
    } else if (c.t < 1.22) {
      const u = (c.t - 0.85) / 0.37;
      e.y = lerp(c.y0 - 24 * k, c.ty, u * u);
    } else if (c.t < 1.45) {
      e.y = c.ty;
      if (!c.hit) {
        c.hit = true;
        K.shake(0.8);
        K.P(e.x, e.y + e.h * 0.4, 0, 0, 0.6, 260 * k, C.teal, K.RING);
        K.ring(e.x, e.y + e.h * 0.3, 16 + T(e) * 3, sp(230, e), 'orb');
        K.sfx('explode', 2);
        Input.vibrate(50);
      }
    } else if (c.t < 2.25) {
      e.y = lerp(c.ty, c.y0, easeOutCubic((c.t - 1.45) / 0.8));
    } else if (c.n > 1) {
      const p = pl();
      Object.assign(c, { t: 0, x: p.x, y0: e.y, ty: clamp(p.y - 10 * k, e.ty, view.h - e.h * 0.4), hit: false, n: c.n - 1 });
      K.sfx('charge');
    } else {
      e.charge = null;
    }
  }

  // ================================================================ 2. WITHER
  const HEADS = [[0, -0.22], [-0.37, -0.02], [0.37, -0.02]];
  function skullVolley(e, lead) {
    const per = 2 + Math.min(2, Math.floor(T(e) / 2));
    const s = sp(300, e);
    for (const [hx, hy] of HEADS) K.fan(e.x + hx * e.w, e.y + hy * e.h, per, 0.12, s, 'wskull', null, lead);
    e.mouth = 0.3;
    K.sfx('wshoot');
  }
  function skullRing(e) {
    K.ring(e.x, e.y, 22 + T(e) * 3, sp(230, e), 'wskull');
    K.P(e.x, e.y, 0, 0, 0.7, 320 * view.k, C.purple, K.RING);
    K.shake(0.5);
    K.sfx('explode', 2);
  }
  const wither = {
    name: 'THE WITHER', img: 'wither', w: 300, h: 180, hp: 1000, hpw: 0.63, score: 10000, glow: C.purple, pal: PAL.wither,
    music: 'wither', warning: 'THE WITHER IS RISING!!', entry: 'grow', phases: [0.5, 0.2], mouthY: -0.22, mouthColor: C.purple,
    intro: ['WITHER SKULLS · BLUE SKULLS · WITHER ARMOR', 'MK II · NEW: SKULL STORM · DIVE BOMBING · SKELETON ARMY', 'MK III · NEW: BLUE SKULL SWARM · TRIPLE RAGE NOVA'],
    phaseText: { 2: ['WITHER ARMOR', 'BULLETS DEAL HALF DAMAGE'], 3: ['WITHER RAGE!', 'DODGE THE SKULL NOVA'] },
    ultName: 'WITHER STORM',
    desc: 'Three heads of exploding skulls and homing blue skulls. Grows armor at half health.',
    harassRate: 0.9,
    harass(e) {
      e.head = ((e.head || 0) + 1) % 3;
      const [hx, hy] = HEADS[e.head];
      K.fan(e.x + hx * e.w, e.y + hy * e.h, e.phase >= 3 ? 2 : 1, 0.1, sp(300, e), 'wskull', null, true);
    },
    onFight(e) { K.explode(e.x, e.y, PAL.wither, 2.5, C.blue); K.flash('white'); },
    onPhase(e, ph) {
      if (ph === 2) e.armor = true;
      rings(e, ph === 3 ? 2 : 1, 0.5, skullRing);
    },
    tick(e, dt) {
      if (e.dash) updateWDash(e, dt);
      else floatAcross(e, dt, 0.7, 20, 2);
      e.rot = Math.sin(e.mt * 1.3) * 0.04;
      if (e.armor && K.hiQ() && Math.random() < dt * 10) K.P(e.x + rand(-0.45, 0.45) * e.w, e.y + rand(-0.4, 0.4) * e.h, 0, -30 * view.k, 0.6, 10 * view.k, C.blue, K.GLOW, 1);
    },
    busy: (e) => !!e.dash,
    moves(e) {
      const ph = e.phase;
      const list = ['skulls', 'skulls', 'blueskull'];
      if (ph >= 2) list.push(K.countType('wskel') < 4 ? 'summonws' : 'skulls', 'dash', 'storm');
      if (ph >= 3) list.push('dashbomb', 'ragering', 'blueskull');
      if (e.mark >= 2) list.push('dashbomb', 'storm');
      return list;
    },
    attack(e, a) {
      const t = T(e);
      switch (a) {
        case 'skulls': {
          const n = 2 + (t >= 2 ? 1 : 0) + (t >= 4 ? 1 : 0);
          for (let i = 0; i < n; i++) later(e, i ? 0.28 : 0, () => skullVolley(e, i % 2 === 1));
          e.atk = 0.9;
          break;
        }
        case 'blueskull':
          K.fan(e.x, e.y - e.h * 0.22, Math.min(5, 2 + Math.floor(t / 2)), 0.4, K.bulletSpeed(160), 'bskull');
          e.mouth = 0.4;
          K.sfx('wshoot');
          e.atk = 1.1;
          break;
        case 'summonws':
          summonAround(e, 'wskel', 2 + (t >= 2 ? 2 : 0));
          e.atk = 1.2;
          break;
        case 'dash':
        case 'dashbomb': {
          const dir = e.x < view.w / 2 ? 1 : -1;
          e.dash = { t: 0, dir, dur: a === 'dashbomb' ? 1.5 : 1.15, x0: e.x, x1: dir > 0 ? view.w - e.w * 0.45 : e.w * 0.45, y0: e.y, low: a === 'dashbomb', drop: 0 };
          K.sfx('charge');
          e.atk = 0.8;
          break;
        }
        case 'storm':
          K.spiral(e, { time: 3, arms: 2 + (t >= 3 ? 1 : 0), twin: t >= 2, kind: 'wskull', speed: 220, oy: -0.22, rate: 0.1 });
          K.sfx('wither');
          e.atk = 1.0;
          break;
        case 'ragering':
          rings(e, 1 + (t >= 2 ? 1 : 0) + (t >= 4 ? 1 : 0), 0.5, skullRing);
          e.atk = 1.2;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      rings(e, 3, 0.55, skullRing);
      later(e, 0.3, () => { K.fan(e.x, e.y - e.h * 0.22, 6, 0.5, K.bulletSpeed(170), 'bskull'); K.sfx('wshoot'); });
      later(e, 0.4, () => this.attack(e, 'dashbomb'));
    },
    glowFx(e) {
      const g = e.grow;
      for (const [hx, hy] of HEADS) K.glow(C.blue, e.x + hx * e.w * g, e.y + hy * e.h * g, 26 * view.k * g, 0.35 + 0.25 * Math.sin(K.time() * 5 + hx * 4));
    },
    drawFx(e) {
      const d = e.dash;
      if (!d || d.t >= 0.6) return;
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
        const y = d.low ? d.y0 + Math.sin(u * Math.PI) * Math.max(0, view.h * 0.5 - d.y0) : d.y0;
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
    if (d.t < 0.6) { e.x += rand(-1, 1) * 2 * view.k; return; }
    const u = Math.min(1, (d.t - 0.6) / d.dur);
    e.x = lerp(d.x0, d.x1, easeInOut(u));
    if (d.low) e.y = d.y0 + Math.sin(u * Math.PI) * Math.max(0, view.h * 0.5 - d.y0);
    d.drop -= dt;
    if (d.drop <= 0) {
      d.drop = Math.max(0.06, (d.low ? 0.09 : 0.12) - T(e) * 0.008);
      K.eShoot(e.x, e.y + e.h * 0.3, rand(-40, 40) * view.k, K.bulletSpeed(270), 'wskull');
    }
    if (u >= 1) e.dash = null;
  }

  // ================================================================ 3. ELDER GUARDIAN
  function fireLasers(e, offs) {
    const p = pl();
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    const warn = Math.max(0.85, 1.3 - T(e) * 0.08);
    for (const off of offs) e.lasers.push({ t: 0, off, ang: base + off, warn, fire: 0.5 + T(e) * 0.05, fired: false, done: false });
    K.sfx('charge');
  }
  function spikeWaves(e, waves) {
    const n = 18 + T(e) * 4;
    for (let i = 0; i < waves; i++) {
      later(e, i ? 0.3 : 0, () => {
        K.ring(e.x, e.y, n, sp(i % 2 ? 210 : 250, e), 'spike', null, rand(TAU));
        K.P(e.x, e.y, 0, 0, 0.4, e.w * 0.8, C.orange, K.RING);
        K.sfx('sonic');
      });
    }
  }
  const elder = {
    name: 'ELDER GUARDIAN', img: 'elder', w: 230, h: 230, hp: 1000, hpw: 0.55, score: 11000, glow: C.teal, pal: PAL.elder,
    music: 'boss', warning: 'SOMETHING STIRS IN THE DEEP!!', entry: 'drop', phases: [0.6, 0.3], mouthY: 0, mouthColor: C.pink,
    intro: ['EYE LASERS · SPIKE BURST · MINING FATIGUE', 'MK II · NEW: TRIPLE LASERS · GUARDIAN PACK', 'MK III · NEW: FIVE TRACKING LASERS · BUBBLE STORM'],
    phaseText: { 2: ['THE DEEP AWAKENS', 'MINING FATIGUE INCOMING'], 3: ['ELDER FURY', 'THE LASERS FOLLOW YOU'] },
    ultName: 'ELDER GAZE',
    desc: 'Charges eye lasers that follow you, bursts spikes and curses you with Mining Fatigue (slow).',
    harassRate: 1.1,
    harass(e) { K.fan(e.x, e.y, 3, 0.16, sp(270, e), 'spike', null, true); },
    init(e) { e.lasers = []; e.curse = 0; },
    tick(e, dt) {
      floatAcross(e, dt, 0.6, 14, 2);
      e.rot = Math.sin(e.mt * 0.8) * 0.06;
      if (e.curse > 0) e.curse -= dt;
      const p = pl();
      const track = T(e) >= 2;
      for (const L of e.lasers) {
        L.t += dt;
        const aim = Math.atan2(p.y - e.y, p.x - e.x) + L.off;
        if (L.t < L.warn) {
          L.ang = K.turnToward(L.ang, aim, 1.8 * dt);
        } else if (L.t < L.warn + L.fire) {
          if (track) L.ang = K.turnToward(L.ang, aim, (0.45 + T(e) * 0.08) * dt);
          if (!L.fired) { L.fired = true; K.sfx('beam'); K.shake(0.4); }
          // the beam burns any ship in its path, not only the one it's tracking
          K.eachPlayer((q) => {
            const dx = q.x - e.x;
            const dy = q.y - e.y;
            const along = dx * Math.cos(L.ang) + dy * Math.sin(L.ang);
            const perp = Math.abs(dx * Math.sin(L.ang) - dy * Math.cos(L.ang));
            if (along > 0 && perp < 18 * view.k + q.r) K.hurtPlayer(K.heavy());
          });
        } else {
          L.done = true;
        }
      }
      for (let i = e.lasers.length - 1; i >= 0; i--) if (e.lasers[i].done) e.lasers.splice(i, 1);
    },
    busy: (e) => e.lasers.length > 0,
    moves(e) {
      const list = ['laser', 'laser', 'spikes', K.countType('guardian') < 4 ? 'summon' : 'spikes'];
      if (e.phase >= 2) list.push('fatigue', 'bubble', 'laser');
      if (e.phase >= 3) list.push('laser', 'spikes', 'bubble');
      return list;
    },
    attack(e, a) {
      const k = view.k;
      const t = T(e);
      switch (a) {
        case 'laser': {
          const n = Math.min(5, 1 + (t >= 1 ? 1 : 0) + (t >= 3 ? 1 : 0) + (t >= 5 ? 2 : 0));
          const offs = n === 1 ? [0] : Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 0.32);
          fireLasers(e, offs);
          e.atk = 0.9;
          break;
        }
        case 'spikes':
          spikeWaves(e, 2 + (t >= 2 ? 1 : 0));
          e.atk = 1.1;
          break;
        case 'fatigue':
          K.setFatigue(4 + t);
          e.curse = 1.4;
          K.popup(pl().x, pl().y - 60 * k, 'MINING FATIGUE', '#c78bff', 12, 1.6);
          K.sfx('darkness');
          e.atk = 0.7;
          break;
        case 'summon': {
          const n = Math.min(4, 2 + Math.floor(t / 2));
          for (let i = 0; i < n; i++) {
            const g = spawn('guardian', e.x + (i - (n - 1) / 2) * 90 * k, e.y + e.h * 0.3);
            g.ty = view.h * rand(0.28, 0.45);
          }
          K.sfx('cast');
          e.atk = 1.1;
          break;
        }
        case 'bubble':
          K.spiral(e, { time: 2.8, arms: 4 + (t >= 3 ? 2 : 0), twin: t >= 2, kind: 'orb', speed: 200, oy: 0, rate: 0.11 });
          e.atk = 1.0;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      later(e, 0.1, () => fireLasers(e, [-0.7, -0.35, 0, 0.35, 0.7]));
      spikeWaves(e, 3);
      later(e, 0.4, () => { K.setFatigue(6); e.curse = 1.4; });
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
    let made = 0;
    for (let i = 0; i < slots.length && made < n && K.countType('crystal') < 5; i++) {
      if (enemies.some((c) => c.type === 'crystal' && !c.dead && Math.abs(c.tx - slots[i][0] * view.w) < 5)) continue;
      const c = spawn('crystal', slots[i][0] * view.w, -40 * view.k);
      c.tx = slots[i][0] * view.w;
      c.ty = Math.max(slots[i][1] * view.h, 90 * view.k);
      made += 1;
    }
    K.popup(view.w / 2, view.h * 0.35, 'DESTROY THE END CRYSTALS!', '#ff6ad5', 12, 2.2);
  }
  function dragonBreath(e, n) {
    const base = K.aimAt(e.x, e.y + e.h * 0.38);
    for (let i = 0; i < n; i++) {
      const ang = base + (i - (n - 1) / 2) * 0.3;
      const s = K.bulletSpeed(200);
      const b = K.eShoot(e.x, e.y + e.h * 0.38, Math.cos(ang) * s, Math.sin(ang) * s, 'dfire');
      b.fuse = 1.7;
    }
    e.mouth = 0.5;
    K.sfx('ghast');
  }
  function acidStorm(e, n) {
    const k = view.k;
    const p = pl();
    K.addHazard('acid', p.x, p.y, 70 * k, 3.5, 0.9);
    for (let i = 1; i < n; i++) K.addHazard('acid', rand(0.1, 0.9) * view.w, rand(0.45, 0.92) * view.h, 60 * k, 3.5, 0.9 + i * 0.08);
    K.sfx('darkness');
  }
  const dragon = {
    name: 'ENDER DRAGON', img: 'dragon', w: 170, h: 106, hp: 1100, hpw: 0.65, score: 12000, glow: C.purple, pal: PAL.dragon,
    music: 'wither', warning: 'THE DRAGON AWAKENS!!', entry: 'drop', phases: [0.66, 0.33], mouthY: 0.38, mouthColor: C.pink,
    intro: ['END CRYSTALS HEAL IT · DRAGON BREATH · SWOOP', 'MK II · NEW: MORE CRYSTALS · FIVE-WAY BREATH', 'MK III · NEW: QUAD SWOOP · ACID STORM EVERYWHERE'],
    phaseText: { 2: ['THE DRAGON ROARS', 'CRYSTALS REBUILT'], 3: ['DRAGON FURY', 'CRYSTALS REBUILT'] },
    ultName: 'END STORM',
    desc: 'End Crystals heal it and shoot at you — destroy them first! Breathes acid clouds and swoops at you.',
    harassRate: 1.2,
    harass(e) { K.fan(e.x, e.y + e.h * 0.38, 3, 0.15, sp(270, e), 'magic', C.pink, e.phase >= 2); },
    init(e) { e.swoop = null; e.flap = 0; },
    onFight(e) { spawnCrystals(e, 3 + (K.hard() ? 1 : 0) + (e.mark >= 2 ? 1 : 0)); },
    onPhase(e) {
      spawnCrystals(e, 2 + Math.floor(T(e) / 2));
      K.ring(e.x, e.y, 20, sp(210, e), 'magic', C.pink);
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
      if (e.phase >= 2) list.push('roar', 'breath', 'acidstorm');
      if (e.phase >= 3) list.push('swoop', 'breath', 'acidstorm');
      return list;
    },
    attack(e, a) {
      const t = T(e);
      const k = view.k;
      switch (a) {
        case 'breath':
          dragonBreath(e, Math.min(5, 1 + t));
          e.atk = 1.1;
          break;
        case 'scatter':
          K.fan(e.x, e.y + e.h * 0.38, 10 + t * 3, 0.12, sp(270, e), 'magic', C.pink);
          if (t >= 2) later(e, 0.3, () => K.fan(e.x, e.y + e.h * 0.38, 7 + t * 2, 0.14, sp(300, e), 'magic', C.pink, true));
          e.mouth = 0.3;
          K.sfx('eshoot');
          e.atk = 0.9;
          break;
        case 'swoop':
          startSwoop(e, Math.min(4, 1 + (t >= 1 ? 1 : 0) + (t >= 3 ? 1 : 0) + (t >= 5 ? 1 : 0)));
          e.atk = 0.8;
          break;
        case 'roar':
          rings(e, 2, 0.35, () => {
            K.ring(e.x, e.y, 22 + t * 3, sp(220, e), 'magic', C.pink);
            K.P(e.x, e.y, 0, 0, 0.6, 300 * k, C.purple, K.RING);
          });
          K.shake(0.6);
          K.sfx('roar');
          e.atk = 1.1;
          break;
        case 'acidstorm':
          acidStorm(e, 4 + t);
          e.atk = 1.1;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      acidStorm(e, 8);
      later(e, 0.4, () => dragonBreath(e, 5));
      later(e, 0.6, () => startSwoop(e, 2));
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
  function boulders(e, n) {
    const k = view.k;
    const p = pl();
    for (let i = 0; i < n; i++) {
      // a third of the boulders are aimed at your column
      const x = i % 3 === 0 ? p.x + rand(-60, 60) * k : rand(0.04, 0.96) * view.w;
      const b = K.eShoot(x, -rand(60, 340) * k, rand(-25, 25) * k, K.bulletSpeed(260) * rand(0.85, 1.2), 'rock');
      if (T(e) >= 2 && i % 3 === 1) b.r *= 1.6;
    }
    K.P(e.x, e.y + e.h * 0.45, 0, 0, 0.5, e.w, C.grey, K.RING);
    K.shake(0.6);
    K.sfx('explode', 1.8);
  }
  const ravager = {
    name: 'RAVAGER', img: 'ravager', w: 250, h: 208, hp: 1200, hpw: 1, score: 12000, glow: C.red, pal: PAL.ravager,
    music: 'boss', warning: 'A RAID IS COMING!!', entry: 'drop', phases: [0.6, 0.3], mouthY: 0.32, mouthColor: C.orange,
    intro: ['RAM CHARGES · ROAR · ROCK STOMP', 'MK II · NEW: QUAD CHARGE · RAID PARTY', 'MK III · NEW: RAMPAGE · BOULDER STORM'],
    phaseText: { 2: ['THE RAID GROWS', 'RAIDERS INCOMING'], 3: ['RAVAGER RAMPAGE', 'KEEP MOVING'] },
    ultName: 'RAMPAGE',
    desc: 'Rams straight at you again and again, roars you away and stomps boulders down from the sky.',
    harassRate: 1.2,
    harass(e) { K.fan(e.x, e.y + e.h * 0.32, 3, 0.18, sp(280, e), 'orb', C.red, e.phase >= 2); },
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
      const list = ['stomp', 'charge', 'charge', 'roar'];
      if (e.phase >= 2) list.push(enemies.length < 12 ? 'summon' : 'stomp', 'charge', 'stomp');
      if (e.phase >= 3) list.push('charge', 'roar', 'stomp');
      return list;
    },
    attack(e, a) {
      const t = T(e);
      const k = view.k;
      switch (a) {
        case 'charge': {
          const p = pl();
          e.rush = { t: 0, stage: 'warn', n: Math.min(5, 2 + Math.floor(t / 2)), hx: e.x, hy: e.ty, tx: p.x, ty: clamp(p.y, e.ty, view.h - e.h * 0.35), x0: e.x, y0: e.y };
          K.sfx('charge');
          e.atk = 0.9;
          break;
        }
        case 'roar': {
          e.mouth = 0.6;
          const R = 340 * k;
          for (const b of K.bullets) if (!b.dead && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < R * R) { b.dead = true; K.spark(b.x, b.y, C.white, 1); }
          K.eachPlayer((p) => { if ((p.x - e.x) ** 2 + (p.y - e.y) ** 2 < (R * 1.4) ** 2) K.knockPlayer(e.x, e.y, 950 * k); });
          rings(e, 2 + (t >= 3 ? 1 : 0), 0.3, () => K.ring(e.x, e.y + e.h * 0.3, 20 + t * 3, sp(240, e), 'orb', C.red));
          K.P(e.x, e.y, 0, 0, 0.6, R, C.red, K.RING);
          K.shake(0.7);
          K.sfx('roar');
          e.atk = 1.1;
          break;
        }
        case 'stomp':
          boulders(e, 12 + t * 3);
          e.atk = 1.0;
          break;
        case 'summon':
          summonAround(e, 'skeleton', 2);
          if (t >= 2) spawn('evoker', e.x, e.y + e.h * 0.3);
          else spawn('zombie', e.x, e.y + e.h * 0.4);
          e.atk = 1.2;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      boulders(e, 20);
      later(e, 0.3, () => {
        const p = pl();
        e.rush = { t: 0, stage: 'warn', n: 5, hx: e.x, hy: e.ty, tx: p.x, ty: clamp(p.y, e.ty, view.h - e.h * 0.35), x0: e.x, y0: e.y };
        K.sfx('charge');
      });
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
    const warn = Math.max(0.4, 0.65 - T(e) * 0.05);
    if (r.stage === 'warn') {
      e.x = r.x0 + rand(-2, 2) * view.k;
      if (r.t < warn * 0.5) { const p = pl(); r.tx = p.x; r.ty = clamp(p.y, e.ty, view.h - e.h * 0.35); }
      if (r.t > warn) { r.stage = 'go'; r.t = 0; K.sfx('dash'); }
    } else if (r.stage === 'go') {
      const u = Math.min(1, r.t / 0.42);
      e.x = lerp(r.x0, r.tx, u * u);
      e.y = lerp(r.y0, r.ty, u * u);
      if (u >= 1) {
        r.stage = 'back';
        r.t = 0;
        r.bx = e.x;
        r.by = e.y;
        K.shake(0.5);
        K.P(e.x, e.y + e.h * 0.4, 0, 0, 0.5, e.w * 0.9, C.grey, K.RING);
        K.ring(e.x, e.y, 12 + T(e) * 2, sp(220, e), 'orb', C.red);
      }
    } else {
      const u = Math.min(1, r.t / 0.6);
      e.x = lerp(r.bx, r.hx, easeOutCubic(u));
      e.y = lerp(r.by, r.hy, easeOutCubic(u));
      if (u >= 1) {
        r.n -= 1;
        if (r.n > 0) {
          const p = pl();
          Object.assign(r, { t: 0, stage: 'warn', x0: e.x, y0: e.y, tx: p.x, ty: clamp(p.y, e.ty, view.h - e.h * 0.35) });
          K.sfx('charge');
        } else {
          e.rush = null;
        }
      }
    }
  }

  // ================================================================ 6. MAGMA KING
  function lavaSpit(e, n) {
    for (let i = 0; i < n; i++) {
      const tx = i === 0 ? pl().x : rand(0.08, 0.92) * view.w;
      const b = K.eShoot(e.x, e.y, (tx - e.x) * 0.9, -420 * view.vs, 'lavab');
      b.g = 700 * view.vs;
      b.ty = i === 0 ? pl().y : rand(0.5, 0.92) * view.h;
    }
    e.mouth = 0.4;
    K.sfx('blaze');
  }
  const magma = {
    name: 'MAGMA KING', img: 'magma', w: 200, h: 200, hp: 1150, hpw: 1, score: 12500, glow: C.orange, pal: PAL.magma,
    music: 'wither', warning: 'THE NETHER BOILS!!', entry: 'drop', phases: [0.6, 0.3], mouthY: 0.3, mouthColor: C.orange, crown: true,
    intro: ['LAVA HOPS · METEOR SLAM · LAVA SPIT', 'MK II · NEW: TRIPLE SLAM · BIGGER SPLITS', 'MK III · NEW: FIRE NOVA · METEOR SHOWER'],
    phaseText: { 2: ['THE KING SPLITS', 'MAGMA CUBES INCOMING'], 3: ['MELTDOWN', 'THE FLOOR IS LAVA'] },
    ultName: 'ERUPTION',
    desc: 'A giant bouncing magma cube. Every landing sprays fire and leaves lava; its slam lands right where you are.',
    harassRate: 1.3,
    harass(e) { if (!e.hop) K.fan(e.x, e.y, 3, 0.2, sp(260, e), 'fire', null, true); },
    init(e) { e.hop = null; e.sq = 0; },
    onPhase(e) {
      const n = 2 + (T(e) >= 2 ? 1 : 0);
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
      const list = ['hop', 'hop', 'spit', 'slam'];
      if (e.phase >= 2) list.push('slam', 'hop', 'spit');
      if (e.phase >= 3) list.push('slam', 'slam');
      return list;
    },
    attack(e, a) {
      const t = T(e);
      const k = view.k;
      const p = pl();
      switch (a) {
        case 'hop': {
          const tx = clamp(lerp(e.x, p.x, 0.7) + rand(-100, 100) * k, e.w * 0.55, view.w - e.w * 0.55);
          e.hop = { t: 0, kind: 'hop', stage: 'pre', x0: e.x, x1: tx, y0: e.ty, peak: 150 * k, n: t >= 2 ? 2 : 1 };
          e.atk = 0.4;
          break;
        }
        case 'slam':
          e.hop = { t: 0, kind: 'slam', stage: 'pre', x0: e.x, y0: e.y, n: Math.min(3, 1 + (t >= 2 ? 1 : 0) + (t >= 4 ? 1 : 0)) };
          e.atk = 0.9;
          break;
        case 'spit':
          lavaSpit(e, 4 + t);
          e.atk = 1.0;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      const k = view.k;
      later(e, 0.2, () => {
        for (let i = 0; i < 14; i++) {
          const b = K.eShoot(rand(0.04, 0.96) * view.w, -rand(40, 400) * k, 0, 200 * view.vs, 'lavab');
          b.g = 300 * view.vs;
          b.ty = rand(0.45, 0.95) * view.h;
        }
      });
      later(e, 0.3, () => { e.hop = { t: 0, kind: 'slam', stage: 'pre', x0: e.x, y0: e.y, n: 3 }; });
    },
    drawFx(e) {
      const h = e.hop;
      if (!h || h.kind !== 'slam' || h.stage !== 'aim') return;
      // the shadow shows exactly where it will land
      const k = view.k;
      const ctx = K.ctx;
      const u = Math.min(1, h.t / 0.9);
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
    const t = T(e);
    const n = (big ? 22 : 12) + t * 3;
    K.ring(e.x, e.y + e.h * 0.3, n, sp(big ? 250 : 220, e), 'fire');
    if (big && t >= 2) K.ring(e.x, e.y, 12 + t, sp(170, e), 'shard');
    K.shake(big ? 1 : 0.5);
    K.P(e.x, e.y + e.h * 0.45, 0, 0, 0.5, e.w * (big ? 1.4 : 0.9), C.orange, K.RING);
    for (let i = 0; i < (K.hiQ() ? 12 : 5); i++) K.P(e.x + rand(-0.5, 0.5) * e.w, e.y + e.h * 0.45, rand(-200, 200) * k, -rand(60, 260) * k, 0.7, rand(5, 10) * k, pick(PAL.magma), K.CUBE, 2, 500 * k);
    K.addHazard('lava', e.x, e.y + e.h * 0.35, (big ? 90 : 60) * k, big ? 4 : 3, 0);
    e.sq = 1;
    K.sfx('explode', big ? 2 : 1.4);
    Input.vibrate(big ? 60 : 25);
  }
  function updateHop(e, dt) {
    const h = e.hop;
    const k = view.k;
    h.t += dt;
    if (h.stage === 'pre') {
      e.sq = damp(e.sq, 1, 10, dt);
      if (h.t > 0.28) { h.stage = h.kind === 'hop' ? 'air' : 'up'; h.t = 0; K.sfx('slime'); }
    } else if (h.stage === 'air') {
      const u = Math.min(1, h.t / 0.6);
      e.x = lerp(h.x0, h.x1, u);
      e.y = h.y0 - Math.sin(u * Math.PI) * h.peak;
      e.sq = damp(e.sq, -0.5 * (1 - u), 10, dt);
      if (u >= 1) {
        magmaLand(e, false);
        h.n -= 1;
        if (h.n > 0) {
          const p = pl();
          Object.assign(h, { t: 0, stage: 'pre', x0: e.x, x1: clamp(lerp(e.x, p.x, 0.8), e.w * 0.55, view.w - e.w * 0.55) });
        } else {
          e.hop = null;
        }
      }
    } else if (h.stage === 'up') {
      const u = Math.min(1, h.t / 0.45);
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
      const aim = Math.max(0.7, 1.05 - T(e) * 0.05);
      if (h.t < aim * 0.6) { h.tx = damp(h.tx, clamp(p.x, e.w * 0.5, view.w - e.w * 0.5), 3.5, dt); h.ty = damp(h.ty, clamp(p.y - 20 * k, view.h * 0.32, view.h * 0.72), 3.5, dt); }
      e.x = h.tx;
      if (h.t > aim) { h.stage = 'down'; h.t = 0; }
    } else if (h.stage === 'down') {
      const u = Math.min(1, h.t / 0.22);
      e.y = lerp(-e.h, h.ty, u * u);
      if (u >= 1) { magmaLand(e, true); h.stage = 'rest'; h.t = 0; }
    } else if (h.stage === 'rest') {
      if (h.t > 0.35) {
        h.n -= 1;
        if (h.n > 0) Object.assign(h, { t: 0, stage: 'up', y0: e.y });
        else { h.stage = 'return'; h.t = 0; h.rx = e.x; h.ry = e.y; }
      }
    } else {
      const u = Math.min(1, h.t / 0.7);
      e.x = lerp(h.rx, clamp(h.rx, e.w * 0.6, view.w - e.w * 0.6), u);
      e.y = lerp(h.ry, e.ty, easeOutCubic(u)) - Math.sin(u * Math.PI) * 80 * k;
      if (u >= 1) e.hop = null;
    }
  }

  // ================================================================ 7. BLAZE KING
  function rodPositions(e) {
    const rings2 = e.mark >= 2 || e.phase >= 2 || K.hard() ? 2 : 1;
    const out = [];
    for (let r = 0; r < rings2; r++) {
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
  function firePillars(e, n, extraWave) {
    const k = view.k;
    const xs = [pl().x];
    for (let i = 1; i < n; i++) xs.push(rand(0.06, 0.94) * view.w);
    for (const x of xs) {
      const b = K.makeBeam(clamp(x, 30 * k, view.w - 30 * k), false, true, 'fire');
      b.w = 60 * k;
      b.warn = Math.max(0.7, 1 - T(e) * 0.05);
      b.fire = 0.6;
      e.beams.push(b);
    }
    if (extraWave) later(e, 0.9, () => firePillars(e, Math.ceil(n / 2), false));
    K.sfx('charge');
  }
  const blazeking = {
    name: 'BLAZE KING', img: 'blaze', w: 170, h: 170, hp: 1150, hpw: 0.4, score: 13000, glow: C.orange, pal: PAL.blaze,
    music: 'boss', warning: 'THE FORTRESS BURNS!!', entry: 'grow', phases: [0.6, 0.3], mouthY: 0.25, mouthColor: C.orange, crown: true,
    intro: ['ROD SHIELD BLOCKS SHOTS · FIRESTORM · FLAME PILLARS', 'MK II · NEW: DOUBLE ROD RING · HOMING FLAMES', 'MK III · NEW: INFERNO PILLARS · FASTER SPIN'],
    phaseText: { 2: ['THE KING IGNITES', 'A SECOND ROD RING'], 3: ['INFERNO', 'THE RODS SPIN FASTER'] },
    ultName: 'INFERNO',
    desc: 'Spinning blaze rods block your bullets — shoot through the gaps. Calls down pillars of fire.',
    harassRate: 0.9,
    harass(e) { K.fan(e.x, e.y + e.h * 0.25, e.phase >= 2 ? 2 : 1, 0.12, sp(320, e), 'fire', null, true); },
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
      if (e.phase >= 2) list.push('homing', K.countType('blaze') < 4 ? 'summon' : 'burst', 'pillars');
      if (e.phase >= 3) list.push('firestorm', 'pillars', 'burst');
      return list;
    },
    attack(e, a) {
      const t = T(e);
      switch (a) {
        case 'burst': {
          const per = Math.min(7, 3 + Math.floor(t / 2) * 2);
          for (let i = 0; i < 4 + t; i++) {
            later(e, i ? 0.16 : 0, () => { K.fan(e.x, e.y + e.h * 0.25, per, 0.18, sp(330, e), 'fire', null, i % 2 === 1); K.sfx('blaze'); });
          }
          e.atk = 0.9;
          break;
        }
        case 'firestorm':
          K.spiral(e, { time: 3, arms: 3 + (t >= 3 ? 1 : 0), twin: t >= 1, kind: 'fire', speed: 240, oy: 0, rate: 0.1 });
          e.atk = 1.0;
          break;
        case 'pillars':
          firePillars(e, Math.min(9, 4 + t), t >= 3);
          e.atk = 1.1;
          break;
        case 'homing': {
          const n = Math.min(12, 6 + t * 2);
          for (let i = 0; i < n; i++) {
            const a0 = (i / n) * TAU;
            const s = K.bulletSpeed(160);
            K.eShoot(e.x + Math.cos(a0) * e.w * 0.6, e.y + Math.sin(a0) * e.h * 0.4, Math.cos(a0) * s, Math.sin(a0) * s, 'hfire');
          }
          K.sfx('blaze');
          e.atk = 1.1;
          break;
        }
        case 'summon':
          summonAround(e, 'blaze', 2);
          e.atk = 1.2;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      firePillars(e, 8, true);
      later(e, 0.3, () => K.spiral(e, { time: 3, arms: 4, twin: true, kind: 'fire', speed: 240, oy: 0, rate: 0.1 }));
      later(e, 0.2, () => this.attack(e, 'homing'));
    },
    /** Rods physically block the player's bullets. */
    block(e, b) {
      const rr = 9 * view.k + b.r;
      if (b.rodPass) return false; // this bullet already slipped past the rods
      for (const [x, y, depth] of rodPositions(e)) {
        if (depth <= 0) continue; // only the rods in front of the king block
        if ((b.x - x) ** 2 + (b.y - y) ** 2 < rr * rr) {
          // each bullet gets one roll against the rods: 30% are blocked
          if (Math.random() < 0.7) { b.rodPass = true; return false; }
          K.spark(b.x, b.y, C.orange, 3);
          K.sfx('armor');
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
    for (let i = 0; i < n; i++) out.push([lerp(0.12, 0.88, n === 1 ? 0.5 : i / (n - 1)), e.ty + Math.sin(i * 2.1) * 30 * view.k]);
    return out.map(([x, y]) => [x * view.w, y]);
  }
  function fangLine(e, ang, delay = 0) {
    const k = view.k;
    for (let i = 0; i < 16; i++) {
      const d = (70 + i * 46) * k;
      const x = e.x + Math.cos(ang) * d;
      const y = e.y + Math.sin(ang) * d;
      if (x < -20 || x > view.w + 20 || y > view.h + 20) break;
      K.addHazard('fang', x, y, 26 * k, 0.35, delay + Math.max(0.3, 0.45 - T(e) * 0.03) + i * 0.055);
    }
  }
  function fangCircle(e) {
    const p = pl();
    const k = view.k;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      K.addHazard('fang', p.x + Math.cos(a) * 95 * k, p.y + Math.sin(a) * 95 * k, 26 * k, 0.4, 0.7);
    }
    K.addHazard('fang', p.x, p.y, 30 * k, 0.4, 1.1);
  }
  function makeClones(e, n) {
    for (const c of enemies) if (c.type === 'illusion') c.dead = true;
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
    K.sfx('teleport');
    e.blinkT = 7;
  }
  const illusioner = {
    name: 'THE ILLUSIONER', img: 'illusioner', w: 150, h: 150, hp: 1000, hpw: 0.85, score: 13000, glow: C.blue, pal: PAL.illusion,
    music: 'wither', warning: 'NOTHING IS WHAT IT SEEMS!!', entry: 'grow', phases: [0.6, 0.3], mouthY: 0.2, mouthColor: C.blue,
    intro: ['MIRROR CLONES · EVOKER FANGS · ARROW RAIN', 'MK II · NEW: MORE CLONES · FIVE FANG LINES', 'MK III · NEW: FANG TRAPS · LONGER BLINDNESS'],
    phaseText: { 2: ['NOW YOU SEE ME', 'THE CLONES FIGHT BACK'], 3: ['GRAND ILLUSION', 'FIND THE REAL ONE'] },
    ultName: 'GRAND ILLUSION',
    desc: 'Hides among mirror clones that shoot too — only one is real. Summons evoker fangs from below.',
    harassRate: 1.1,
    harass(e) {
      K.fan(e.x, e.y + e.h * 0.2, 3, 0.16, sp(260, e), 'magic', C.blue, true);
      if (T(e) >= 2) for (const c of enemies) if (c.type === 'illusion' && !c.dead) K.fan(c.x, c.y + c.h * 0.2, 1, 0, sp(240, e), 'magic', C.blue);
    },
    init(e) { e.hx = e.x; e.blinkT = 4; },
    onFight(e) { if (K.hard()) makeClones(e, 3); },
    onDeath() { for (const m of enemies) if (m.type === 'illusion' && !m.dead) { m.dead = true; K.burst(m.x, m.y, C.blue, 10); } },
    tick(e, dt) {
      e.x = damp(e.x, e.hx, 4, dt);
      e.y = damp(e.y, e.ty + Math.sin(e.mt * 1.4) * 12 * view.k, 3, dt);
      e.blinkT -= dt;
      if (e.blinkT <= 0 && !e.queue.length) {
        e.blinkT = rand(3.5, 5.5);
        K.burst(e.x, e.y, C.blue, 12);
        e.hx = rand(0.15, 0.85) * view.w;
        e.x = e.hx;
        K.burst(e.x, e.y, C.blue, 12);
        K.sfx('teleport');
      }
    },
    busy: () => false,
    moves(e) {
      const list = ['volley', 'arrows', 'fangs', K.countType('illusion') ? 'fangs' : 'clones'];
      if (e.phase >= 2) list.push(K.isDark() ? 'fangs' : 'blind', 'fangs', 'clones');
      if (e.phase >= 3) list.push('arrows', 'volley', 'fangtrap');
      return list;
    },
    attack(e, a) {
      const t = T(e);
      const k = view.k;
      switch (a) {
        case 'volley':
          K.fan(e.x, e.y + e.h * 0.2, 7 + t * 2, 0.16, sp(260, e), 'magic', C.blue);
          if (t >= 1) for (const c of enemies) if (c.type === 'illusion' && !c.dead) K.fan(c.x, c.y + c.h * 0.2, 3, 0.2, sp(230, e), 'magic', C.blue, true);
          e.mouth = 0.3;
          K.sfx('eshoot');
          e.atk = 0.9;
          break;
        case 'arrows': {
          const wave = () => {
            const n = 15 + t * 5;
            for (let i = 0; i < n; i++) {
              const a0 = Math.PI / 2 + rand(-0.15, 0.15);
              const s = K.bulletSpeed(380) * rand(0.9, 1.1);
              K.eShoot(rand(0.03, 0.97) * view.w, -rand(10, 260) * k, Math.cos(a0) * s, Math.sin(a0) * s, 'arrow');
            }
            K.sfx('eshoot');
          };
          rings(e, t >= 2 ? 2 : 1, 0.7, wave);
          e.atk = 1.1;
          break;
        }
        case 'fangs': {
          const lines = Math.min(5, 1 + (t >= 1 ? 2 : 0) + (t >= 3 ? 2 : 0));
          const base = K.aimAt(e.x, e.y);
          for (let i = 0; i < lines; i++) fangLine(e, base + (i - (lines - 1) / 2) * 0.35);
          K.sfx('cast');
          e.atk = 1.1;
          break;
        }
        case 'fangtrap':
          fangCircle(e);
          K.sfx('cast');
          e.atk = 0.9;
          break;
        case 'clones':
          makeClones(e, Math.min(6, 3 + Math.floor(t / 2)));
          e.atk = 1.0;
          break;
        case 'blind':
          K.setDark(3.5 + t * 0.5);
          K.popup(pl().x, pl().y - 60 * k, 'BLINDNESS', '#8fb0ff', 12, 1.4);
          K.sfx('darkness');
          e.atk = 0.8;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      makeClones(e, 6);
      later(e, 0.3, () => fangCircle(e));
      later(e, 0.5, () => this.attack(e, 'arrows'));
      later(e, 0.6, () => this.attack(e, 'volley'));
    },
  };

  // ================================================================ 9. GHAST QUEEN
  function ghastBarrage(e, n) {
    const base = K.aimAt(e.x, e.y + e.h * 0.25);
    for (let i = 0; i < n; i++) {
      const ang = base + (i - (n - 1) / 2) * 0.28;
      const s = K.bulletSpeed(180);
      const b = K.eShoot(e.x, e.y + e.h * 0.25, Math.cos(ang) * s, Math.sin(ang) * s, 'ghastball');
      b.fuse = 1.8;
    }
    e.mouth = 0.5;
    K.sfx('ghast');
  }
  function tears(e, n, homing) {
    const k = view.k;
    for (let i = 0; i < n; i++) {
      const b = K.eShoot(rand(0.03, 0.97) * view.w, -rand(10, 300) * k, 0, K.bulletSpeed(230) * rand(0.85, 1.15), 'tear');
      if (homing) b.home = 0.6;
    }
    K.sfx('pop');
  }
  function scream(e) {
    K.ring(e.x, e.y, 24 + T(e) * 2, sp(220, e), 'fire');
    K.P(e.x, e.y, 0, 0, 0.6, 320 * view.k, C.red, K.RING);
    K.shake(0.8);
    K.sfx('ghast');
    K.sfx('shriek');
  }
  function megaFireball(e) {
    const ang = K.aimAt(e.x, e.y);
    const s = K.bulletSpeed(140);
    const b = K.eShoot(e.x, e.y + e.h * 0.25, Math.cos(ang) * s, Math.sin(ang) * s, 'ghastball');
    b.r *= 1.6;
    b.hp = 8;
    b.fuse = 2.3;
    b.big = true;
    K.sfx('ghast');
  }
  const ghastqueen = {
    name: 'GHAST QUEEN', img: 'ghast', w: 250, h: 250, hp: 1300, hpw: 1.2, score: 14000, glow: C.white, pal: PAL.ghast,
    music: 'boss', warning: 'THE SKY IS CRYING!!', entry: 'drop', phases: [0.6, 0.3], mouthY: 0.25, mouthColor: C.red, crown: true,
    intro: ['FIREBALL BARRAGE · CRYING RAIN · SCREAM', 'MK II · NEW: HOMING TEARS · GHAST ESCORT', 'MK III · NEW: TWIN MEGA FIREBALLS · TRIPLE SCREAM'],
    phaseText: { 2: ['THE QUEEN WEEPS', 'THE TEARS FOLLOW YOU'], 3: ['HEARTBREAK', 'MEGA FIREBALLS'] },
    ultName: 'SORROW',
    desc: 'Barrages of fireballs you can shoot back at her, rains of homing tears and a deafening scream.',
    harassRate: 1.2,
    harass(e) { K.fan(e.x, e.y + e.h * 0.25, 3, 0.2, sp(260, e), 'fire', null, true); },
    tick(e, dt) {
      floatAcross(e, dt, 0.4, 14, 1.8);
      if (K.hiQ() && Math.random() < dt * 6) K.P(e.x + rand(-0.25, 0.25) * e.w, e.y + e.h * 0.1, 0, 90 * view.k, 0.8, 7 * view.k, C.blue, K.GLOW, 0.5);
    },
    busy: () => false,
    moves(e) {
      const list = ['barrage', 'tears', 'scream'];
      if (e.phase >= 2) list.push(K.countType('ghast') < 3 ? 'summon' : 'tears', 'barrage', 'tears');
      if (e.phase >= 3) list.push('mega', 'scream', 'barrage');
      return list;
    },
    attack(e, a) {
      const t = T(e);
      switch (a) {
        case 'barrage':
          ghastBarrage(e, Math.min(8, 3 + t));
          e.atk = 1.1;
          break;
        case 'tears':
          tears(e, 18 + t * 5, t >= 2);
          if (t >= 3) later(e, 0.8, () => tears(e, 12 + t * 3, true));
          e.atk = 1.0;
          break;
        case 'scream':
          rings(e, 1 + (t >= 1 ? 1 : 0) + (t >= 3 ? 1 : 0), 0.35, scream);
          e.mouth = 0.7;
          e.atk = 1.1;
          break;
        case 'summon':
          summonAround(e, 'ghast', 2);
          e.atk = 1.3;
          break;
        case 'mega':
          megaFireball(e);
          if (t >= 4) later(e, 0.6, megaFireball);
          e.atk = 1.4;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      rings(e, 3, 0.7, () => tears(e, 26, true));
      later(e, 0.2, megaFireball);
      rings(e, 2, 0.4, scream);
    },
    drawBack(e) { K.drawTentacles(e); },
  };

  // ================================================================ 10. PHANTOM OVERLORD
  function windWall(e) {
    const k = view.k;
    const n = 14;
    const gapW = T(e) >= 4 ? 2 : 3;
    const gap = randi(1, n - gapW - 1);
    for (let i = 0; i < n; i++) {
      if (i >= gap && i < gap + gapW) continue;
      K.eShoot(((i + 0.5) / n) * view.w, -12 * k, 0, K.bulletSpeed(150 + T(e) * 10), 'orb', C.red);
    }
    K.sfx('sonic');
  }
  const phantomlord = {
    name: 'PHANTOM OVERLORD', img: 'phantomlord', w: 380, h: 226, hp: 1400, hpw: 1, score: 15000, glow: C.red, pal: PAL.phantom,
    music: 'wither', warning: 'YOU HAVE NOT SLEPT!!', entry: 'drop', phases: [0.66, 0.33], mouthY: -0.35, mouthColor: C.red,
    intro: ['PHANTOM SWARM · DIVE BOMBS · FEATHER STORM', 'MK II · NEW: INSOMNIA · QUAD WIND WALLS', 'MK III · NEW: FIVE-DIVE CHAIN · ENDLESS SWARM'],
    phaseText: { 2: ['INSOMNIA', 'THE SWARM GROWS'], 3: ['NIGHTMARE', 'THE FINAL DREAM'] },
    ultName: 'NIGHTMARE',
    desc: 'The final boss. Chains dive bombs, calls phantom swarms and throws walls of wind with tiny gaps.',
    harassRate: 1.0,
    harass(e) { K.fan(e.x, e.y, 3, 0.16, sp(280, e), 'magic', C.red, true); },
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
      const list = ['feathers', 'dive', K.countType('phantom') < 10 ? 'swarm' : 'feathers', 'wall'];
      if (e.phase >= 2) list.push('insomnia', 'wall', 'dive');
      if (e.phase >= 3) list.push('dive', 'wall', 'feathers');
      return list;
    },
    attack(e, a) {
      const t = T(e);
      const k = view.k;
      switch (a) {
        case 'feathers': {
          const arcs = 3 + Math.floor(t / 2);
          for (let i = 0; i < arcs; i++) {
            later(e, i ? 0.22 : 0, () => {
              const n = 9 + t * 2;
              const base = K.aimAt(e.x, e.y) + ((i % 3) - 1) * 0.12;
              for (let j = 0; j < n; j++) {
                const ang = base + (j - (n - 1) / 2) * 0.16;
                const s = sp(270, e);
                K.eShoot(e.x, e.y, Math.cos(ang) * s, Math.sin(ang) * s, 'magic', C.red);
              }
              K.sfx('eshoot');
            });
          }
          e.atk = 1.0;
          break;
        }
        case 'dive':
          startSwoop(e, Math.min(5, 2 + Math.floor(t / 2)));
          e.atk = 0.8;
          break;
        case 'swarm': {
          const n = 5 + t;
          for (let i = 0; i < n; i++) spawn('phantom', rand(0.1, 0.9) * view.w, -40 * k - i * 20 * k);
          K.sfx('vex');
          e.atk = 1.2;
          break;
        }
        case 'insomnia': {
          K.setDark(3 + t * 0.5);
          K.popup(pl().x, pl().y - 60 * k, 'INSOMNIA', '#ff6a7a', 12, 1.4);
          for (let i = 0; i < 4 + t; i++) {
            const left = i % 2 === 0;
            const ph = spawn('phantom', left ? -30 * k : view.w + 30 * k, rand(0.2, 0.5) * view.h);
            ph.bx = left ? 80 * k : view.w - 80 * k;
          }
          K.sfx('darkness');
          e.atk = 0.9;
          break;
        }
        case 'wall':
          rings(e, Math.min(4, 2 + Math.floor(t / 2)), 0.85, windWall);
          e.atk = 1.2;
          break;
        default:
          break;
      }
    },
    ultimate(e) {
      ultBanner(e);
      later(e, 0.1, () => this.attack(e, 'insomnia'));
      rings(e, 4, 0.8, windWall);
      later(e, 0.3, () => startSwoop(e, 3));
    },
    drawFx(e) { drawSwoop(e); },
  };

  const ALL = { warden, wither, elder, dragon, ravager, magma, blazeking, illusioner, ghastqueen, phantomlord };
  return { ALL, ORDER: Object.keys(ALL) };
};
