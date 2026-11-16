// Secuencia cinematografica de revelacion del ganador.
window.Reveal = (function () {
  const $ = (id) => document.getElementById(id);
  const view = $('v-reveal');
  const drama = $('r-drama');
  const rank = $('r-rank');
  const trophy = $('r-trophy');
  const shine = $('r-shine');
  const rays = $('r-rays');
  const spot = $('r-spot');
  const pool = $('r-pool');
  const kicker = $('r-kicker');
  const nameEl = $('r-name');
  const votesEl = $('r-votes');
  const table = $('r-table');
  const flash = $('r-flash');
  const esc = window.VApp.esc;

  let run = 0;
  let stopRoll = () => {};
  let timers = [];
  let opts = { toViewport: (x, y) => ({ x, y }), onClimax() {}, onFinal() {} };

  const sleep = (ms, id) =>
    new Promise((res, rej) => {
      const t = setTimeout(() => (id === run ? res() : rej(new Error('cancel'))), ms);
      timers.push(t);
    });
  const votesTxt = (n) => (n === 1 ? '1 voto' : n + ' votos');
  const joinNames = (arr) => (arr.length === 1 ? arr[0] : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1]);
  const ordinal = (p) => (p === 2 ? 'Segundo puesto' : p === 3 ? 'Tercer puesto' : p + '.º puesto');

  function groups(R) {
    const out = [];
    for (const r of R.ranking) {
      const g = out[out.length - 1];
      if (g && g.place === r.place) g.names.push(r.name);
      else out.push({ place: r.place, votes: r.votes, names: [r.name] });
    }
    return out;
  }

  function fitText(el, maxW, basePx, varName) {
    el.style.setProperty(varName, basePx + 'px');
    const w = el.scrollWidth;
    if (w > maxW) el.style.setProperty(varName, Math.floor((basePx * maxW) / w) + 'px');
  }

  function fill(R) {
    const tie = R.tie;
    view.classList.toggle('is-tie', tie);
    kicker.textContent = tie ? '¡Empate!' : R.tiebreak ? 'Ganador del desempate' : '';
    nameEl.textContent = tie ? joinNames(R.winners) : R.winners[0];
    votesEl.textContent = tie ? `con ${votesTxt(R.top)} cada uno` : `con ${votesTxt(R.top)}`;
    fitText(nameEl, 1700, tie ? 170 : 210, '--name-fs');

    const n = R.ranking.length;
    const rowH = Math.min(62, Math.floor((590 - (n - 1) * 10) / n));
    table.style.setProperty('--row-h', rowH + 'px');
    table.style.setProperty('--row-fs', Math.max(16, Math.round(rowH * 0.5)) + 'px');
    const max = Math.max(1, R.top);
    table.innerHTML = R.ranking
      .map(
        (r) => `<div class="r-row ${r.place === 1 ? 'win' : ''}">
          <span class="pl">${r.place}</span><span class="nm">${esc(r.name)}</span>
          <span class="bar"><i style="transform:scaleX(${(r.votes / max).toFixed(3)})"></i></span>
          <span class="vt">${r.votes}</span></div>`
      )
      .join('');
  }

  function clearVisuals() {
    timers.forEach(clearTimeout);
    timers = [];
    view.classList.remove('is-final');
    drama.className = 'r-drama';
    drama.innerHTML = '';
    rank.innerHTML = '';
    trophy.getAnimations().forEach((a) => a.cancel());
    trophy.classList.remove('idle');
    trophy.style.opacity = '';
    shine.classList.remove('go');
    rays.style.opacity = '';
    rays.style.transform = '';
    spot.style.opacity = '';
    pool.style.opacity = '';
    kicker.classList.remove('on');
    nameEl.classList.remove('on', 'static');
    votesEl.classList.remove('on');
    flash.classList.remove('go');
  }

  function showStage(on) {
    rays.style.opacity = on ? '1' : '';
    rays.style.transform = on ? 'scale(1)' : '';
    spot.style.opacity = on ? '1' : '';
    pool.style.opacity = on ? '1' : '';
  }

  function typeText(html, id, perChar) {
    // html con marcadores [g]...[/g] para dorado y | para salto de linea
    drama.innerHTML = '';
    let gold = false;
    const spans = [];
    const tokens = html.split(/(\[g\]|\[\/g\]|\|)/).filter(Boolean);
    for (const tk of tokens) {
      if (tk === '[g]') { gold = true; continue; }
      if (tk === '[/g]') { gold = false; continue; }
      if (tk === '|') { drama.appendChild(document.createElement('br')); continue; }
      for (const ch of tk) {
        const s = document.createElement('span');
        s.textContent = ch;
        if (gold) s.className = 'g';
        drama.appendChild(s);
        spans.push(s);
      }
    }
    return spans.reduce((p, s) => p.then(() => { s.classList.add('on'); return sleep(perChar, id); }), Promise.resolve());
  }

  async function showRank(g, id, ms, second) {
    const card = document.createElement('div');
    card.className = 'r-rank-card' + (second ? ' second' : '');
    card.innerHTML = `<div class="r-rank-place">${ordinal(g.place)}</div>
      <div class="r-rank-name" style="--fs:170px">${esc(joinNames(g.names))}</div>
      <div class="r-rank-votes">${votesTxt(g.votes)}${g.names.length > 1 ? ' cada uno' : ''}</div>`;
    rank.appendChild(card);
    const nm = card.querySelector('.r-rank-name');
    const w = nm.scrollWidth;
    if (w > 1700) nm.style.fontSize = Math.floor((170 * 1700) / w) + 'px';
    void card.offsetWidth;
    card.classList.add('in');
    window.Sfx.whoosh(second ? 0.35 : 0.22, second ? 0.8 : 0.45);
    if (second) setTimeout(() => window.Sfx.boom(0.5), 150);
    await sleep(ms - 300, id);
    card.classList.add('out');
    await sleep(300, id);
    card.remove();
  }

  function vp(x, y) {
    return opts.toViewport(x, y);
  }

  function celebrate(id, R) {
    const c = vp(960, 760);
    window.FX.burst(c.x, c.y, { count: 180, speed: 16, life: 95, size: 3.4 });
    const t = vp(960, 360);
    window.FX.fountain(t.x, t.y + 120, 5000, 3);
    const bl = vp(0, 1080);
    const br = vp(1920, 1080);
    window.FX.cannon(bl.x, bl.y, -Math.PI / 3, 140, 30);
    window.FX.cannon(br.x, br.y, (-2 * Math.PI) / 3, 140, 30);
    window.FX.confetti(R.tie ? 5000 : 9000, R.tie ? 3 : 6);
    const spots = [[240, 260], [1680, 230], [380, 180], [1540, 330], [180, 380], [1760, 160], [300, 300], [1620, 260]];
    spots.forEach(([x, y], i) => {
      timers.push(setTimeout(() => {
        if (id !== run) return;
        const p = vp(x, y);
        window.FX.firework(p.x, p.y);
      }, 600 + i * 750));
    });
  }

  async function play(R, { year } = {}) {
    const id = ++run;
    stopRoll();
    clearVisuals();
    fill(R);
    window.FX.clear();
    window.FX.setBackground(false);
    document.body.classList.add('is-dark', 'is-revealing');

    const all = groups(R);
    const below = all.slice(1);
    const second = below[0] || null;
    const rest = below.slice(1).reverse();
    const per = rest.length ? Math.max(750, Math.min(1100, 5600 / rest.length)) : 0;
    const text = `Y el [g]Adefesio de Oro ${year || new Date().getFullYear()}[/g]|es para...`;
    const typeMs = 52;
    const chars = text.replace(/\[\/?g\]|\|/g, '').length;
    // tiempo hasta el nombre (para que el redoble termine justo ahi)
    const plan = 1500 + chars * typeMs + 1300 + 900 + rest.length * per + (second ? 3000 : 0) + 3300 + 900;

    try {
      await sleep(700, id);
      stopRoll = window.Sfx.drumroll((plan - 700) / 1000 + 1.5);
      window.Sfx.drone(5.5);
      await sleep(800, id);

      // 1. texto dramatico
      await typeText(text, id, typeMs);
      await sleep(1300, id);
      drama.classList.add('is-up');
      await sleep(900, id);

      // 2. ranking del ultimo al segundo
      for (const g of rest) await showRank(g, id, per, false);
      if (second) await showRank(second, id, 3000, true);

      // 3. entrada del trofeo
      drama.classList.add('is-gone');
      spot.style.opacity = '1';
      await sleep(300, id);
      trophy.animate(
        [
          { opacity: 0, transform: 'translateY(80px) scale(0.78) rotateY(-32deg) rotateX(10deg)', filter: 'brightness(0)' },
          { opacity: 1, offset: 0.3, filter: 'brightness(0.25)' },
          { opacity: 1, transform: 'translateY(-6px) scale(1.03) rotateY(10deg) rotateX(-2deg)', filter: 'brightness(1.15)', offset: 0.78 },
          { opacity: 1, transform: 'translateY(0) scale(1) rotateY(0deg) rotateX(0deg)', filter: 'brightness(1)' },
        ],
        { duration: 2800, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' }
      );
      await sleep(700, id);
      showStage(true);
      const tp = vp(960, 640);
      window.FX.fountain(tp.x, tp.y, 2200, 1);
      await sleep(1700, id);
      shine.classList.add('go');
      await sleep(600, id);
      trophy.classList.add('idle');

      // 4. silencio de suspenso
      await sleep(900, id);

      // 5. el nombre
      stopRoll();
      window.Sfx.cymbal(0.7, 3.2);
      window.Sfx.boom(1);
      window.Sfx.fanfare();
      flash.classList.add('go');
      if (kicker.textContent) kicker.classList.add('on');
      nameEl.classList.add('on');
      opts.onClimax();
      celebrate(id, R);
      await sleep(1300, id);
      votesEl.classList.add('on');

      // 6. celebracion y pantalla final
      await sleep(6500, id);
      toFinal();
    } catch (e) {
      /* cancelado */
    }
  }

  function toFinal() {
    view.classList.add('is-final');
    document.body.classList.remove('is-dark', 'is-revealing');
    window.FX.setBackground(true, 0.8);
    opts.onFinal();
  }

  function showFinal(R) {
    run++;
    stopRoll();
    clearVisuals();
    fill(R);
    trophy.style.opacity = '1';
    trophy.classList.add('idle');
    showStage(true);
    if (kicker.textContent) kicker.classList.add('on');
    nameEl.classList.add('static');
    votesEl.classList.add('on');
    toFinal();
  }

  function cancel() {
    run++;
    stopRoll();
    timers.forEach(clearTimeout);
    document.body.classList.remove('is-dark', 'is-revealing');
  }

  return {
    init(o) { opts = { ...opts, ...o }; },
    play,
    showFinal,
    cancel,
  };
})();
