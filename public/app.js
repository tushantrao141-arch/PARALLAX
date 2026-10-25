// Legacy prototype retained inert while the hardened client follows below.
if (false) {
const hasRealtime = typeof io === 'function';
const socket = hasRealtime ? io() : createOfflineSocket();
const app = document.querySelector('#app');
let state = null;
let dragId = null;

// Development-only convenience: reconnecting makes this harmless in production.
if (window.EventSource && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  const reloadFeed = new EventSource('/__parallax_reload');
  reloadFeed.onmessage = () => window.location.reload();
  // When Node's `--watch` restarts after a server edit, the event stream closes.
  // Refresh after its short reconnect delay so the page picks up the new server.
  reloadFeed.onerror = () => setTimeout(() => window.location.reload(), 500);
}

const esc = value => String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const initials = name => name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();

function createOfflineSocket() {
  // Opening index.html directly used to fail because Socket.IO is only supplied
  // by the Node server. This small local transport keeps the visual demo usable
  // from a file preview while making it clear that shared rooms need `npm run dev`.
  const listeners = {};
  const events = {
    lights: { label: 'The lights died', time: '9:12 PM', icon: '✦' },
    alarm: { label: 'The alarm sounded', time: '9:14 PM', icon: '◌' },
    door: { label: 'The control door opened', time: '9:15 PM', icon: '▱' },
    signal: { label: 'The signal turned blue', time: '9:16 PM', icon: '◈' },
    train: { label: 'The train vanished', time: '9:17 PM', icon: '↗' }
  };
  const mystery = { title: 'The 9:17 Vanishing', subtitle: 'Platform 7. Blackglass Station.', briefing: 'At 9:17 PM, the Nightline train vanished from Platform 7. Reconstruct what happened before the station resets.', events };
  let local;
  const notify = event => (listeners[event] || []).forEach(listener => listener(local));
  const beginVote = () => {
    if (!local || local.phase !== 'investigate') return;
    local.phase = 'vote'; local.timerEndsAt = Date.now() + 30000; notify('room:update');
  };
  return {
    on(event, listener) { (listeners[event] ||= []).push(listener); },
    emit(event, payload = {}) {
      if (event === 'demo:launch') {
        const you = { id: 'local-you', name: String(payload.name || 'You').slice(0, 16), ready: true, connected: true };
        local = { offline: true, code: 'DEMO', phase: 'investigate', mystery, hostId: you.id, players: [you, ...['Mira', 'Noah', 'Ivy', 'Jules', 'Ash'].map((name, i) => ({ id: `bot-${i}`, name, ready: true, connected: true }))], timerEndsAt: Date.now() + 90000, votes: 0, maxPlayers: 10, you: { id: you.id, name: you.name, role: 'INVESTIGATOR', clues: ['You saw the station lights cut out before anyone mentioned an alarm.', 'The platform clock froze only after the signal changed.', 'The technician said: “the blue light came last.”'] }, submittedTimeline: [], yourVote: null, result: null };
        notify('room:joined'); setTimeout(beginVote, 90000);
      } else if (event === 'timeline:submit' && local) {
        local.submittedTimeline = payload.timeline || []; notify('room:update');
      } else if (event === 'demo:vote') {
        beginVote();
      } else if (event === 'vote:cast' && local?.phase === 'vote') {
        local.yourVote = payload.playerId; local.votes = local.players.length;
        const glitch = local.players[2];
        local.phase = 'reveal'; local.timerEndsAt = null;
        local.result = { glitchId: glitch.id, accused: payload.playerId, caught: payload.playerId === glitch.id, timelineSuccess: local.submittedTimeline.join(',') === 'lights,alarm,door,signal,train' };
        notify('room:update');
      } else if (event === 'room:create') {
        const you = { id: 'local-you', name: String(payload.name || 'Agent').slice(0, 16), ready: false, connected: true };
        local = { offline: true, code: 'LOCAL', phase: 'lobby', mystery, hostId: you.id, players: [you], maxPlayers: 10, votes: 0, you: { id: you.id, name: you.name }, result: null };
        notify('room:joined');
      } else if (event === 'room:join') {
        (listeners['room:error'] || []).forEach(listener => listener('Offline preview cannot join rooms. Run npm run dev first.'));
      }
    }
  };
}

function landing() {
  app.innerHTML = `<div class="shell">
    <nav class="nav"><div class="brand"><span class="mark"></span>PARALLAX</div><div class="nav-note">social deduction / 03—10 players</div></nav>
    <section class="hero"><div>
      <span class="pill"><span class="pulse"></span> ${hasRealtime ? 'A multiplayer mystery where reality splits' : 'Offline preview — launch the demo below'}</span>
      <h1>One of your screens<br>is <em>lying.</em></h1>
      <p>Everyone has a piece of the same impossible case. One person has a convincing false version. Rebuild the truth before the station resets — and decide who you can trust.</p>
      <div class="how"><div><i>01</i><b>Private evidence</b>Every screen sees a different reality.</div><div><i>02</i><b>90 second debate</b>Compare notes. Catch contradictions.</div><div><i>03</i><b>One final vote</b>Find the Glitch — or let them walk.</div></div>
    </div><section class="landing-card"><div class="case-meta"><span class="eyebrow">Tonight’s case</span><span class="mono">CASE_001</span></div><h2 class="case-title">The 9:17 Vanishing</h2><p class="case-copy">A train disappeared from Platform 7. Five events are all you have to reconstruct the impossible.</p><div class="event-strip"><span></span><span></span><span></span><span></span><span></span></div>
      <form class="form" id="createForm"><input required maxlength="16" id="name" placeholder="Your name or callsign" autocomplete="nickname"><button class="button primary">Create a private room →</button></form><div class="or">OR PLAY A FULL ROUND SOLO</div><button class="button dark" id="demoBtn">Launch a demo table</button><form class="join-row" id="joinForm"><input required maxlength="5" id="code" placeholder="ROOM CODE" autocomplete="off"><button class="button dark">Join room</button></form>${hasRealtime ? '' : '<p class="notice" style="margin:14px 0 0">Preview mode is working locally. Start <code>npm run dev</code> for real room codes and multi-device play.</p>'}
    </section></section></div>`;
  document.querySelector('#createForm').onsubmit = e => { e.preventDefault(); socket.emit('room:create', { name: document.querySelector('#name').value }); };
  document.querySelector('#joinForm').onsubmit = e => { e.preventDefault(); const name = document.querySelector('#name').value || 'Agent'; socket.emit('room:join', { name, code: document.querySelector('#code').value }); };
  document.querySelector('#demoBtn').onclick = () => socket.emit('demo:launch', { name: document.querySelector('#name').value || 'You' });
}

function lobby() {
  const youHost = state.hostId === state.you.id;
  const ready = state.players.filter(p => p.ready).length;
  app.innerHTML = `<div class="shell"><nav class="nav"><div class="brand"><span class="mark"></span>PARALLAX</div><button class="room-code" data-copy>${state.code} <span class="mono">copy</span></button></nav>
  <section class="panel lobby"><span class="eyebrow">Secure room / ${state.players.length} of ${state.maxPlayers} investigators</span><h1>Assemble your witnesses.</h1><p>Share the room code. Every player needs their own screen — it is part of the mystery.</p><div class="roster">${state.players.map(playerCard).join('')}</div>
  ${youHost ? `<p class="notice">${state.players.length < 3 ? 'Need at least 3 players to open the case.' : `${ready}/${state.players.length} ready. You can begin whenever the room is ready.`}</p><button class="button primary" id="startBtn" ${state.players.length < 3 ? 'disabled' : ''}>Open the case →</button>` : `<button class="button dark" id="readyBtn">${state.players.find(p => p.id === state.you.id)?.ready ? '✓ You are ready' : 'Mark me ready'}</button>`}
  </section></div>`;
  bindCopy();
  document.querySelector('#startBtn')?.addEventListener('click', () => socket.emit('round:start'));
  document.querySelector('#readyBtn')?.addEventListener('click', () => socket.emit('player:ready'));
}

function playerCard(p) { return `<div class="player ${p.id === state.you?.id ? 'you' : ''}"><span class="avatar">${initials(p.name)}</span><span>${esc(p.name)}</span><span class="status ${p.ready ? 'ready' : ''}">${p.ready ? '●' : '○'}</span></div>`; }

function game() {
  const phaseNames = { investigate:'INVESTIGATE', vote:'PRIVATE VOTE', reveal:'CASE RESOLVED' };
  app.innerHTML = `<div class="shell"><nav class="topbar"><div class="brand"><span class="mark"></span>PARALLAX</div><div class="room-code" data-copy>ROOM ${state.code} · COPY</div><div class="timer" id="timer">—</div></nav>
    <main class="game"><aside class="panel side players-side"><h3>In this reality <span class="mono">${state.players.length}</span></h3><div class="players">${state.players.map(playerCard).join('')}</div><div class="mono" style="margin-top:20px;color:#6f7384">${state.votes || 0} votes logged</div></aside>
    <section class="case-main"><header class="panel case-header"><div class="eyebrow phase">${phaseNames[state.phase]}</div><h1>${state.mystery.title}</h1><p>${state.phase === 'investigate' ? state.mystery.briefing : state.phase === 'vote' ? 'The timeline has locked. Now decide whose reality was false.' : 'The station has let you see what really happened.'}</p></header>${mainContent()}</section>
    <aside class="right-side"><section class="panel role-card"><h4>Your signal</h4><div class="role ${state.you.role === 'GLITCH' ? 'glitch' : ''}">${state.you.role}</div><p>${state.you.role === 'GLITCH' ? 'Your clues are a clean fiction. Sound certain. Never contradict yourself too quickly.' : 'Your evidence is true. Find a shared sequence — and the person feeding you false reality.'}</p></section><section class="panel side"><h3>Case protocol</h3><p style="font-size:12px;color:#aeb1be;line-height:1.65;margin:0">Compare evidence out loud. Keep your own clues private until you decide what to share. The Glitch wins if they remain unseen.</p></section></aside>
    </main></div>`;
  bindCopy();
  if (state.phase === 'investigate') bindTimeline();
  document.querySelector('#demoVoteBtn')?.addEventListener('click', () => socket.emit('demo:vote'));
  if (state.phase === 'vote') bindVote();
  if (state.phase === 'reveal') document.querySelector('#againBtn')?.addEventListener('click', () => socket.emit('round:again'));
  updateTimer();
}

function mainContent() {
  if (state.phase === 'reveal') return reveal();
  if (state.phase === 'vote') return `<section class="panel vote"><span class="eyebrow">Who is carrying the false reality?</span><h2 style="font:700 29px 'Playfair Display',serif;margin:10px 0 20px">Make your accusation.</h2><div class="vote-options">${state.players.filter(p => p.id !== state.you.id).map(p => `<button class="suspect ${state.yourVote === p.id ? 'selected' : ''}" data-vote="${p.id}"><span class="avatar" style="display:inline-grid;margin-right:9px;vertical-align:middle">${initials(p.name)}</span>${esc(p.name)}${state.yourVote === p.id ? ' <span style="float:right;color:#ff9ece">ACCUSED</span>' : ''}</button>`).join('')}</div></section>`;
  const order = state.submittedTimeline.length === 5 ? state.submittedTimeline : Object.keys(state.mystery.events);
  return `<section class="panel clues"><span class="eyebrow">Your private evidence / do not show this screen</span><div class="clue-grid" style="margin-top:12px">${state.you.clues.map(c => `<div class="clue">${esc(c)}</div>`).join('')}</div></section><section class="panel timeline"><span class="eyebrow">Your hypothesis</span><h2 style="font:700 25px 'Playfair Display',serif;margin:8px 0 15px">Reconstruct the sequence</h2><div class="timeline-list" id="timeline">${order.map((id,i) => { const e=state.mystery.events[id]; return `<div class="event" draggable="true" data-event="${id}"><span class="handle">⋮⋮</span><b>${i+1}. ${e.label}</b><span>${e.icon}</span></div>`; }).join('')}</div><button class="button primary submit" id="submitTimeline">Lock my timeline</button>${state.offline ? '<button class="button dark submit" id="demoVoteBtn">Skip to accusation →</button>' : ''}</section>`;
}

function reveal() {
  const result = state.result || {}; const glitch = state.players.find(p => p.id === result.glitchId); const caught = result.caught;
  return `<section class="panel overlay result"><div class="reveal-icon">${caught ? '✦' : '◐'}</div><span class="eyebrow">${caught ? 'Reality restored' : 'Reality corrupted'}</span><h2>${caught ? 'You found the Glitch.' : 'The Glitch escaped.'}</h2><p>${glitch ? `<b>${esc(glitch.name)}</b> was carrying the false timeline.` : 'The false timeline slipped away.'} ${result.timelineSuccess ? 'Someone in the group reconstructed the correct sequence.' : 'No correct timeline made it through the station reset.'}</p><div class="truth"><small>THE TRUE SEQUENCE</small>${Object.values(state.mystery.events).map((e,i) => `<div style="padding:5px 0;border-bottom:${i===4?'0':'1px solid rgba(255,255,255,.08)'}">${i+1}. ${e.label} <span style="float:right;color:#9fa4b4">${e.time}</span></div>`).join('')}</div>${state.hostId === state.you.id ? '<button class="button primary" id="againBtn">Return to lobby →</button>' : '<p class="notice">Waiting for the host to reset the room…</p>'}</section>`;
}

function bindTimeline() {
  const list = document.querySelector('#timeline');
  list.querySelectorAll('.event').forEach(el => {
    el.addEventListener('dragstart', () => { dragId = el.dataset.event; el.style.opacity = '.4'; });
    el.addEventListener('dragend', () => { el.style.opacity = '1'; dragId = null; });
    el.addEventListener('dragover', e => e.preventDefault());
    el.addEventListener('drop', e => { e.preventDefault(); const from = list.querySelector(`[data-event="${dragId}"]`); if (from && from !== el) list.insertBefore(from, el); });
  });
  document.querySelector('#submitTimeline').onclick = () => { const timeline = [...list.children].map(x => x.dataset.event); socket.emit('timeline:submit', { timeline }); toast('Timeline locked. Keep debating.'); };
}

function bindVote() { document.querySelectorAll('[data-vote]').forEach(el => el.onclick = () => socket.emit('vote:cast', { playerId:el.dataset.vote })); }
function bindCopy() { document.querySelectorAll('[data-copy]').forEach(el => el.onclick = async () => { try { await navigator.clipboard.writeText(state?.code || ''); toast('Room code copied'); } catch { toast('Room code: ' + state?.code); } }); }
function toast(msg) { const x=document.createElement('div');x.className='toast';x.textContent=msg;document.body.append(x);setTimeout(()=>x.remove(),2200); }
function updateTimer() { const el=document.querySelector('#timer'); if (!el || !state?.timerEndsAt) { if(el) el.textContent=state?.phase==='reveal'?'ARCHIVED':'LOBBY'; return; } const sec=Math.max(0, Math.ceil((state.timerEndsAt-Date.now())/1000)); el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; if (sec) setTimeout(updateTimer, 500); }

socket.on('room:joined', data => { state=data; render(); });
socket.on('room:update', data => { state=data; render(); });
socket.on('room:error', message => toast(message));
function render() { if (!state) landing(); else if (state.phase === 'lobby') lobby(); else game(); }
landing();
}

// ── Hardened client implementation ─────────────────────────────────────────
const app2 = document.querySelector('#app');
const realtime2 = typeof io === 'function';
const savedId2 = localStorage.getItem('parallax-player-id');
const playerId2 = savedId2 || (globalThis.crypto?.randomUUID?.() || `p_${Math.random().toString(36).slice(2)}${Date.now()}`);
localStorage.setItem('parallax-player-id', playerId2);
const socket2 = realtime2 ? io({ auth: { playerId: playerId2 } }) : offlineSocket2();
let state2 = null;
let timerInterval2 = null;
let clockOffset2 = 0;

if (window.EventSource && ['localhost', '127.0.0.1'].includes(location.hostname)) {
  const feed2 = new EventSource('/__parallax_reload');
  feed2.onmessage = () => location.reload();
}

const esc2 = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const initials2 = name => String(name).split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
const eventOrder2 = ['lights', 'alarm', 'door', 'signal', 'train'];

function offlineSocket2() {
  const listeners = {};
  const events = Object.fromEntries(eventOrder2.map((id, index) => [id, { label: ['The lights died', 'The alarm sounded', 'The control door opened', 'The signal turned blue', 'The train vanished'][index], icon: ['✦', '◌', '▱', '◈', '↗'][index] }]));
  const mystery = { title: 'The 9:17 Vanishing', briefing: 'At 9:17 PM, the Nightline train vanished from Platform 7. Reconstruct what happened before the station resets.', events };
  let local;
  const tell = event => (listeners[event] || []).forEach(listener => listener(local));
  return {
    on(event, listener) { (listeners[event] ||= []).push(listener); },
    emit(event, value = {}) {
      if (event === 'demo:launch') {
        const you = { id: playerId2, name: String(value.name || 'You').slice(0, 16), ready: true, connected: true };
        local = { offline: true, code: 'DEMO', phase: 'investigate', mystery, hostId: playerId2, players: [you, ...['Mira', 'Noah', 'Ivy', 'Jules', 'Ash'].map((name, i) => ({ id: `demo-${i}`, name, ready: true, connected: true }))], maxPlayers: 10, timerEndsAt: Date.now() + 90_000, serverNow: Date.now(), votes: 0, you: { id: playerId2, name: you.name, role: 'INVESTIGATOR', clues: ['You saw the lights fail before the alarm.', 'The blue signal came before the disappearance.', 'The door opened while the alarm rang.'] }, submittedTimeline: [], yourVote: null };
        tell('room:joined');
      } else if (event === 'timeline:submit' && local) { local.submittedTimeline = value.timeline; tell('room:update'); }
      else if (event === 'demo:vote' && local) { local.phase = 'vote'; local.timerEndsAt = Date.now() + 30_000; tell('room:update'); }
      else if (event === 'vote:cast' && local?.phase === 'vote') { const glitch = local.players[2]; local.yourVote = value.playerId; local.phase = 'reveal'; local.timerEndsAt = null; local.result = { glitchId: glitch.id, accused: value.playerId, caught: value.playerId === glitch.id, tie: false, timelineSuccess: local.submittedTimeline?.join(',') === eventOrder2.join(',') }; tell('room:update'); }
      else if (event === 'room:create') { const you = { id: playerId2, name: String(value.name || 'Agent').slice(0, 16), ready: false, connected: true }; local = { offline: true, code: 'LOCAL', phase: 'lobby', mystery, hostId: playerId2, players: [you], maxPlayers: 10, timerEndsAt: null, serverNow: Date.now(), votes: 0, you: { id: playerId2, name: you.name }, submittedTimeline: [], yourVote: null }; tell('room:joined'); }
      else if (event === 'player:ready' && local) { local.players[0].ready = !local.players[0].ready; tell('room:update'); }
      else if (event === 'room:join') (listeners['room:error'] || []).forEach(listener => listener('Offline preview cannot join a room. Start the Node server for multiplayer.'));
    }
  };
}

function landing2() {
  app2.innerHTML = `<div class="shell"><nav class="nav"><div class="brand"><span class="mark"></span>PARALLAX</div><div class="nav-note">social deduction / 03—10 players</div></nav><section class="hero"><div><span class="pill"><span class="pulse"></span>${realtime2 ? ' A multiplayer mystery where reality splits' : ' Offline preview — launch the demo below'}</span><h1>One of your screens<br>is <em>lying.</em></h1><p>Everyone has a piece of the same impossible case. One person has a convincing false version. Rebuild the truth before the station resets — and decide who you can trust.</p><div class="how"><div><i>01</i><b>Private evidence</b>Every screen sees a different reality.</div><div><i>02</i><b>90 second debate</b>Compare notes. Catch contradictions.</div><div><i>03</i><b>One final vote</b>Find the Glitch — or let them walk.</div></div></div><section class="landing-card"><div class="case-meta"><span class="eyebrow">Tonight’s case</span><span class="mono">CASE_001</span></div><h2 class="case-title">The 9:17 Vanishing</h2><p class="case-copy">A train disappeared from Platform 7. Five events are all you have to reconstruct the impossible.</p><div class="event-strip"><span></span><span></span><span></span><span></span><span></span></div><form class="form" id="createForm2"><input required maxlength="16" id="name2" placeholder="Your name or callsign" autocomplete="nickname"><button class="button primary">Create a private room →</button></form><div class="or">OR PLAY A FULL ROUND SOLO</div><button class="button dark" id="demoBtn2">Launch a demo table</button><form class="join-row" id="joinForm2"><input required maxlength="5" id="code2" placeholder="ROOM CODE" autocomplete="off"><button class="button dark">Join room</button></form>${realtime2 ? '' : '<p class="notice" style="margin:14px 0 0">Preview mode works locally. Use npm run dev for real room codes.</p>'}</section></section></div>`;
  document.querySelector('#createForm2').onsubmit = event => { event.preventDefault(); socket2.emit('room:create', { name: document.querySelector('#name2').value }); };
  document.querySelector('#joinForm2').onsubmit = event => { event.preventDefault(); socket2.emit('room:join', { name: document.querySelector('#name2').value || 'Agent', code: document.querySelector('#code2').value }); };
  document.querySelector('#demoBtn2').onclick = () => socket2.emit('demo:launch', { name: document.querySelector('#name2').value || 'You' });
}

function playerCard2(player) {
  return `<div class="player ${player.id === state2.you?.id ? 'you' : ''}"><span class="avatar">${initials2(player.name)}</span><span>${esc2(player.name)}</span><span class="status ${player.connected ? (player.ready ? 'ready' : '') : ''}">${player.connected ? (player.ready ? '●' : '○') : '—'}</span></div>`;
}

function lobby2() {
  const me = state2.players.find(player => player.id === state2.you.id);
  const isHost = state2.hostId === state2.you.id;
  const active = state2.players.filter(player => player.connected);
  const canStart = active.length >= 3 && active.every(player => player.ready);
  app2.innerHTML = `<div class="shell"><nav class="nav"><div class="brand"><span class="mark"></span>PARALLAX</div><button class="room-code" data-copy2>${state2.code} <span class="mono">copy</span></button></nav><section class="panel lobby"><span class="eyebrow">Secure room / ${active.length} of ${state2.maxPlayers} investigators</span><h1>Assemble your witnesses.</h1><p>Share the room code. Each player needs their own screen — it is part of the mystery.</p><div class="roster">${state2.players.map(playerCard2).join('')}</div><button class="button ${me?.ready ? 'dark' : 'primary'}" id="readyBtn2">${me?.ready ? '✓ You are ready — change' : 'Mark me ready'}</button>${isHost ? `<p class="notice">${active.length < 3 ? 'Need at least 3 connected players.' : canStart ? 'All connected players are ready. Open the case.' : 'Everyone must mark ready before the case can begin.'}</p><button class="button primary" id="startBtn2" ${canStart ? '' : 'disabled'}>Open the case →</button>` : `<p class="notice">Waiting for ${esc2(state2.players.find(player => player.id === state2.hostId)?.name || 'the host')} to open the case.</p>`}</section></div>`;
  bindCopy2();
  document.querySelector('#readyBtn2').onclick = () => socket2.emit('player:ready');
  document.querySelector('#startBtn2')?.addEventListener('click', () => socket2.emit('round:start'));
}

function game2() {
  const phaseLabel = { investigate: 'INVESTIGATE', vote: 'PRIVATE VOTE', reveal: 'CASE RESOLVED' }[state2.phase];
  app2.innerHTML = `<div class="shell"><nav class="topbar"><div class="brand"><span class="mark"></span>PARALLAX</div><button class="room-code" data-copy2>ROOM ${state2.code} · COPY</button><div class="timer" id="timer2">—</div></nav><main class="game"><aside class="panel side players-side"><h3>In this reality <span class="mono">${state2.players.filter(player => player.connected).length}</span></h3><div class="players">${state2.players.map(playerCard2).join('')}</div><div class="mono" style="margin-top:20px;color:#6f7384">${state2.votes || 0} votes logged</div></aside><section class="case-main"><header class="panel case-header"><div class="eyebrow phase">${phaseLabel}</div><h1>${esc2(state2.mystery.title)}</h1><p>${state2.phase === 'investigate' ? esc2(state2.mystery.briefing) : state2.phase === 'vote' ? 'The timeline has locked. Now decide whose reality was false.' : 'The station has let you see what really happened.'}</p></header>${caseContent2()}</section><aside class="right-side"><section class="panel role-card"><h4>Your signal</h4><div class="role ${state2.you.role === 'GLITCH' ? 'glitch' : ''}">${state2.you.role || 'ASSEMBLING'}</div><p>${state2.you.role === 'GLITCH' ? 'Your evidence is a convincing lie. Sound certain — but keep your story consistent.' : 'Your evidence is true. Find a shared sequence and expose whoever is bending reality.'}</p></section><section class="panel side"><h3>Case protocol</h3><p style="font-size:12px;color:#aeb1be;line-height:1.65;margin:0">Compare evidence out loud. Keep your own clue cards private until you choose what to share.</p></section></aside></main></div>`;
  bindCopy2();
  if (state2.phase === 'investigate') bindTimeline2();
  if (state2.phase === 'vote') bindVote2();
  if (state2.phase === 'reveal') document.querySelector('#againBtn2')?.addEventListener('click', () => socket2.emit('round:again'));
  document.querySelector('#demoVote2')?.addEventListener('click', () => socket2.emit('demo:vote'));
  startTimer2();
}

function caseContent2() {
  if (state2.phase === 'reveal') return reveal2();
  if (state2.phase === 'vote') return `<section class="panel vote"><span class="eyebrow">Who is carrying the false reality?</span><h2 style="font:700 29px 'Playfair Display',serif;margin:10px 0 20px">Make your accusation.</h2><p style="color:#aeb1be;font-size:13px">Your vote can be changed until the voting window closes.</p><div class="vote-options">${state2.players.filter(player => player.id !== state2.you.id && player.connected).map(player => `<button class="suspect ${state2.yourVote === player.id ? 'selected' : ''}" data-vote2="${player.id}"><span class="avatar" style="display:inline-grid;margin-right:9px;vertical-align:middle">${initials2(player.name)}</span>${esc2(player.name)}${state2.yourVote === player.id ? '<span style="float:right;color:#ff9ece">ACCUSED</span>' : ''}</button>`).join('')}</div></section>`;
  const order = state2.submittedTimeline.length === eventOrder2.length ? state2.submittedTimeline : eventOrder2;
  return `<section class="panel clues"><span class="eyebrow">Your private evidence / do not show this screen</span><div class="clue-grid" style="margin-top:12px">${state2.you.clues.map(clue => `<div class="clue">${esc2(clue)}</div>`).join('')}</div></section><section class="panel timeline"><span class="eyebrow">Your hypothesis</span><h2 style="font:700 25px 'Playfair Display',serif;margin:8px 0 15px">Reconstruct the sequence</h2><p style="color:#aeb1be;font-size:12px;margin:0 0 12px">Use the arrows — built for phones as well as desktops.</p><div class="timeline-list" id="timeline2">${order.map((id, index) => { const event = state2.mystery.events[id]; return `<div class="event" data-event2="${id}"><span class="handle">${index + 1}</span><b>${esc2(event.label)}</b><span class="event-actions"><button class="move" data-move2="up" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>↑</button><button class="move" data-move2="down" aria-label="Move down" ${index === order.length - 1 ? 'disabled' : ''}>↓</button></span></div>`; }).join('')}</div><button class="button primary submit" id="submitTimeline2">Lock my timeline</button>${state2.offline ? '<button class="button dark submit" id="demoVote2">Skip to accusation →</button>' : ''}</section>`;
}

function reveal2() {
  const result = state2.result || {};
  const glitch = state2.players.find(player => player.id === result.glitchId);
  const heading = result.glitchLeft ? 'The Glitch slipped away.' : result.caught ? 'You found the Glitch.' : result.tie ? 'The vote was tied.' : 'No conviction.';
  return `<section class="panel overlay result"><div class="reveal-icon">${result.caught ? '✦' : '◐'}</div><span class="eyebrow">${result.caught ? 'Reality restored' : 'Reality corrupted'}</span><h2>${heading}</h2><p>${result.glitchLeft ? 'The Glitch disconnected before the case could close.' : glitch ? `<b>${esc2(glitch.name)}</b> was carrying the false timeline.` : 'The false timeline slipped away.'} ${result.timelineSuccess ? 'A majority of the group reconstructed the correct sequence.' : 'The group did not reach a majority on the true sequence.'}</p><div class="truth"><small>THE TRUE SEQUENCE</small>${Object.values(state2.mystery.events).map((event, index) => `<div style="padding:5px 0;border-bottom:${index === 4 ? '0' : '1px solid rgba(255,255,255,.08)'}">${index + 1}. ${esc2(event.label)} <span style="float:right;color:#9fa4b4">${esc2(event.time || '')}</span></div>`).join('')}</div>${state2.hostId === state2.you.id ? '<button class="button primary" id="againBtn2">Return to lobby →</button>' : '<p class="notice">Waiting for the host to reset the room…</p>'}</section>`;
}

function bindTimeline2() {
  const list = document.querySelector('#timeline2');
  list.querySelectorAll('.event').forEach(card => {
    card.querySelectorAll('[data-move2]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.move2 === 'up' && card.previousElementSibling) list.insertBefore(card, card.previousElementSibling);
      if (button.dataset.move2 === 'down' && card.nextElementSibling) list.insertBefore(card.nextElementSibling, card);
      refreshPositions2(list);
    }));
  });
  document.querySelector('#submitTimeline2').onclick = () => {
    const timeline = [...list.children].map(card => card.dataset.event2);
    socket2.emit('timeline:submit', { timeline });
    toast2('Timeline locked. Keep debating.');
  };
}

function refreshPositions2(list) {
  [...list.children].forEach((card, index, cards) => {
    card.querySelector('.handle').textContent = index + 1;
    card.querySelector('[data-move2="up"]').disabled = index === 0;
    card.querySelector('[data-move2="down"]').disabled = index === cards.length - 1;
  });
}
function bindVote2() { document.querySelectorAll('[data-vote2]').forEach(button => button.addEventListener('click', () => socket2.emit('vote:cast', { playerId: button.dataset.vote2 }))); }
function bindCopy2() { document.querySelectorAll('[data-copy2]').forEach(button => button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(state2.code); toast2('Room code copied'); } catch { toast2(`Room code: ${state2.code}`); } })); }
function toast2(message) { const node = document.createElement('div'); node.className = 'toast'; node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 2200); }
function updateTimer2() {
  const element = document.querySelector('#timer2');
  if (!element || !state2?.timerEndsAt) { if (element) element.textContent = state2?.phase === 'reveal' ? 'ARCHIVED' : 'LOBBY'; return; }
  const seconds = Math.max(0, Math.ceil((state2.timerEndsAt - (Date.now() + clockOffset2)) / 1000));
  element.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function startTimer2() { clearInterval(timerInterval2); updateTimer2(); if (state2?.timerEndsAt) timerInterval2 = setInterval(updateTimer2, 500); }
function render2() { clearInterval(timerInterval2); if (!state2) landing2(); else if (state2.phase === 'lobby') lobby2(); else game2(); }

socket2.on('room:joined', data => { state2 = data; clockOffset2 = (data.serverNow || Date.now()) - Date.now(); render2(); });
socket2.on('room:update', data => { state2 = data; clockOffset2 = (data.serverNow || Date.now()) - Date.now(); render2(); });
socket2.on('room:error', message => toast2(message));
landing2();
