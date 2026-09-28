/* =========================================================================
   Multiplayer networking (co-op rooms) on top of PeerJS / WebRTC.

   • No game server: players connect straight to the room creator (the host),
     whose game runs the waves and bosses. PeerJS's free public service only
     introduces the players to each other (and relays the connection if a
     direct one isn't possible).
   • Room security: the room's address is a SHA-256 fingerprint of
     "room name + password", so a room can't be found without the password,
     and the password itself is never sent anywhere. Joining also has to prove
     the password with a second fingerprint.
   ========================================================================= */
const Net = (() => {
  const VERSION = 1;
  const PREFIX = 'spacemobs-room-';
  const MAX_ROSTER = 4;
  const TIMEOUT = 15000;
  const COLORS = ['#3ee6ff', '#ff4fd8', '#ffd23f', '#56f08b'];

  // ------------------------------------------------------------ SHA-256 (small, synchronous)
  const K = [];
  const H0 = [];
  (() => {
    const isPrime = (n) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
    const frac = (x) => x - Math.floor(x);
    for (let n = 2; K.length < 64; n++) {
      if (!isPrime(n)) continue;
      if (H0.length < 8) H0.push((frac(Math.sqrt(n)) * 4294967296) >>> 0);
      K.push((frac(Math.cbrt(n)) * 4294967296) >>> 0);
    }
  })();
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  function sha256(text) {
    const bytes = new TextEncoder().encode(String(text));
    const len = bytes.length;
    const buf = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    buf.set(bytes);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(buf.length - 4, (len * 8) >>> 0);
    dv.setUint32(buf.length - 8, Math.floor(len / 536870912));
    const H = H0.slice();
    const W = new Uint32Array(64);
    for (let off = 0; off < buf.length; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = ror(W[t - 15], 7) ^ ror(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = ror(W[t - 2], 17) ^ ror(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map((v) => v.toString(16).padStart(8, '0')).join('');
  }

  // ------------------------------------------------------------ text cleaning (names are shown to other players)
  const clean = (s, max) => String(s || '').normalize('NFKC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanName = (s) => clean(s, 12);
  const cleanRoom = (s) => clean(s, 20);
  const roomKey = (s) => cleanRoom(s).toLowerCase();
  const DEFAULTS = { mode: 'arcade', diff: 'normal', hearts: 5, tier: 'extreme', max: 4 };
  function cleanSettings(s) {
    const o = { ...DEFAULTS, ...(s || {}) };
    return {
      mode: o.mode === 'hardcore' ? 'hardcore' : 'arcade',
      diff: ['easy', 'normal', 'hard'].includes(o.diff) ? o.diff : 'normal',
      hearts: Math.max(1, Math.min(10, Math.round(+o.hearts) || 5)),
      tier: ['extreme', 'insane', 'brutal'].includes(o.tier) ? o.tier : 'extreme',
      max: Math.max(2, Math.min(MAX_ROSTER, Math.round(+o.max) || 4)),
    };
  }
  const validSkin = (id) => (typeof SKINS !== 'undefined' && SKINS.some((s) => s.id === id) ? id : 'phantom');
  // screen shape (width / height): the shared world is shaped to suit everyone's screens
  const screenAr = () => +(window.innerWidth / Math.max(1, window.innerHeight)).toFixed(3);
  const validAr = (a) => (typeof a === 'number' && Number.isFinite(a) ? Math.max(0.3, Math.min(3, a)) : 1.6);

  // ------------------------------------------------------------ state
  let peer = null;
  let role = null;          // 'host' | 'guest' | null
  let phase = 'idle';       // 'idle' | 'lobby' | 'game'
  let hostConn = null;      // guest → host
  const guests = new Map(); // host: pid → { conn, last, rate }
  let myPid = 0;
  let room = '';
  let token = '';
  let settings = { ...DEFAULTS };
  let roster = [];          // [{ pid, name, skin, host, ping }]
  let pingTimer = null;
  let hostLast = 0;
  let closing = false;
  const fns = {};
  const on = (t, fn) => { (fns[t] || (fns[t] = [])).push(fn); };
  const emit = (t, ...a) => (fns[t] || []).forEach((fn) => { try { fn(...a); } catch (err) { console.error(err); } });
  const now = () => performance.now();

  function fail(code) { const e = new Error(code); e.code = code; return e; }
  function mapPeerError(err) {
    const t = err && err.type;
    if (t === 'peer-unavailable') return fail('noroom');
    if (t === 'unavailable-id') return fail('taken');
    if (t === 'browser-incompatible') return fail('browser');
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' || t === 'disconnected') return fail('network');
    return fail('network');
  }
  function roomId(name, password) { return PREFIX + sha256(`${roomKey(name)}\n${password}`).slice(0, 40); }
  function joinToken(name, password) { return sha256(`join\n${roomKey(name)}\n${password}`); }

  function reset() {
    clearInterval(pingTimer);
    pingTimer = null;
    for (const g of guests.values()) { try { g.conn.close(); } catch (_) { /* ignore */ } }
    guests.clear();
    if (hostConn) { try { hostConn.close(); } catch (_) { /* ignore */ } }
    hostConn = null;
    if (peer) { try { peer.destroy(); } catch (_) { /* ignore */ } }
    peer = null;
    role = null;
    phase = 'idle';
    myPid = 0;
    roster = [];
    room = '';
    token = '';
  }
  function openPeer(id) {
    return new Promise((resolve, reject) => {
      if (!window.peerjs || !window.peerjs.Peer) { reject(fail('nolib')); return; }
      const p = id ? new window.peerjs.Peer(id, { debug: 0 }) : new window.peerjs.Peer({ debug: 0 });
      const timer = setTimeout(() => { cleanup(); try { p.destroy(); } catch (_) { /* ignore */ } reject(fail('timeout')); }, TIMEOUT);
      const onOpen = () => { cleanup(); resolve(p); };
      const onErr = (err) => { cleanup(); try { p.destroy(); } catch (_) { /* ignore */ } reject(mapPeerError(err)); };
      function cleanup() { clearTimeout(timer); p.off('open', onOpen); p.off('error', onErr); }
      p.on('open', onOpen);
      p.on('error', onErr);
    });
  }
  const safeSend = (conn, msg) => { try { if (conn && conn.open) conn.send(msg); } catch (_) { /* channel closing */ } };

  // ------------------------------------------------------------ host
  function lobbyMsg() { return { t: 'lobby', phase, room, roster, settings }; }
  function broadcastLobby() { broadcast(lobbyMsg()); emit('lobby'); }
  function uniqueName(name) {
    let n = name || 'PLAYER';
    let i = 2;
    while (roster.some((r) => r.name.toLowerCase() === n.toLowerCase())) n = `${(name || 'PLAYER').slice(0, 10)}${i++}`;
    return n;
  }
  function nextPid() { for (let p = 2; p <= MAX_ROSTER; p++) if (!roster.some((r) => r.pid === p)) return p; return 0; }

  async function create({ room: roomName, name, password, skin }) {
    reset();
    const nm = cleanName(name) || 'PLAYER';
    room = cleanRoom(roomName);
    token = joinToken(roomName, password);
    peer = await openPeer(roomId(roomName, password));
    role = 'host';
    phase = 'lobby';
    myPid = 1;
    roster = [{ pid: 1, name: nm, skin: validSkin(skin), host: true, ping: 0, ar: screenAr() }];
    settings = cleanSettings(settings);
    peer.on('connection', onGuestConnection);
    peer.on('error', (err) => { if (err && err.type !== 'peer-unavailable') emit('warn', mapPeerError(err).code); });
    // keep the room reachable if the link to the PeerJS service drops (players already connected are unaffected)
    peer.on('disconnected', () => { setTimeout(() => { if (peer && !peer.destroyed && role === 'host') { try { peer.reconnect(); } catch (_) { /* ignore */ } } }, 1500); });
    pingTimer = setInterval(hostPing, 2000);
    emit('lobby');
  }
  function onGuestConnection(conn) {
    let pid = 0;
    const reject = (reason) => { safeSend(conn, { t: 'reject', reason }); setTimeout(() => { try { conn.close(); } catch (_) { /* ignore */ } }, 400); };
    const helloTimer = setTimeout(() => { if (!pid) { try { conn.close(); } catch (_) { /* ignore */ } } }, 10000);
    conn.on('data', (m) => {
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
      if (!pid) {
        if (m.t !== 'hello') return;
        if (m.v !== VERSION) { reject('version'); return; }
        if (m.token !== token) { reject('password'); return; }
        if (phase !== 'lobby') { reject('started'); return; }
        if (roster.length >= settings.max) { reject('full'); return; }
        pid = nextPid();
        if (!pid) { reject('full'); return; }
        clearTimeout(helloTimer);
        const entry = { pid, name: uniqueName(cleanName(m.name) || 'PLAYER'), skin: validSkin(m.skin), host: false, ping: 0, ar: validAr(m.ar) };
        roster.push(entry);
        guests.set(pid, { conn, last: now(), n: 0, t0: now() });
        safeSend(conn, { t: 'welcome', v: VERSION, pid, room });
        broadcastLobby();
        emit('joined', entry.name);
        return;
      }
      const g = guests.get(pid);
      if (!g) return;
      g.last = now();
      // flood guard: a normal client sends ~35 messages a second
      if (now() - g.t0 > 1000) { g.t0 = now(); g.n = 0; }
      if (++g.n > 120) return;
      onGuestMessage(pid, m);
    });
    const gone = () => { clearTimeout(helloTimer); if (pid) drop(pid, 'left'); };
    conn.on('close', gone);
    conn.on('error', gone);
  }
  function onGuestMessage(pid, m) {
    const r = roster.find((x) => x.pid === pid);
    switch (m.t) {
      case 'pong':
        if (r && typeof m.ts === 'number') r.ping = Math.max(0, Math.min(9999, Math.round(now() - m.ts)));
        break;
      case 'skin':
        if (r && phase === 'lobby') { r.skin = validSkin(m.skin); broadcastLobby(); }
        break;
      case 'bye':
        drop(pid, 'left');
        break;
      default:
        if (phase === 'game') emit('game', pid, m);
        break;
    }
  }
  function drop(pid, reason) {
    const g = guests.get(pid);
    if (!g) return;
    guests.delete(pid);
    try { g.conn.close(); } catch (_) { /* ignore */ }
    const i = roster.findIndex((r) => r.pid === pid);
    const name = i >= 0 ? roster[i].name : 'PLAYER';
    if (i >= 0) roster.splice(i, 1);
    emit('dropped', pid, name, reason);
    broadcastLobby();
  }
  function hostPing() {
    const t = now();
    broadcast({ t: 'ping', ts: t });
    for (const [pid, g] of guests) if (t - g.last > 12000) drop(pid, 'timeout');
    if (phase === 'lobby') broadcastLobby();
  }
  function kick(pid) {
    const g = guests.get(pid);
    if (!g || role !== 'host') return;
    safeSend(g.conn, { t: 'kick' });
    setTimeout(() => drop(pid, 'kicked'), 200);
  }
  function setSettings(patch) {
    if (role !== 'host' || phase !== 'lobby') return;
    settings = cleanSettings({ ...settings, ...patch });
    // never below the number of players already in the room
    if (settings.max < roster.length) settings.max = roster.length;
    broadcastLobby();
  }
  function startGame() {
    if (role !== 'host') return null;
    phase = 'game';
    broadcast(lobbyMsg());
    return roster.map((r) => ({ ...r }));
  }
  function backToLobby() {
    if (role !== 'host') return;
    phase = 'lobby';
    broadcastLobby();
  }
  function broadcast(msg) { for (const g of guests.values()) safeSend(g.conn, msg); }
  function sendTo(pid, msg) { const g = guests.get(pid); if (g) safeSend(g.conn, msg); }

  // ------------------------------------------------------------ guest
  async function join({ room: roomName, name, password, skin }) {
    reset();
    const nm = cleanName(name) || 'PLAYER';
    token = joinToken(roomName, password);
    peer = await openPeer(null);
    role = 'guest';
    const target = roomId(roomName, password);
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) { reset(); reject(err); } else resolve();
      };
      const timer = setTimeout(() => finish(fail('timeout')), TIMEOUT);
      peer.on('error', (err) => { if (!settled) finish(mapPeerError(err)); else if (err && err.type === 'network') emit('warn', 'network'); });
      const conn = peer.connect(target, { reliable: true, serialization: 'json' });
      hostConn = conn;
      conn.on('open', () => safeSend(conn, { t: 'hello', v: VERSION, name: nm, skin: validSkin(skin), token, ar: screenAr() }));
      conn.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        hostLast = now();
        if (!settled) {
          if (m.t === 'welcome') {
            myPid = m.pid;
            room = cleanRoom(m.room);
            phase = 'lobby';
            finish(null);
          } else if (m.t === 'reject') {
            finish(fail(m.reason || 'rejected'));
          }
          return;
        }
        onHostMessage(m);
      });
      conn.on('close', () => { if (!settled) finish(fail('closed')); else lost('lost'); });
      conn.on('error', () => { if (!settled) finish(fail('closed')); });
    });
    hostLast = now();
    pingTimer = setInterval(() => { if (role === 'guest' && now() - hostLast > 12000) lost('lost'); }, 2000);
  }
  function onHostMessage(m) {
    switch (m.t) {
      case 'lobby':
        phase = m.phase === 'game' ? 'game' : 'lobby';
        room = cleanRoom(m.room) || room;
        roster = Array.isArray(m.roster) ? m.roster.slice(0, MAX_ROSTER).map((r) => ({ pid: r.pid | 0, name: cleanName(r.name) || 'PLAYER', skin: validSkin(r.skin), host: !!r.host, ping: r.ping | 0, ar: validAr(r.ar) })) : roster;
        settings = cleanSettings(m.settings);
        emit('lobby');
        break;
      case 'ping':
        send({ t: 'pong', ts: m.ts });
        break;
      case 'start':
        phase = 'game';
        emit('start', m);
        break;
      case 'kick':
        lost('kicked');
        break;
      case 'close':
        lost('closed');
        break;
      default:
        emit('game', 0, m);
        break;
    }
  }
  function lost(reason) {
    if (role !== 'guest' || closing) return;
    reset();
    emit('ended', reason);
  }
  function send(msg) { safeSend(hostConn, msg); }
  function setSkin(skin) {
    const id = validSkin(skin);
    const r = roster.find((x) => x.pid === myPid);
    if (r) r.skin = id;
    if (role === 'guest') send({ t: 'skin', skin: id });
    else if (role === 'host' && phase === 'lobby') broadcastLobby();
  }

  // ------------------------------------------------------------ both
  function leave() {
    if (!role) return;
    closing = true;
    if (role === 'host') broadcast({ t: 'close' });
    else send({ t: 'bye' });
    // give the goodbye message a moment to leave before closing the connections
    const p = peer;
    const conns = [...guests.values()].map((g) => g.conn).concat(hostConn ? [hostConn] : []);
    peer = null;
    hostConn = null;
    guests.clear();
    clearInterval(pingTimer);
    pingTimer = null;
    role = null;
    phase = 'idle';
    roster = [];
    myPid = 0;
    setTimeout(() => {
      conns.forEach((c) => { try { c.close(); } catch (_) { /* ignore */ } });
      if (p) { try { p.destroy(); } catch (_) { /* ignore */ } }
      closing = false;
    }, 300);
  }

  return {
    VERSION, COLORS,
    create, join, leave, kick, setSettings, setSkin, startGame, backToLobby,
    send, broadcast, sendTo, on,
    sha256, cleanName, cleanRoom,
    get role() { return role; },
    get phase() { return phase; },
    get room() { return room; },
    get myPid() { return myPid; },
    get roster() { return roster; },
    get settings() { return settings; },
    get available() { return !!(window.peerjs && window.peerjs.Peer); },
    color: (pid) => COLORS[(pid - 1) % COLORS.length] || COLORS[0],
  };
})();
