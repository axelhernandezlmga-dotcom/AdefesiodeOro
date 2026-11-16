// Vista del votante (celular)
(function () {
  const { screens, nameBtn, esc } = window.VApp;
  const app = document.getElementById('app');

  // deviceId persistente para recuperar el nombre si se recarga o se bloquea el celular
  let deviceId = null;
  try { deviceId = localStorage.getItem('adefesio.deviceId'); } catch (e) {}
  if (!deviceId) {
    deviceId = 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem('adefesio.deviceId', deviceId); } catch (e) {}
  }

  app.innerHTML =
    screens.waiting() + screens.welcome() + screens.who() + screens.vote() +
    screens.sent() + screens.suspense() + screens.winner() +
    '<div class="vtoast" data-slot="toast"></div><div class="vconn" data-slot="conn">Reconectando...</div>';

  const $ = (slot) => app.querySelector(`[data-slot="${slot}"]`);
  const screenEls = {};
  app.querySelectorAll('.vscreen').forEach((el) => (screenEls[el.dataset.screen] = el));

  let S = null; // estado publico del servidor
  let myName = null;
  let entered = false; // toco "Entrar a votar"
  let pending = null; // nombre a confirmar
  let selected = null; // candidato elegido
  let lastRound = null;
  let busy = false;
  let current = null;

  function show(name) {
    if (current === name) return;
    current = name;
    for (const [k, el] of Object.entries(screenEls)) el.classList.toggle('is-active', k === name);
    // reiniciar animaciones de la pantalla de enviado
    if (name === 'sent') {
      const el = screenEls.sent;
      el.classList.remove('is-active');
      void el.offsetWidth;
      el.classList.add('is-active');
    }
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-open'), 3200);
  }

  function setConfirm(name) {
    pending = name;
    if (name) $('confirm-name').textContent = name;
    $('confirm').classList.toggle('is-open', !!name);
  }

  function renderWho() {
    const list = $('who-list');
    const scroll = list.scrollTop;
    list.innerHTML = S.participants
      .map((n) => nameBtn(n, { taken: S.claimed.includes(n), mine: n === myName, selected: n === pending }))
      .join('');
    list.scrollTop = scroll;
  }

  function renderVote() {
    const opts = S.candidates.filter((n) => n !== myName);
    if (selected && !opts.includes(selected)) selected = null;
    const list = $('vote-list');
    const scroll = list.scrollTop;
    list.innerHTML = opts.map((n) => nameBtn(n, { selected: n === selected })).join('');
    list.scrollTop = scroll;
    app.querySelector('[data-action="send"]').disabled = !selected || busy;
    $('not-me').textContent = myName ? `No soy ${myName}` : '';
    if (S.tiebreak) {
      $('vote-kicker').textContent = 'Desempate';
      $('vote-sub').textContent = 'Votá de nuevo, solo entre los empatados.';
    } else {
      $('vote-kicker').textContent = 'Paso 2 de 2';
      $('vote-sub').textContent = 'Elegí a una persona. No te podés votar a vos.';
    }
  }

  function renderWinner() {
    const r = S.results;
    const tie = r.tie;
    $('winner-lead').textContent = tie ? '¡Empate!' : 'El Adefesio de Oro es para...';
    $('winner-name').textContent = tie ? r.winners.join(' y ') : '¡' + r.winners[0] + '!';
    const v = r.top === 1 ? '1 voto' : r.top + ' votos';
    $('winner-votes').textContent = tie ? `con ${v} cada uno. Mirá la tele para el desempate.` : `con ${v}`;
    $('winner-table').innerHTML = r.ranking
      .map((x) => `<div><span>${x.place}. ${esc(x.name)}</span><span>${x.votes}</span></div>`)
      .join('');
  }

  function render() {
    if (!S) return show('waiting');
    if (S.round !== lastRound) {
      lastRound = S.round;
      selected = null;
    }

    if (S.phase === 'setup') {
      entered = false;
      setConfirm(null);
      return show('waiting');
    }
    if (S.phase === 'revelado') {
      setConfirm(null);
      if (!S.climax || !S.results) return show('suspense');
      renderWinner();
      return show('winner');
    }
    // votando
    if (myName && S.voted.includes(myName)) return show('sent');
    if (myName) {
      setConfirm(null);
      renderVote();
      return show('vote');
    }
    if (pending && S.claimed.includes(pending)) {
      setConfirm(null);
      toast('Ese nombre ya fue elegido');
    }
    renderWho();
    $('welcome-note').textContent = S.tiebreak ? 'Desempate: hay que votar de nuevo' : 'Premio al peor regalo de la familia';
    show(entered ? 'who' : 'welcome');
  }

  // ---- interaccion ----
  function ripple(btn, e) {
    const r = btn.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'vripple';
    dot.style.left = (e.clientX || r.left + r.width / 2) - r.left + 'px';
    dot.style.top = (e.clientY || r.top + r.height / 2) - r.top + 'px';
    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  }

  app.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;

    if (btn.classList.contains('vname')) {
      ripple(btn, e);
      const name = btn.dataset.name;
      if (current === 'who') {
        setConfirm(name);
        renderWho();
      } else if (current === 'vote') {
        selected = name;
        renderVote();
      }
      return;
    }

    if (action === 'enter') {
      entered = true;
      render();
    } else if (action === 'confirm-no') {
      setConfirm(null);
      renderWho();
    } else if (action === 'confirm-yes') {
      const name = pending;
      if (!name || busy) return;
      busy = true;
      socket.emit('claim', { deviceId, name }, (res) => {
        busy = false;
        setConfirm(null);
        if (!res || !res.ok) {
          toast((res && res.error) || 'No se pudo, probá de nuevo.');
        } else {
          myName = res.name;
        }
        render();
      });
    } else if (action === 'send') {
      if (!selected || busy) return;
      busy = true;
      btn.disabled = true;
      socket.emit('vote', { deviceId, candidate: selected }, (res) => {
        busy = false;
        if (!res || !res.ok) toast((res && res.error) || 'No se pudo enviar, probá de nuevo.');
        render();
      });
    } else if (action === 'not-me') {
      socket.emit('unclaim', { deviceId }, () => {
        myName = null;
        selected = null;
        entered = true;
        render();
      });
    }
  });

  // ---- socket ----
  const socket = io({ reconnectionDelayMax: 2000 });
  socket.on('connect', () => {
    $('conn').classList.remove('is-on');
    socket.emit('hello', { role: 'voter', deviceId });
  });
  socket.on('disconnect', () => $('conn').classList.add('is-on'));
  socket.on('me', ({ name }) => {
    myName = name;
    if (name) entered = true;
    render();
  });
  socket.on('state', (s) => {
    // si el servidor libero mi nombre (reinicio), lo olvido
    if (myName && (s.phase === 'setup' || (S && S.claimed.includes(myName) && !s.claimed.includes(myName)))) {
      myName = null;
    }
    S = s;
    render();
  });

  // al volver de la pantalla bloqueada, pedir el estado fresco
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!socket.connected) socket.connect();
      else socket.emit('hello', { role: 'voter', deviceId });
    }
  });

  show('waiting');
})();
