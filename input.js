/* =========================================================================
   Input — keyboard, mouse, touch gestures, virtual joystick and gamepad
   =========================================================================
   Touch "drag" scheme : put a finger anywhere and slide — the ship moves by
                         the same offset (it never hides under your thumb).
   Touch "joystick"    : floating stick on the left half, gestures on the right.
   Gestures            : flick (fast swipe + release) = dash in that direction
                         two-finger tap (drag) / double-tap right side (joystick) = Nova
   ========================================================================= */
const Input = (() => {
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'fire', KeyJ: 'fire', KeyZ: 'fire',
    ShiftLeft: 'dash', ShiftRight: 'dash', KeyK: 'dash', KeyX: 'dash',
    KeyB: 'nova', KeyL: 'nova', KeyC: 'nova',
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute', KeyF: 'autofire',
  };
  const GAME_KEYS = new Set(['left', 'right', 'up', 'down', 'fire', 'dash', 'nova']);

  const held = new Map();   // code -> action
  const edges = new Set();  // actions pressed this frame
  const menuFns = [];
  const deviceFns = [];
  const S = {
    x: 0, y: 0,           // analog move direction (-1..1)
    target: null,         // absolute ship target {x, y} while dragging / mouse steering
    fire: false,
    gpX: 0, gpY: 0, gpFire: false,
    flick: null,
    device: Settings.isTouch ? 'touch' : 'keyboard',
  };
  const drag = { id: null, sx: 0, sy: 0, px: 0, py: 0, x: 0, y: 0, t0: 0 };
  const joy = { id: null, cx: 0, cy: 0, dx: 0, dy: 0, R: 58 };
  const extra = new Map();  // secondary touch pointers (gestures)
  let mouseSteer = false;
  let lastTap = 0;
  let hooks = null;
  let els = {};

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function setDevice(d) {
    if (S.device === d) return;
    S.device = d;
    deviceFns.forEach((fn) => fn(d));
  }
  const isHeld = (act) => { for (const a of held.values()) if (a === act) return true; return false; };

  // screen → world (the co-op world can be scaled to fit a differently shaped screen)
  const toWorld = (x, y) => (hooks && hooks.toWorld ? hooks.toWorld(x, y) : { x, y });
  const zoom = () => (hooks && hooks.zoom ? hooks.zoom() || 1 : 1);
  const typing = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox'));

  // ------------------------------------------------------------ keyboard
  function onKeyDown(e) {
    if (typing(e.target)) return; // typing a name or password
    const act = KEYMAP[e.code];
    if (!act) return;
    if (hooks.playing() && GAME_KEYS.has(act)) e.preventDefault();
    if (GAME_KEYS.has(act)) setDevice('keyboard');
    held.set(e.code, act);
    if (!e.repeat) edges.add(act);
  }
  function onKeyUp(e) { held.delete(e.code); }

  // ------------------------------------------------------------ pointer
  function onPointerDown(e) {
    if (!hooks.playing()) return;
    e.preventDefault();
    const touch = e.pointerType !== 'mouse';
    setDevice(touch ? 'touch' : 'mouse');
    try { els.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const now = performance.now();

    if (!touch) {
      if (e.button === 2) { edges.add('nova'); return; }
      if (e.button === 0) {
        mouseSteer = true;
        S.fire = true;
        S.target = toWorld(e.clientX, e.clientY);
      }
      return;
    }

    if (Settings.get('touchScheme') === 'joystick') {
      const stickSide = Settings.get('lefty') ? e.clientX > window.innerWidth * 0.5 : e.clientX < window.innerWidth * 0.5;
      if (joy.id === null && stickSide) { startJoy(e); return; }
      extra.set(e.pointerId, { sx: e.clientX, sy: e.clientY, t: now });
      return;
    }

    if (drag.id === null) {
      const p = hooks.player();
      drag.id = e.pointerId;
      drag.sx = drag.x = e.clientX;
      drag.sy = drag.y = e.clientY;
      drag.px = p.x;
      drag.py = p.y;
      drag.t0 = now;
      S.target = { x: p.x, y: p.y };
      S.fire = true;
      showDot(e.clientX, e.clientY);
    } else {
      extra.set(e.pointerId, { sx: e.clientX, sy: e.clientY, t: now });
    }
  }

  function onPointerMove(e) {
    if (mouseSteer && e.pointerType === 'mouse') {
      S.target = toWorld(e.clientX, e.clientY);
      return;
    }
    if (e.pointerId === drag.id && S.target) {
      drag.x = e.clientX;
      drag.y = e.clientY;
      const s = Settings.get('sensitivity') / zoom();
      const b = hooks.bounds();
      const tx = drag.px + (e.clientX - drag.sx) * s;
      const ty = drag.py + (e.clientY - drag.sy) * s;
      const cx = clamp(tx, b.minX, b.maxX);
      const cy = clamp(ty, b.minY, b.maxY);
      // Re-anchor when pinned against an edge so reversing direction responds instantly
      drag.px += cx - tx;
      drag.py += cy - ty;
      S.target.x = cx;
      S.target.y = cy;
      moveDot(e.clientX, e.clientY);
    } else if (e.pointerId === joy.id) {
      moveJoy(e);
    }
  }

  function onPointerUp(e, cancelled) {
    const now = performance.now();
    if (e.pointerType === 'mouse') {
      if (mouseSteer) { mouseSteer = false; S.fire = false; S.target = null; }
      return;
    }
    if (e.pointerId === drag.id) {
      const dt = now - drag.t0;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      const d = Math.hypot(dx, dy);
      if (!cancelled && dt < 230 && d > 42) flick(dx / d, dy / d);
      drag.id = null;
      S.target = null;
      S.fire = false;
      hideDot();
    } else if (e.pointerId === joy.id) {
      endJoy();
    } else if (extra.has(e.pointerId)) {
      const t = extra.get(e.pointerId);
      extra.delete(e.pointerId);
      if (cancelled) return;
      const dt = now - t.t;
      const dx = e.clientX - t.sx;
      const dy = e.clientY - t.sy;
      const d = Math.hypot(dx, dy);
      if (Settings.get('touchScheme') === 'joystick') {
        if (dt < 260 && d > 36) flick(dx / d, dy / d);
        else if (dt < 260 && d < 22) {
          if (now - lastTap < 330) { edges.add('nova'); lastTap = 0; } else lastTap = now;
        }
      } else if (dt < 320 && d < 30) {
        edges.add('nova'); // two-finger tap
      }
    }
  }

  function flick(nx, ny) {
    S.flick = { x: nx, y: ny };
    edges.add('dash');
  }

  // ------------------------------------------------------------ joystick + finger dot visuals
  function startJoy(e) {
    joy.id = e.pointerId;
    joy.cx = e.clientX;
    joy.cy = e.clientY;
    joy.dx = joy.dy = 0;
    els.joy.style.transform = `translate(${joy.cx}px, ${joy.cy}px)`;
    els.knob.style.transform = 'translate(0px, 0px)';
    els.joy.classList.add('on');
  }
  function moveJoy(e) {
    let dx = e.clientX - joy.cx;
    let dy = e.clientY - joy.cy;
    const d = Math.hypot(dx, dy);
    if (d > joy.R) {
      // floating stick: the base follows the thumb
      joy.cx += dx - (dx / d) * joy.R;
      joy.cy += dy - (dy / d) * joy.R;
      dx = (dx / d) * joy.R;
      dy = (dy / d) * joy.R;
      els.joy.style.transform = `translate(${joy.cx}px, ${joy.cy}px)`;
    }
    joy.dx = dx / joy.R;
    joy.dy = dy / joy.R;
    els.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function endJoy() {
    joy.id = null;
    joy.dx = joy.dy = 0;
    if (els.joy) els.joy.classList.remove('on');
  }
  function showDot(x, y) { if (!els.dot) return; moveDot(x, y); els.dot.classList.add('on'); }
  function moveDot(x, y) { if (els.dot) els.dot.style.transform = `translate(${x}px, ${y}px)`; }
  function hideDot() { if (els.dot) els.dot.classList.remove('on'); }

  // ------------------------------------------------------------ gamepad
  const gpPrev = [];
  function pollGamepad() {
    S.gpX = S.gpY = 0;
    S.gpFire = false;
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const btn = (i) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4);
      let ax = gp.axes[0] || 0;
      let ay = gp.axes[1] || 0;
      const m = Math.hypot(ax, ay);
      if (m < 0.2) { ax = ay = 0; } else { const o = Math.min(1, (m - 0.2) / 0.75); ax = (ax / m) * o; ay = (ay / m) * o; }
      if (btn(14)) ax = -1;
      if (btn(15)) ax = 1;
      if (btn(12)) ay = -1;
      if (btn(13)) ay = 1;
      const now = {
        a: btn(0), b: btn(1), x: btn(2), y: btn(3), lb: btn(4), rb: btn(5), rt: btn(7), start: btn(9),
        up: ay < -0.6, down: ay > 0.6, left: ax < -0.6, right: ax > 0.6,
      };
      const prev = gpPrev[gp.index] || {};
      const pressed = (k) => now[k] && !prev[k];
      gpPrev[gp.index] = now;
      if (Object.keys(now).some(pressed) || m > 0.3) setDevice('gamepad');

      if (hooks.playing()) {
        S.gpX += ax;
        S.gpY += ay;
        if (now.a || now.rt) S.gpFire = true;
        if (pressed('b') || pressed('rb')) edges.add('dash');
        if (pressed('x') || pressed('y') || pressed('lb')) edges.add('nova');
        if (pressed('start')) edges.add('pause');
      } else {
        ['up', 'down', 'left', 'right'].forEach((k) => { if (pressed(k)) emitMenu(k); });
        if (pressed('a')) emitMenu('confirm');
        if (pressed('b')) emitMenu('back');
        if (pressed('start')) emitMenu('start');
      }
    }
  }
  const emitMenu = (a) => menuFns.forEach((fn) => fn(a));

  function computeAxes() {
    let x = 0;
    let y = 0;
    if (isHeld('left')) x -= 1;
    if (isHeld('right')) x += 1;
    if (isHeld('up')) y -= 1;
    if (isHeld('down')) y += 1;
    if (joy.id !== null) {
      const m = Math.hypot(joy.dx, joy.dy);
      if (m > 0.12) {
        const o = Math.min(1, (m - 0.12) / 0.8);
        x += (joy.dx / m) * o;
        y += (joy.dy / m) * o;
      }
    }
    x += S.gpX;
    y += S.gpY;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    S.x = x;
    S.y = y;
  }

  function reset() {
    held.clear();
    edges.clear();
    drag.id = null;
    S.target = null;
    S.fire = false;
    S.flick = null;
    mouseSteer = false;
    extra.clear();
    endJoy();
    hideDot();
  }

  return {
    init(canvas, h) {
      hooks = h;
      els = { canvas, joy: document.getElementById('joy'), knob: document.getElementById('joyKnob'), dot: document.getElementById('touchDot') };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', () => { held.clear(); });
      canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
      canvas.addEventListener('pointermove', onPointerMove, { passive: true });
      canvas.addEventListener('pointerup', (e) => onPointerUp(e, false));
      canvas.addEventListener('pointercancel', (e) => onPointerUp(e, true));
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('gamepadconnected', (e) => {
        setDevice('gamepad');
        if (typeof UI !== 'undefined') UI.toast('GAMEPAD CONNECTED');
      });
    },
    update() { pollGamepad(); computeAxes(); },
    endFrame() { edges.clear(); },
    consume(a) { if (edges.has(a)) { edges.delete(a); return true; } return false; },
    takeFlick() { const f = S.flick; S.flick = null; return f; },
    /** After a dash the ship jumps — restart the drag from the finger's current spot. */
    rebase() {
      if (drag.id === null || !S.target) return;
      const p = hooks.player();
      drag.px = p.x;
      drag.py = p.y;
      drag.sx = drag.x;
      drag.sy = drag.y;
      S.target.x = p.x;
      S.target.y = p.y;
    },
    /** The ship was dragged by something: move the drag anchor with it so the finger keeps control. */
    shift(dx, dy) {
      if (!S.target || mouseSteer) return;
      S.target.x += dx;
      S.target.y += dy;
      if (drag.id !== null) { drag.px += dx; drag.py += dy; }
    },
    reset,
    get x() { return S.x; },
    get y() { return S.y; },
    get target() { return S.target; },
    get firing() { return S.fire || S.gpFire || isHeld('fire'); },
    get device() { return S.device; },
    onMenu(fn) { menuFns.push(fn); },
    onDevice(fn) { deviceFns.push(fn); },
    vibrate(pattern) {
      if (!Settings.get('vibration')) return;
      try {
        if (S.device === 'gamepad' && navigator.getGamepads) {
          const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
          for (const gp of navigator.getGamepads()) {
            if (gp && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
              gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: 0.7, weakMagnitude: 0.5 });
            }
          }
        } else if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
          navigator.vibrate(pattern);
        }
      } catch (_) { /* unsupported */ }
    },
  };
})();
