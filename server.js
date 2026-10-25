// Legacy prototype retained inert while the hardened implementation follows below.
if (false) {
const path = require('path');
const fs = require('fs');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const httpServer = app.listen(process.env.PORT || 3000, () => {
  console.log(`PARALLAX listening on http://localhost:${process.env.PORT || 3000}`);
});
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, 'public')));

// Tiny built-in live-reload channel: no extra development dependency required.
// `node --watch` restarts this server when its code changes; this refreshes open
// browsers whenever a CSS, HTML, or client-side JavaScript file changes.
const reloadClients = new Set();
app.get('/__parallax_reload', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 1000\n\n');
  reloadClients.add(res);
  req.on('close', () => reloadClients.delete(res));
});
fs.watch(path.join(__dirname, 'public'), { recursive: true }, (_event, filename) => {
  if (filename && /\.(css|html|js)$/.test(filename)) {
    for (const client of reloadClients) client.write('data: reload\n\n');
  }
});

const rooms = new Map();
const eventOrder = ['lights', 'alarm', 'door', 'signal', 'train'];

const mystery = {
  title: 'The 9:17 Vanishing',
  subtitle: 'Platform 7. Blackglass Station.',
  briefing: 'At 9:17 PM, the Nightline train vanished from Platform 7. Reconstruct what happened before the station resets.',
  events: {
    lights: { label: 'The lights died', time: '9:12 PM', icon: '✦' },
    alarm: { label: 'The alarm sounded', time: '9:14 PM', icon: '◌' },
    door: { label: 'The control door opened', time: '9:15 PM', icon: '▱' },
    signal: { label: 'The signal turned blue', time: '9:16 PM', icon: '◈' },
    train: { label: 'The train vanished', time: '9:17 PM', icon: '↗' }
  }
};

const clueSets = [
  ['You saw the station lights cut out before anyone mentioned an alarm.', 'The platform clock froze only after the signal changed.', 'The technician said: “the blue light came last.”'],
  ['A security log places the alarm after the power failure.', 'You heard the control door open while the alarm was already ringing.', 'The train was still visible when the signal became blue.'],
  ['Your access badge registered at the control door before the signal changed.', 'The blue signal appeared exactly one minute before the disappearance.', 'A witness insists the alarm was not the first disturbance.'],
  ['A passenger saw the train at 9:16 PM, moments before it vanished.', 'The door log unlocks after the alarm but before the blue signal.', 'The station’s emergency lamps switched on immediately after the lights died.'],
  ['The conductor’s last transmission happened after the blue signal.', 'You found a paper slip: “First darkness. Then noise.”', 'The locked door was opened only once tonight.'],
  ['You were near the signal box: its light changed blue just before 9:17.', 'The station’s PA announced an alarm while the main lights were off.', 'You never saw the train after its final transmission.'],
  ['A camera timestamp says the alarm came two minutes before the train disappeared.', 'Someone entered the control room after the alarm.', 'The blue signal was visible from the platform before the train vanished.'],
  ['The maintenance report reads: “power outage preceded all automated warnings.”', 'The control door had no forced entry.', 'The train was scheduled to leave at 9:17, but it did not depart.'],
  ['You saw a silhouette enter the control room after the station alarm began.', 'The blue signal is not a normal departure signal.', 'The platform’s clocks kept running until the train disappeared.'],
  ['The dispatch screen went blank during the power outage.', 'A sensor recorded a door opening before the signal change.', 'At 9:17, the platform was empty — and silent.']
];

function code() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function roomPublicState(room) {
  return {
    code: room.code,
    phase: room.phase,
    mystery,
    hostId: room.hostId,
    players: [...room.players.values()].map(({ id, name, ready, connected }) => ({ id, name, ready, connected })),
    timerEndsAt: room.timerEndsAt || null,
    votes: room.votes.size,
    maxPlayers: 10
  };
}

function playerState(room, socketId) {
  const player = room.players.get(socketId);
  if (!player) return null;
  const isGlitch = room.glitchId === socketId;
  return {
    ...roomPublicState(room),
    you: { id: socketId, name: player.name, role: isGlitch ? 'GLITCH' : 'INVESTIGATOR', clues: player.clues || [] },
    submittedTimeline: room.timelines.get(socketId) || [],
    yourVote: room.votes.get(socketId) || null,
    result: room.result || null
  };
}

function emitRoom(room) {
  for (const id of room.players.keys()) io.to(id).emit('room:update', playerState(room, id));
}

function startRound(room) {
  const ids = [...room.players.keys()];
  room.glitchId = ids[Math.floor(Math.random() * ids.length)];
  const falseEvidence = [
    'The station lights came back on before the alarm sounded.',
    'The control door opened before the outage.',
    'The train vanished at 9:16 PM — one minute early.'
  ];
  ids.forEach((id, index) => {
    room.players.get(id).clues = id === room.glitchId ? falseEvidence : clueSets[index % clueSets.length];
  });
  room.phase = 'investigate';
  room.votes = new Map();
  room.timelines = new Map();
  room.timerEndsAt = Date.now() + 90000;
  emitRoom(room);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    if (room.phase === 'investigate') {
      room.phase = 'vote';
      room.timerEndsAt = Date.now() + 30000;
      emitRoom(room);
      room.timer = setTimeout(() => endVote(room), 30000);
    }
  }, 90000);
}

function endVote(room) {
  if (room.phase !== 'vote') return;
  const count = {};
  for (const id of room.votes.values()) count[id] = (count[id] || 0) + 1;
  const accused = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
  const timelineSuccess = [...room.timelines.values()].some(t => t.join(',') === eventOrder.join(','));
  room.phase = 'reveal';
  room.timerEndsAt = null;
  room.result = { glitchId: room.glitchId, accused, caught: accused === room.glitchId, timelineSuccess, voteCount: count };
  emitRoom(room);
}

io.on('connection', socket => {
  socket.on('room:create', ({ name }) => {
    let roomCode = code();
    while (rooms.has(roomCode)) roomCode = code();
    const room = { code: roomCode, hostId: socket.id, phase: 'lobby', players: new Map(), votes: new Map(), timelines: new Map() };
    room.players.set(socket.id, { id: socket.id, name: String(name || 'Agent').slice(0, 16), ready: false, connected: true });
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.emit('room:joined', playerState(room, socket.id));
  });

  socket.on('room:join', ({ code: desired, name }) => {
    const room = rooms.get(String(desired || '').toUpperCase());
    if (!room) return socket.emit('room:error', 'That room code does not exist.');
    if (room.phase !== 'lobby') return socket.emit('room:error', 'This case is already underway.');
    if (room.players.size >= 10) return socket.emit('room:error', 'This room is full.');
    room.players.set(socket.id, { id: socket.id, name: String(name || 'Agent').slice(0, 16), ready: false, connected: true });
    socket.join(room.code);
    socket.emit('room:joined', playerState(room, socket.id));
    emitRoom(room);
  });

  socket.on('demo:launch', ({ name }) => {
    let roomCode = code();
    while (rooms.has(roomCode)) roomCode = code();
    const room = { code: roomCode, hostId: socket.id, phase: 'lobby', players: new Map(), votes: new Map(), timelines: new Map(), demo: true };
    room.players.set(socket.id, { id: socket.id, name: String(name || 'You').slice(0, 16), ready: true, connected: true });
    ['Mira', 'Noah', 'Ivy', 'Jules', 'Ash'].forEach((name, index) => {
      const id = `bot-${index}`;
      room.players.set(id, { id, name, ready: true, connected: true });
    });
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.emit('room:joined', playerState(room, socket.id));
    startRound(room);
    setTimeout(() => {
      if (room.phase !== 'investigate') return;
      for (const [id] of room.players) if (id !== socket.id) room.timelines.set(id, eventOrder);
      emitRoom(room);
    }, 12000);
  });

  socket.on('player:ready', () => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.phase !== 'lobby') return;
    room.players.get(socket.id).ready = !room.players.get(socket.id).ready;
    emitRoom(room);
  });

  socket.on('round:start', () => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.hostId !== socket.id || room.players.size < 3 || room.phase !== 'lobby') return;
    startRound(room);
  });

  socket.on('timeline:submit', ({ timeline }) => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.phase !== 'investigate' || !Array.isArray(timeline) || timeline.length !== 5) return;
    room.timelines.set(socket.id, timeline);
    emitRoom(room);
  });

  socket.on('vote:cast', ({ playerId }) => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.phase !== 'vote' || !room.players.has(playerId) || playerId === socket.id) return;
    room.votes.set(socket.id, playerId);
    if (room.demo) {
      for (const [id] of room.players) {
        if (id !== socket.id && !room.votes.has(id)) room.votes.set(id, Math.random() > .35 ? room.glitchId : socket.id);
      }
    }
    if (room.votes.size === room.players.size) endVote(room); else emitRoom(room);
  });

  socket.on('round:again', () => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room || room.hostId !== socket.id || room.phase !== 'reveal') return;
    room.phase = 'lobby';
    room.result = null;
    for (const player of room.players.values()) player.ready = false;
    emitRoom(room);
  });

  socket.on('disconnect', () => {
    const room = [...rooms.values()].find(r => r.players.has(socket.id));
    if (!room) return;
    room.players.delete(socket.id);
    if (!room.players.size) { clearTimeout(room.timer); rooms.delete(room.code); return; }
    if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
    emitRoom(room);
  });
});
}

// ── Hardened multiplayer implementation ────────────────────────────────────
const path2 = require('path');
const fs2 = require('fs');
const crypto2 = require('crypto');
const express2 = require('express');
const { Server: SocketServer } = require('socket.io');

const PORT2 = Number(process.env.PORT) || 3100;
const app2 = express2();
const http2 = require('http').createServer(app2);
const io2 = new SocketServer(http2);
app2.use(express2.static(path2.join(__dirname, 'public')));

const reloadClients2 = new Set();
app2.get('/__parallax_reload', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('retry: 1000\n\n');
  reloadClients2.add(res);
  req.on('close', () => reloadClients2.delete(res));
});
fs2.watch(path2.join(__dirname, 'public'), { recursive: true }, (_event, file) => {
  if (file && /\.(css|html|js)$/.test(file)) for (const client of reloadClients2) client.write('data: reload\n\n');
});

const rooms2 = new Map();
const playerRooms2 = new Map();
const order2 = ['lights', 'alarm', 'door', 'signal', 'train'];
const INVESTIGATE_MS = 90_000, VOTE_MS2 = 30_000, RECONNECT_GRACE_MS2 = 60_000;
const mystery2 = {
  title: 'The 9:17 Vanishing', subtitle: 'Platform 7. Blackglass Station.',
  briefing: 'At 9:17 PM, the Nightline train vanished from Platform 7. Reconstruct what happened before the station resets.',
  events: {
    lights: { label: 'The lights died', time: '9:12 PM', icon: '✦' },
    alarm: { label: 'The alarm sounded', time: '9:14 PM', icon: '◌' },
    door: { label: 'The control door opened', time: '9:15 PM', icon: '▱' },
    signal: { label: 'The signal turned blue', time: '9:16 PM', icon: '◈' },
    train: { label: 'The train vanished', time: '9:17 PM', icon: '↗' }
  }
};
const investigatorPacks2 = [
  ['You saw the station lights cut out before anyone mentioned an alarm.', 'The platform clock froze only after the signal changed.', 'The technician said: “the blue light came last.”'],
  ['A security log places the alarm after the power failure.', 'You heard the control door open while the alarm was already ringing.', 'The train was still visible when the signal became blue.'],
  ['Your access badge registered at the control door before the signal changed.', 'The blue signal appeared exactly one minute before the disappearance.', 'A witness insists the alarm was not the first disturbance.'],
  ['A passenger saw the train at 9:16 PM, moments before it vanished.', 'The door log unlocks after the alarm but before the blue signal.', 'The station’s emergency lamps switched on immediately after the lights died.'],
  ['The conductor’s last transmission happened after the blue signal.', 'You found a paper slip: “First darkness. Then noise.”', 'The locked door was opened only once tonight.'],
  ['You were near the signal box: its light changed blue just before 9:17.', 'The station’s PA announced an alarm while the main lights were off.', 'You never saw the train after its final transmission.'],
  ['A camera timestamp says the alarm came two minutes before the train disappeared.', 'Someone entered the control room after the alarm.', 'The blue signal was visible from the platform before the train vanished.'],
  ['The maintenance report reads: “power outage preceded all automated warnings.”', 'The control door had no forced entry.', 'The train was scheduled to leave at 9:17, but it did not depart.'],
  ['You saw a silhouette enter the control room after the station alarm began.', 'The blue signal is not a normal departure signal.', 'The platform’s clocks kept running until the train disappeared.'],
  ['The dispatch screen went blank during the power outage.', 'A sensor recorded a door opening before the signal change.', 'At 9:17, the platform was empty — and silent.']
];
const glitchPacks2 = [
  ['The station lights came back on before the alarm sounded.', 'The control door opened before the outage.', 'The train vanished at 9:16 PM — one minute early.'],
  ['The blue signal appeared before the control-room door opened.', 'A witness says the alarm was the very first disturbance.', 'The train was gone before the lights failed.'],
  ['The door log was triggered before the station went dark.', 'The alarm sounded only after the train vanished.', 'The blue signal is an ordinary departure signal.']
];

function playerId2(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(id) ? id : crypto2.randomUUID(); }
function code2() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
function active2(room) { return [...room.players.values()].filter(player => player.connected); }
function publicMystery2(phase) {
  const reveal = phase === 'reveal';
  return { title: mystery2.title, subtitle: mystery2.subtitle, briefing: mystery2.briefing, events: Object.fromEntries(Object.entries(mystery2.events).map(([id, event]) => [id, reveal ? event : { label: event.label, icon: event.icon }])) };
}
function publicState2(room) {
  return { code: room.code, phase: room.phase, mystery: publicMystery2(room.phase), hostId: room.hostId, players: [...room.players.values()].map(({ id, name, ready, connected }) => ({ id, name, ready, connected })), timerEndsAt: room.timerEndsAt || null, serverNow: Date.now(), votes: room.votes.size, maxPlayers: 10 };
}
function stateFor2(room, id) {
  const player = room.players.get(id);
  return { ...publicState2(room), you: { id: player.id, name: player.name, role: room.phase === 'lobby' ? null : room.glitchId === id ? 'GLITCH' : 'INVESTIGATOR', clues: room.phase === 'investigate' ? player.clues : [] }, submittedTimeline: room.timelines.get(id) || [], yourVote: room.votes.get(id) || null, result: room.phase === 'reveal' ? room.result : null };
}
function emit2(room) { for (const player of room.players.values()) if (player.connected && player.socketId) io2.to(player.socketId).emit('room:update', stateFor2(room, player.id)); }
function clearTimers2(room) { for (const id of room.timers) clearTimeout(id); room.timers.clear(); }
function later2(room, fn, delay) { const id = setTimeout(() => { room.timers.delete(id); fn(); }, delay); room.timers.add(id); }
function getRoom2(socket) { return rooms2.get(socket.data.roomCode); }
function allow2(socket, action, ms = 300) { const now = Date.now(), last = socket.data.actions.get(action) || 0; if (now - last < ms) return false; socket.data.actions.set(action, now); return true; }
function chooseHost2(room) { room.hostId = (active2(room)[0] || [...room.players.values()][0])?.id || null; }
function finish2(room, result) { clearTimers2(room); room.phase = 'reveal'; room.timerEndsAt = null; room.result = result; emit2(room); }
function beginVote2(room) { if (room.phase !== 'investigate') return; room.phase = 'vote'; room.timerEndsAt = Date.now() + VOTE_MS2; emit2(room); later2(room, () => endVote2(room), VOTE_MS2); }
function startRound2(room) {
  clearTimers2(room);
  const players = active2(room);
  room.glitchId = players[Math.floor(Math.random() * players.length)].id;
  const packs = [...investigatorPacks2].sort(() => Math.random() - .5);
  const fake = glitchPacks2[Math.floor(Math.random() * glitchPacks2.length)];
  let pack = 0;
  for (const player of room.players.values()) { player.ready = false; player.clues = player.id === room.glitchId ? fake : packs[pack++]; }
  room.votes.clear(); room.timelines.clear(); room.result = null; room.phase = 'investigate'; room.timerEndsAt = Date.now() + INVESTIGATE_MS;
  emit2(room); later2(room, () => beginVote2(room), INVESTIGATE_MS);
}
function endVote2(room) {
  if (room.phase !== 'vote') return;
  const players = active2(room);
  if (!players.some(player => player.id === room.glitchId)) return finish2(room, { glitchId: room.glitchId, glitchLeft: true, timelineSuccess: false, accused: null, tie: false });
  const counts = {};
  for (const player of players) { const vote = room.votes.get(player.id); if (vote) counts[vote] = (counts[vote] || 0) + 1; }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] || 0, tie = ranked.length > 1 && ranked[1][1] === top;
  const accused = !tie && top > players.length / 2 ? ranked[0][0] : null;
  const correct = players.filter(player => (room.timelines.get(player.id) || []).join(',') === order2.join(',')).length;
  finish2(room, { glitchId: room.glitchId, accused, caught: accused === room.glitchId, tie, timelineSuccess: correct >= Math.ceil(players.length / 2), correctTimelines: correct, voteCount: counts });
}
function remove2(room, id) {
  const player = room.players.get(id); if (!player || player.connected) return;
  room.players.delete(id); room.votes.delete(id); room.timelines.delete(id); playerRooms2.delete(id);
  if (!room.players.size) { clearTimers2(room); rooms2.delete(room.code); return; }
  if (room.hostId === id) chooseHost2(room);
  if ((room.phase === 'investigate' || room.phase === 'vote') && room.glitchId === id) return finish2(room, { glitchId: id, glitchLeft: true, timelineSuccess: false, accused: null, tie: false });
  emit2(room);
}
function resume2(socket) {
  const room = rooms2.get(playerRooms2.get(socket.data.playerId)), player = room?.players.get(socket.data.playerId);
  if (!room || !player) return;
  clearTimeout(player.disconnectTimer); player.disconnectTimer = null; player.connected = true; player.socketId = socket.id;
  socket.data.roomCode = room.code; socket.join(room.code); socket.emit('room:joined', stateFor2(room, player.id)); emit2(room);
}

io2.on('connection', socket => {
  socket.data.playerId = playerId2(socket.handshake.auth?.playerId);
  socket.data.actions = new Map();
  resume2(socket);
  socket.on('room:create', ({ name }) => {
    if (!allow2(socket, 'create', 1000) || socket.data.roomCode) return;
    let code = code2(); while (rooms2.has(code)) code = code2();
    const player = { id: socket.data.playerId, socketId: socket.id, name: String(name || 'Agent').trim().slice(0, 16) || 'Agent', ready: false, connected: true, clues: [] };
    const room = { code, hostId: player.id, phase: 'lobby', players: new Map([[player.id, player]]), votes: new Map(), timelines: new Map(), timers: new Set(), result: null };
    rooms2.set(code, room); playerRooms2.set(player.id, code); socket.data.roomCode = code; socket.join(code); socket.emit('room:joined', stateFor2(room, player.id));
  });
  socket.on('room:join', ({ code, name }) => {
    if (!allow2(socket, 'join', 1000) || socket.data.roomCode) return;
    const room = rooms2.get(String(code || '').trim().toUpperCase());
    if (!room) return socket.emit('room:error', 'That room code does not exist.');
    if (room.phase !== 'lobby') return socket.emit('room:error', 'This case is already underway.');
    if (room.players.size >= 10) return socket.emit('room:error', 'This room is full.');
    const player = { id: socket.data.playerId, socketId: socket.id, name: String(name || 'Agent').trim().slice(0, 16) || 'Agent', ready: false, connected: true, clues: [] };
    room.players.set(player.id, player); playerRooms2.set(player.id, room.code); socket.data.roomCode = room.code; socket.join(room.code); socket.emit('room:joined', stateFor2(room, player.id)); emit2(room);
  });
  socket.on('demo:launch', ({ name }) => {
    if (!allow2(socket, 'demo', 1000) || socket.data.roomCode) return;
    let code = code2(); while (rooms2.has(code)) code = code2();
    const player = { id: socket.data.playerId, socketId: socket.id, name: String(name || 'You').trim().slice(0, 16) || 'You', ready: true, connected: true, clues: [] };
    const room = { code, hostId: player.id, phase: 'lobby', players: new Map([[player.id, player]]), votes: new Map(), timelines: new Map(), timers: new Set(), result: null, demo: true };
    ['Mira', 'Noah', 'Ivy', 'Jules', 'Ash'].forEach((botName, index) => room.players.set(`demo-${index}`, { id: `demo-${index}`, name: botName, ready: true, connected: true, bot: true, clues: [] }));
    rooms2.set(code, room); playerRooms2.set(player.id, code); socket.data.roomCode = code; socket.join(code); socket.emit('room:joined', stateFor2(room, player.id)); startRound2(room);
    later2(room, () => { if (room.phase === 'investigate') { for (const bot of [...room.players.values()].filter(candidate => candidate.bot)) room.timelines.set(bot.id, order2); emit2(room); } }, 12_000);
    later2(room, () => { if (room.phase === 'vote') { for (const bot of [...room.players.values()].filter(candidate => candidate.bot)) room.votes.set(bot.id, Math.random() > .35 ? room.glitchId : player.id); if (room.votes.size >= active2(room).length) endVote2(room); else emit2(room); } }, INVESTIGATE_MS + 500);
  });
  socket.on('player:ready', () => {
    if (!allow2(socket, 'ready')) return; const room = getRoom2(socket), player = room?.players.get(socket.data.playerId);
    if (!room || !player || room.phase !== 'lobby') return; player.ready = !player.ready; emit2(room);
  });
  socket.on('round:start', () => {
    if (!allow2(socket, 'start', 700)) return; const room = getRoom2(socket); if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby') return;
    const players = active2(room); if (players.length < 3) return socket.emit('room:error', 'You need at least three connected players.'); if (!players.every(player => player.ready)) return socket.emit('room:error', 'Wait for every player to mark ready.'); startRound2(room);
  });
  socket.on('timeline:submit', ({ timeline }) => {
    if (!allow2(socket, 'timeline', 500)) return; const room = getRoom2(socket); const valid = Array.isArray(timeline) && timeline.length === order2.length && new Set(timeline).size === order2.length && timeline.every(id => Object.hasOwn(mystery2.events, id));
    if (!room || room.phase !== 'investigate' || !valid) return; room.timelines.set(socket.data.playerId, timeline); emit2(room);
  });
  socket.on('vote:cast', ({ playerId }) => {
    if (!allow2(socket, 'vote', 500)) return; const room = getRoom2(socket); if (!room || room.phase !== 'vote' || !room.players.has(playerId) || playerId === socket.data.playerId) return;
    room.votes.set(socket.data.playerId, playerId); if (room.votes.size >= active2(room).length) endVote2(room); else emit2(room);
  });
  socket.on('round:again', () => {
    if (!allow2(socket, 'again', 500)) return; const room = getRoom2(socket); if (!room || room.hostId !== socket.data.playerId || room.phase !== 'reveal') return;
    clearTimers2(room); room.phase = 'lobby'; room.result = null; room.timerEndsAt = null; room.votes.clear(); room.timelines.clear(); for (const player of room.players.values()) player.ready = false; emit2(room);
  });
  socket.on('disconnect', () => {
    const room = getRoom2(socket), player = room?.players.get(socket.data.playerId); if (!room || !player || player.socketId !== socket.id) return;
    player.connected = false; player.socketId = null; room.votes.delete(player.id); room.timelines.delete(player.id); player.disconnectTimer = setTimeout(() => remove2(room, player.id), RECONNECT_GRACE_MS2);
    if (room.hostId === player.id) chooseHost2(room);
    if ((room.phase === 'investigate' || room.phase === 'vote') && room.glitchId === player.id) return finish2(room, { glitchId: player.id, glitchLeft: true, timelineSuccess: false, accused: null, tie: false });
    if (room.phase === 'vote' && room.votes.size >= active2(room).length) return endVote2(room);
    emit2(room);
  });
});

function listen2(port) {
  http2.once('error', error => {
    if (error.code === 'EADDRINUSE' && port < 3110) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy; trying http://localhost:${nextPort}`);
      listen2(nextPort);
      return;
    }
    throw error;
  });
  http2.listen(port, () => console.log(`PARALLAX listening on http://localhost:${port}`));
}

listen2(PORT2);
