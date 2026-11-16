// El Adefesio de Oro - servidor de votacion en tiempo real
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = Number(process.env.PORT) || 3000;
const STATE_FILE = path.join(__dirname, 'state.json');
const PUBLIC = path.join(__dirname, 'public');

const DEMO_NAMES = ['Axel', 'Mamá', 'Papá', 'Abuela Marta', 'Tío Carlos', 'Tía Laura', 'Sofía', 'Martín'];

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
function freshState(participants = []) {
  return {
    phase: 'setup', // setup | votando | revelado
    round: 0,
    participants, // todos los que votan
    candidates: [], // a quienes se puede votar (en desempate: solo los empatados)
    claims: {}, // nombre -> deviceId
    votes: {}, // votante -> candidato
    results: null,
    climax: false, // true cuando la tele ya mostro al ganador
    tiebreak: false,
    year: new Date().getFullYear(),
    demo: false,
  };
}

let state = freshState();
try {
  if (fs.existsSync(STATE_FILE)) {
    state = { ...freshState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
    console.log('  Estado recuperado de state.json (fase: ' + state.phase + ')');
  }
} catch (e) {
  console.warn('  No se pudo leer state.json, arranco de cero:', e.message);
}
if (state.phase === 'revelado') state.climax = true;

function save() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn('No se pudo guardar state.json:', e.message);
  }
}

function computeResults() {
  const counts = Object.fromEntries(state.candidates.map((n) => [n, 0]));
  for (const c of Object.values(state.votes)) if (c in counts) counts[c]++;
  const ranking = Object.entries(counts)
    .map(([name, votes]) => ({ name, votes }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'es'));
  let place = 0;
  ranking.forEach((r, i) => {
    if (i === 0 || r.votes !== ranking[i - 1].votes) place = i + 1;
    r.place = place;
  });
  const top = ranking.length ? ranking[0].votes : 0;
  const winners = ranking.filter((r) => r.votes === top).map((r) => r.name);
  return {
    ranking,
    winners,
    top,
    tie: winners.length > 1,
    totalVotes: Object.keys(state.votes).length,
    tiebreak: state.tiebreak,
  };
}

function stateFor(isAdmin) {
  const showResults = state.phase === 'revelado' && (isAdmin || state.climax);
  return {
    phase: state.phase,
    round: state.round,
    participants: state.participants,
    candidates: state.candidates,
    claimed: Object.keys(state.claims),
    voted: Object.keys(state.votes),
    results: showResults ? state.results : null,
    climax: state.climax,
    tiebreak: state.tiebreak,
    year: state.year,
    demo: state.demo,
  };
}

function nameOf(deviceId) {
  return Object.keys(state.claims).find((n) => state.claims[n] === deviceId) || null;
}

// ---------------------------------------------------------------------------
// Red local
// ---------------------------------------------------------------------------
function localIPs() {
  const out = [];
  for (const [ifname, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      let score = 0;
      if (/^(wl|wlan|wi-?fi|en|eth)/i.test(ifname)) score += 10;
      if (/^(docker|br-|veth|vbox|virbr|vmnet|tun|tap|tailscale|zt|lxc|podman)/i.test(ifname)) score -= 20;
      if (a.address.startsWith('192.168.56.')) score -= 15; // red tipica de VirtualBox
      if (a.address.startsWith('192.168.')) score += 3;
      else if (a.address.startsWith('10.')) score += 2;
      out.push({ ifname, address: a.address, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
const ips = localIPs();
const HOST_IP = process.env.HOST_IP || (ips[0] && ips[0].address) || 'localhost';
const BASE_URL = `http://${HOST_IP}:${PORT}`;

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.get('/votar', (_req, res) => res.sendFile(path.join(PUBLIC, 'votar.html')));
app.get('/health', (_req, res) => res.status(200).send('ok'));
app.get('/api/info', async (req, res) => {
  // La URL pública la manda el navegador (window.location.origin); si no viene, se usa la IP local.
  let base = BASE_URL;
  try {
    const u = new URL(String(req.query.origin || ''));
    if (u.protocol === 'http:' || u.protocol === 'https:') base = u.origin;
  } catch (_) {}
  const voteUrl = base + '/votar';
  const qrSvg = await QRCode.toString(voteUrl, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b0b12', light: '#00000000' },
  });
  res.json({ url: base, displayUrl: base.replace(/^https?:\/\//, ''), voteUrl, qrSvg });
});
app.use(express.static(PUBLIC, { extensions: ['html'] }));

// ---------------------------------------------------------------------------
// Sockets
// ---------------------------------------------------------------------------
function broadcast() {
  io.to('admin').emit('state', stateFor(true));
  io.to('voters').emit('state', stateFor(false));
  save();
}

let climaxTimer = null;
function setClimax() {
  clearTimeout(climaxTimer);
  if (state.phase === 'revelado' && !state.climax) {
    state.climax = true;
    broadcast();
  }
}

function startVoting(participants, { demo = false } = {}) {
  stopDemo();
  state = freshState(participants);
  state.phase = 'votando';
  state.round = 1;
  state.candidates = [...participants];
  state.demo = demo;
  broadcast();
}

io.on('connection', (socket) => {
  socket.on('hello', ({ role, deviceId } = {}) => {
    if (role === 'admin') {
      socket.join('admin');
      socket.emit('state', stateFor(true));
    } else {
      socket.join('voters');
      socket.data.deviceId = deviceId;
      socket.emit('state', stateFor(false));
      socket.emit('me', { name: nameOf(deviceId) });
    }
  });

  // ---- votantes ----
  socket.on('claim', ({ deviceId, name } = {}, ack = () => {}) => {
    if (state.phase !== 'votando') return ack({ ok: false, error: 'La votación no está abierta.' });
    if (!state.participants.includes(name)) return ack({ ok: false, error: 'Ese nombre no está en la lista.' });
    const owner = state.claims[name];
    if (owner && owner !== deviceId) return ack({ ok: false, error: 'Ese nombre ya fue elegido.' });
    const current = nameOf(deviceId);
    if (current && current !== name) {
      if (state.votes[current]) return ack({ ok: false, error: 'Ya votaste como ' + current + '.' });
      delete state.claims[current];
    }
    state.claims[name] = deviceId;
    ack({ ok: true, name });
    socket.emit('me', { name });
    broadcast();
  });

  socket.on('unclaim', ({ deviceId } = {}, ack = () => {}) => {
    const current = nameOf(deviceId);
    if (current && !state.votes[current]) {
      delete state.claims[current];
      broadcast();
    }
    socket.emit('me', { name: nameOf(deviceId) });
    ack({ ok: true });
  });

  socket.on('vote', ({ deviceId, candidate } = {}, ack = () => {}) => {
    if (state.phase !== 'votando') return ack({ ok: false, error: 'La votación está cerrada.' });
    const voter = nameOf(deviceId);
    if (!voter) return ack({ ok: false, error: 'Primero elegí quién sos.' });
    if (state.votes[voter]) return ack({ ok: false, error: 'Ya votaste.' });
    if (candidate === voter) return ack({ ok: false, error: 'No te podés votar a vos mismo.' });
    if (!state.candidates.includes(candidate)) return ack({ ok: false, error: 'Esa persona no está en la votación.' });
    state.votes[voter] = candidate;
    ack({ ok: true });
    broadcast();
  });

  // ---- admin ----
  socket.on('admin:start', ({ participants } = {}, ack = () => {}) => {
    const clean = [];
    for (const raw of participants || []) {
      const n = String(raw).trim().replace(/\s+/g, ' ').slice(0, 40);
      if (n && !clean.some((c) => c.toLowerCase() === n.toLowerCase())) clean.push(n);
    }
    if (clean.length < 3) return ack({ ok: false, error: 'Hacen falta al menos 3 participantes.' });
    startVoting(clean);
    ack({ ok: true });
  });

  socket.on('admin:demo', ({ mode } = {}, ack = () => {}) => {
    startVoting([...DEMO_NAMES], { demo: true });
    runDemo(mode === 'empate');
    ack({ ok: true });
  });

  socket.on('admin:reveal', (_ = {}, ack = () => {}) => {
    if (state.phase !== 'votando') return ack({ ok: false });
    stopDemo();
    state.results = computeResults();
    state.phase = 'revelado';
    state.climax = false;
    clearTimeout(climaxTimer);
    climaxTimer = setTimeout(setClimax, 45000); // por si la tele se recarga a mitad de la animacion
    broadcast();
    ack({ ok: true });
  });

  socket.on('admin:climax', () => setClimax());

  socket.on('admin:tiebreak', (_ = {}, ack = () => {}) => {
    if (state.phase !== 'revelado' || !state.results || !state.results.tie) return ack({ ok: false });
    clearTimeout(climaxTimer);
    state.candidates = [...state.results.winners];
    state.votes = {};
    state.results = null;
    state.climax = false;
    state.tiebreak = true;
    state.phase = 'votando';
    state.round++;
    broadcast();
    if (state.demo) runDemo(false);
    ack({ ok: true });
  });

  socket.on('admin:reset', (_ = {}, ack = () => {}) => {
    stopDemo();
    clearTimeout(climaxTimer);
    state = freshState(state.participants);
    broadcast();
    ack({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Modo demo: participantes falsos que entran y votan solos
// ---------------------------------------------------------------------------
let demoTimers = [];
function stopDemo() {
  demoTimers.forEach(clearTimeout);
  demoTimers = [];
}
const rand = (a, b) => a + Math.random() * (b - a);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function planVotes(voters, candidates, wantTie) {
  const fav = shuffle(candidates);
  const weight = (c) => (c === fav[0] ? 6 : c === fav[1] ? (wantTie ? 6 : 3) : 1);
  for (let t = 0; t < 500; t++) {
    const plan = {};
    for (const v of voters) {
      const opts = candidates.filter((c) => c !== v);
      const total = opts.reduce((s, c) => s + weight(c), 0);
      let r = Math.random() * total;
      plan[v] = opts.find((c) => (r -= weight(c)) < 0) || opts[0];
    }
    const counts = {};
    Object.values(plan).forEach((c) => (counts[c] = (counts[c] || 0) + 1));
    const sorted = Object.values(counts).sort((a, b) => b - a);
    const tieTop = sorted.filter((x) => x === sorted[0]).length;
    if (wantTie ? tieTop === 2 : tieTop === 1) return plan;
  }
  return null;
}

function runDemo(wantTie) {
  stopDemo();
  const round = state.round;
  const voters = shuffle(state.participants);
  const plan = planVotes(voters, state.candidates, wantTie) || {};
  let t = 1200;
  for (const v of voters) {
    const claimAt = t;
    const voteAt = claimAt + rand(700, 1800);
    demoTimers.push(
      setTimeout(() => {
        if (state.phase !== 'votando' || state.round !== round) return;
        if (!state.claims[v]) state.claims[v] = 'demo-' + v;
        broadcast();
      }, claimAt),
      setTimeout(() => {
        if (state.phase !== 'votando' || state.round !== round) return;
        if (state.claims[v] && state.claims[v].startsWith('demo-') && !state.votes[v]) {
          const opts = state.candidates.filter((c) => c !== v);
          state.votes[v] = plan[v] && opts.includes(plan[v]) ? plan[v] : opts[Math.floor(Math.random() * opts.length)];
          broadcast();
        }
      }, voteAt)
    );
    t += rand(1000, 2000);
  }
}

// ---------------------------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  const line = '-'.repeat(56);
  console.log('\n' + line);
  console.log('  EL ADEFESIO DE ORO - Familia Hernández Pose');
  console.log(line);
  console.log('  Tele / compu (admin):  ' + BASE_URL + '/admin');
  console.log('  Celulares (votar):     ' + BASE_URL);
  console.log('  Modo demo:             ' + BASE_URL + '/admin?demo=1');
  if (ips.length > 1) {
    console.log('\n  Otras IPs detectadas (si la de arriba no anda):');
    ips.slice(1).forEach((i) => console.log('    ' + i.ifname.padEnd(14) + 'http://' + i.address + ':' + PORT));
    console.log('  Podés forzar una con: HOST_IP=192.168.x.x npm start');
  }
  console.log(line + '\n');
});
