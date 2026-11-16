// Tutorial animado: dos celulares que reproducen las pantallas reales de votacion.
window.Tutorial = (function () {
  const { screens } = window.VApp;
  let root, p1, p2, names = [], candidates = [];
  let runId = 0;
  let cycleN = 0;

  function phone(step, text) {
    return `
      <div class="tut is-dim">
        <div class="tut-label"><span class="tut-step">Paso ${step}</span><div class="tut-text">${text}</div></div>
        <div class="phone"><div class="phone-screen"><div class="phone-island"></div>
          <div class="phone-scale"><div class="vapp"><div class="finger"><i></i></div></div></div>
        </div></div>
      </div>`;
  }

  function mount(el) {
    root = el;
    root.innerHTML = phone(1, '¿Quién sos?') + phone(2, 'Votá al peor regalo');
    const tuts = root.querySelectorAll('.tut');
    p1 = { tut: tuts[0], app: tuts[0].querySelector('.vapp') };
    p2 = { tut: tuts[1], app: tuts[1].querySelector('.vapp') };
    p1.finger = p1.app.querySelector('.finger');
    p2.finger = p2.app.querySelector('.finger');
  }

  function setNames(all, cands) {
    names = all.slice();
    candidates = (cands || all).slice();
  }

  // posicion de un elemento relativa al .vapp (sin escalas)
  function centerOf(el, rootEl) {
    let x = el.offsetWidth / 2;
    let y = el.offsetHeight / 2;
    let n = el;
    while (n && n !== rootEl) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { x, y };
  }

  const sleep = (ms, id) =>
    new Promise((res, rej) => setTimeout(() => (id === runId ? res() : rej(new Error('stop'))), ms));

  function moveFinger(P, to, ms) {
    const from = P.pos || { x: 195, y: 900 };
    P.pos = to;
    return P.finger.animate(
      [{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${to.x}px, ${to.y}px)` }],
      { duration: ms, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' }
    ).finished.catch(() => {});
  }
  function showFinger(P, on, at) {
    if (at) {
      P.pos = at;
      P.finger.animate([{ transform: `translate(${at.x}px, ${at.y}px)` }], { duration: 0, fill: 'forwards' });
    }
    P.finger.animate([{ opacity: on ? 1 : 0 }], { duration: 250, fill: 'forwards' });
  }
  function tap(P, target) {
    P.finger.firstElementChild.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(0.78)' }, { transform: 'scale(1)' }],
      { duration: 320, easing: 'ease-out' }
    );
    if (target) {
      const dot = document.createElement('span');
      dot.className = 'vripple';
      dot.style.left = target.offsetWidth / 2 + 'px';
      dot.style.top = target.offsetHeight / 2 + 'px';
      target.appendChild(dot);
      setTimeout(() => dot.remove(), 650);
    }
  }
  function activate(P, name) {
    P.app.querySelectorAll('.vscreen').forEach((s) => s.classList.toggle('is-active', s.dataset.screen === name));
  }
  const pick = (arr, n, k) => arr[k % Math.max(1, Math.min(n, arr.length))];

  async function cycle(id) {
    if (names.length < 2) return sleep(500, id);
    const visible = Math.min(names.length, 5);
    const me = pick(names, visible, cycleN * 3 + 1);
    const opts = candidates.filter((n) => n !== me);
    const other = pick(opts, Math.min(opts.length, 4), cycleN * 2);
    cycleN++;

    // --- preparar pantallas ---
    p1.app.querySelectorAll('.vscreen').forEach((s) => s.remove());
    p2.app.querySelectorAll('.vscreen').forEach((s) => s.remove());
    p1.app.insertAdjacentHTML('afterbegin', screens.who(names));
    p2.app.insertAdjacentHTML('afterbegin', screens.vote(opts) + screens.sent());
    activate(p1, 'who');
    activate(p2, 'vote');
    const notMe = p2.app.querySelector('[data-slot="not-me"]');
    if (notMe) notMe.textContent = 'No soy ' + me;
    p1.tut.classList.remove('is-dim');
    p2.tut.classList.add('is-dim');
    showFinger(p1, false, { x: 230, y: 860 });
    showFinger(p2, false, { x: 230, y: 860 });

    // --- Paso 1: elegir quien sos ---
    await sleep(500, id);
    showFinger(p1, true);
    const meBtn = p1.app.querySelector(`.vname[data-name="${CSS.escape(me)}"]`);
    await moveFinger(p1, centerOf(meBtn, p1.app), 900);
    if (id !== runId) return;
    tap(p1, meBtn);
    meBtn.classList.add('is-selected');
    await sleep(450, id);
    const conf = p1.app.querySelector('.vconfirm');
    conf.querySelector('[data-slot="confirm-name"]').textContent = me;
    conf.classList.add('is-open');
    await sleep(650, id);
    const yes = conf.querySelector('[data-action="confirm-yes"]');
    await moveFinger(p1, centerOf(yes, p1.app), 600);
    if (id !== runId) return;
    tap(p1, yes);
    await sleep(350, id);
    conf.classList.remove('is-open');
    showFinger(p1, false);
    await sleep(300, id);

    // --- Paso 2: votar ---
    p1.tut.classList.add('is-dim');
    p2.tut.classList.remove('is-dim');
    await sleep(450, id);
    showFinger(p2, true);
    const otherBtn = p2.app.querySelector(`.vname[data-name="${CSS.escape(other)}"]`);
    await moveFinger(p2, centerOf(otherBtn, p2.app), 850);
    if (id !== runId) return;
    tap(p2, otherBtn);
    otherBtn.classList.add('is-selected');
    const send = p2.app.querySelector('[data-action="send"]');
    send.disabled = false;
    await sleep(450, id);
    await moveFinger(p2, centerOf(send, p2.app), 650);
    if (id !== runId) return;
    tap(p2, send);
    await sleep(280, id);
    showFinger(p2, false);
    activate(p2, 'sent');
    await sleep(2600, id);
    await sleep(500, id);
  }

  async function loop(id) {
    while (id === runId) {
      try {
        await cycle(id);
      } catch (e) {
        if (id !== runId) return;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  return {
    mount,
    setNames,
    start() {
      runId++;
      loop(runId);
    },
    stop() {
      runId++;
    },
  };
})();
