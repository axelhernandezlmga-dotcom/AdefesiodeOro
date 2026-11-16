// Panel de administracion + modo presentacion (tele)
(function () {
  const $ = (id) => document.getElementById(id);
  const I = window.ICONS;
  const esc = window.VApp.esc;
  const stage = $('stage');
  const params = new URLSearchParams(location.search);
  if (params.has('demo')) document.body.classList.add('has-demo');

  // ---- iconos en botones ----
  document.querySelectorAll('[data-icon]').forEach((b) => b.insertAdjacentHTML('afterbegin', I[b.dataset.icon] || ''));
  const muteBtn = $('btn-mute');
  const paintMute = () => (muteBtn.innerHTML = window.Sfx.isMuted() ? I.mute : I.volume);
  paintMute();

  // ---- escalado del escenario 1920x1080 ----
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  fit();
  window.addEventListener('resize', fit);
  const toViewport = (x, y) => {
    const r = stage.getBoundingClientRect();
    const s = r.width / 1920;
    return { x: r.left + x * s, y: r.top + y * s };
  };

  window.FX.mount(document.body);
  window.Tutorial.mount($('tutorial'));

  const socket = io({ reconnectionDelayMax: 2000 });
  window.Reveal.init({
    toViewport,
    onClimax: () => socket.emit('admin:climax'),
  });

  // ---- vistas ----
  let view = null;
  function showView(name) {
    if (view === name) return;
    view = name;
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'v-' + name));
    if (name === 'present') window.Tutorial.start();
    else window.Tutorial.stop();
    if (name !== 'reveal') {
      window.Reveal.cancel();
      window.FX.setBackground(true, 1);
    }
    if (name === 'setup') setTimeout(() => $('name-input').focus(), 350);
    updateAudioHint();
  }

  // ---- audio ----
  function unlockAudio() {
    window.Sfx.init();
    setTimeout(updateAudioHint, 100);
  }
  function updateAudioHint() {
    const needs = (view === 'present' || view === 'reveal') && !window.Sfx.ready();
    document.body.classList.toggle('needs-audio', needs);
  }
  document.addEventListener('pointerdown', unlockAudio, { capture: true });

  function goFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else goFullscreen();
  }

  // ---- modal de confirmacion ----
  let modalResolve = null;
  function confirmBox(title, text, ok = 'Confirmar') {
    $('modal-title').textContent = title;
    $('modal-text').textContent = text;
    $('modal-ok').textContent = ok;
    $('modal').classList.add('is-open');
    return new Promise((res) => (modalResolve = res));
  }
  function closeModal(v) {
    $('modal').classList.remove('is-open');
    if (modalResolve) modalResolve(v);
    modalResolve = null;
  }

  // ---- participantes (setup) ----
  let names = [];
  try { names = JSON.parse(localStorage.getItem('adefesio.names') || '[]'); } catch (e) {}
  if (!Array.isArray(names)) names = [];
  const saveNames = () => { try { localStorage.setItem('adefesio.names', JSON.stringify(names)); } catch (e) {} };

  const input = $('name-input');
  const hint = $('setup-hint');
  const HINT = hint.innerHTML;
  let hintTimer;
  function setHint(msg) {
    clearTimeout(hintTimer);
    if (!msg) { hint.innerHTML = HINT; hint.classList.remove('is-error'); return; }
    hint.textContent = msg;
    hint.classList.add('is-error');
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    hintTimer = setTimeout(() => setHint(null), 2600);
  }

  function renderChips() {
    $('chips').innerHTML = names.length
      ? names.map((n, i) => `<span class="chip">${esc(n)}<button type="button" data-remove="${i}" title="Quitar">${I.x}</button></span>`).join('')
      : '<div class="chips-empty">Todavía no hay nadie. Empezá por vos.</div>';
    const n = names.length;
    $('setup-count').innerHTML = `<b>${n}</b>${n === 1 ? 'participante' : 'participantes'}${n < 3 ? ' · mínimo 3' : ''}`;
    $('btn-start').disabled = n < 3;
  }

  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = input.value.trim().replace(/\s+/g, ' ');
    if (!n) return setHint('Escribí un nombre primero.');
    if (names.some((x) => x.toLowerCase() === n.toLowerCase())) return setHint(`${n} ya está en la lista.`);
    names.push(n);
    input.value = '';
    setHint(null);
    saveNames();
    renderChips();
    const chips = $('chips');
    chips.scrollTop = chips.scrollHeight;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && names.length) {
      names.pop();
      saveNames();
      renderChips();
    }
  });
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    names.splice(Number(b.dataset.remove), 1);
    saveNames();
    renderChips();
    input.focus();
  });
  renderChips();

  // ---- presentacion ----
  let S = null;
  let builtRound = null;
  let prevVoted = new Set();
  let wasAllVoted = false;
  let pendingReveal = false;

  function layoutFor(n) {
    if (n <= 3) return [n, 1];
    if (n === 4) return [2, 2];
    if (n <= 6) return [3, 2];
    if (n <= 8) return [4, 2];
    if (n === 9) return [3, 3];
    if (n <= 12) return [4, 3];
    if (n <= 15) return [5, 3];
    if (n <= 20) return [5, 4];
    return [6, Math.ceil(n / 6)];
  }

  function buildPresentation(s) {
    builtRound = s.round;
    const grid = $('grid');
    const n = s.participants.length;
    const [cols, rows] = layoutFor(n);
    grid.style.setProperty('--cols', cols);
    grid.style.setProperty('--rows', rows);
    const gridW = grid.clientWidth || 940;
    const cardW = (gridW - (cols - 1) * 18) / cols;
    const cardH = (452 - (rows - 1) * 18) / rows;
    const statusFs = Math.round(Math.max(16, Math.min(26, cardH * 0.13)));
    grid.innerHTML = s.participants
      .map((name) => {
        const fs = Math.floor(Math.max(22, Math.min(cardH * 0.42, 88, (cardW - 48) / (name.length * 0.43))));
        return `<div class="card" data-name="${esc(name)}" style="--fs:${fs}px;--fs-status:${statusFs}px">
          <div class="card-flash"></div>
          <div class="card-badge">${I.check}</div>
          <div class="card-name">${esc(name)}</div>
          <div class="card-status"></div>
        </div>`;
      })
      .join('');
    $('cnt-total').textContent = n;
    $('p-status').textContent = s.tiebreak
      ? 'Desempate entre ' + s.candidates.join(' y ')
      : 'Votación en curso';
    window.Tutorial.setNames(s.participants, s.candidates);
    if (view === 'present') { window.Tutorial.stop(); window.Tutorial.start(); }
    prevVoted = new Set(s.voted);
    wasAllVoted = false;
    updatePresentation(s, false);
  }

  const STATUS = {
    wait: 'esperando<span class="vdots"><span>.</span><span>.</span><span>.</span></span>',
    enter: 'votando<span class="vdots"><span>.</span><span>.</span><span>.</span></span>',
    voted: 'votó',
  };

  function updatePresentation(s, animate) {
    const voted = new Set(s.voted);
    const claimed = new Set(s.claimed);
    let newCount = 0;
    document.querySelectorAll('#grid .card').forEach((card) => {
      const name = card.dataset.name;
      const isV = voted.has(name);
      const isE = !isV && claimed.has(name);
      const st = isV ? 'voted' : isE ? 'enter' : 'wait';
      if (card.dataset.st !== st) {
        card.dataset.st = st;
        card.querySelector('.card-status').innerHTML = STATUS[st];
      }
      card.classList.toggle('is-voted', isV);
      card.classList.toggle('is-entered', isE);
      if (isV && !prevVoted.has(name) && animate) {
        newCount++;
        card.classList.remove('just-voted');
        void card.offsetWidth;
        card.classList.add('just-voted');
        setTimeout(() => card.classList.remove('just-voted'), 900);
        window.Sfx.plim(voted.size - 1);
        const r = card.getBoundingClientRect();
        window.FX.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 46, speed: 8, life: 55, size: 2.6 });
      }
    });
    prevVoted = voted;

    const total = s.participants.length;
    const cnt = $('cnt-voted');
    if (cnt.textContent !== String(voted.size)) {
      cnt.textContent = voted.size;
      if (animate) {
        cnt.classList.remove('bump');
        void cnt.offsetWidth;
        cnt.classList.add('bump');
      }
    }
    $('bar-fill').style.transform = `scaleX(${total ? voted.size / total : 0})`;
    const all = total > 0 && voted.size >= total;
    $('bar').classList.toggle('is-full', all);
    $('v-present').classList.toggle('all-voted', all);
    if (all && !wasAllVoted && animate) {
      setTimeout(() => {
        window.Sfx.cymbal(0.3, 1.8);
        window.Sfx.fanfare();
        const c = toViewport(960, 1010);
        window.FX.burst(c.x, c.y, { count: 120, speed: 12, life: 80 });
      }, 700);
    }
    wasAllVoted = all;
  }

  function onState(s) {
    const prev = S;
    S = s;
    if (s.phase === 'setup') {
      pendingReveal = false;
      builtRound = null;
      if (!names.length && s.participants.length) {
        names = s.participants.slice();
        saveNames();
        renderChips();
      }
      if (!view || view === 'present' || view === 'reveal') showView(prev ? 'setup' : 'splash');
      return;
    }
    if (s.phase === 'votando') {
      if (builtRound !== s.round || view !== 'present') {
        showView('present');
        buildPresentation(s);
      } else {
        updatePresentation(s, true);
      }
      return;
    }
    if (s.phase === 'revelado' && s.results) {
      if (pendingReveal) {
        pendingReveal = false;
        showView('reveal');
        window.Reveal.play(s.results, { year: s.year });
      } else if (view !== 'reveal') {
        showView('reveal');
        window.Reveal.showFinal(s.results);
      }
    }
  }

  socket.on('connect', () => socket.emit('hello', { role: 'admin' }));
  socket.on('state', onState);

  // URL y QR
  fetch('/api/info?origin=' + encodeURIComponent(window.location.origin))
    .then((r) => r.json())
    .then((info) => {
      $('qr').innerHTML = info.qrSvg;
      $('url').textContent = info.displayUrl;
    })
    .catch(() => {});

  // ---- acciones ----
  function startReveal() {
    unlockAudio();
    pendingReveal = true;
    socket.emit('admin:reveal', {}, (res) => { if (!res || !res.ok) pendingReveal = false; });
  }

  const actions = {
    'go-setup'() { unlockAudio(); showView('setup'); },
    start() {
      if (names.length < 3) return setHint('Hacen falta al menos 3 participantes.');
      unlockAudio();
      goFullscreen();
      socket.emit('admin:start', { participants: names }, (res) => { if (res && !res.ok) setHint(res.error); });
    },
    demo() { unlockAudio(); goFullscreen(); socket.emit('admin:demo', { mode: 'normal' }); },
    'demo-tie'() { unlockAudio(); goFullscreen(); socket.emit('admin:demo', { mode: 'empate' }); },
    async 'clear-names'() {
      if (!names.length) return;
      if (await confirmBox('¿Borrar todos los nombres?', 'Vas a tener que cargarlos de nuevo.', 'Borrar')) {
        names = [];
        saveNames();
        renderChips();
        input.focus();
      }
    },
    reveal: startReveal,
    async 'close-voting'() {
      if (!S) return;
      const missing = S.participants.filter((n) => !S.voted.includes(n));
      if (missing.length) {
        const ok = await confirmBox(
          `Faltan votar ${missing.length}`,
          `Todavía no votaron: ${missing.join(', ')}. ¿Cerrar la votación igual y revelar al ganador?`,
          'Cerrar y revelar'
        );
        if (!ok) return;
      }
      startReveal();
    },
    replay() {
      if (S && S.results) { unlockAudio(); window.Reveal.play(S.results, { year: S.year }); }
    },
    skip() {
      if (S && S.results) { window.Reveal.showFinal(S.results); socket.emit('admin:climax'); }
    },
    tiebreak() { unlockAudio(); socket.emit('admin:tiebreak'); },
    async 'new-vote'() {
      if (await confirmBox('¿Nueva votación?', 'Se borran los votos actuales y volvés a la carga de participantes.', 'Nueva votación')) {
        socket.emit('admin:reset');
      }
    },
    async reset() {
      if (await confirmBox('¿Reiniciar todo?', 'Se borran los votos y quién eligió cada nombre. Los celulares vuelven a la pantalla de espera.', 'Reiniciar')) {
        socket.emit('admin:reset');
      }
    },
    mute() { window.Sfx.setMuted(!window.Sfx.isMuted()); paintMute(); },
    fullscreen: toggleFullscreen,
    'unlock-audio'() { unlockAudio(); },
    'modal-ok'() { closeModal(true); },
    'modal-cancel'() { closeModal(false); },
  };

  stage.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    const fn = actions[b.dataset.action];
    if (fn) fn();
  });

  document.addEventListener('keydown', (e) => {
    if ($('modal').classList.contains('is-open')) {
      if (e.key === 'Escape') closeModal(false);
      if (e.key === 'Enter') { e.preventDefault(); closeModal(true); }
      return;
    }
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    if (e.key === 'm' || e.key === 'M') actions.mute();
  });
})();
