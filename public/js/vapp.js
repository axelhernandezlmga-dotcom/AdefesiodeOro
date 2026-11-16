// Plantillas de las pantallas del votante. Las usa el celular real (votar.js)
// y el tutorial animado de la tele (tutorial.js), asi se ven identicas.
(function () {
  const I = window.ICONS;
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function nameBtn(name, { taken = false, mine = false, selected = false } = {}) {
    const cls = ['vname', taken && !mine ? 'is-taken' : '', mine ? 'is-mine' : '', selected ? 'is-selected' : '']
      .filter(Boolean)
      .join(' ');
    const tag = taken && !mine ? '<span class="vname-tag">ya entró</span>' : `<span class="vname-check">${I.check}</span>`;
    return `<button type="button" class="${cls}" data-name="${esc(name)}" ${taken && !mine ? 'disabled' : ''}><span>${esc(name)}</span>${tag}</button>`;
  }

  function trophy() {
    return '<div class="vtrophy"><img src="/trofeo.png" alt="Trofeo El Adefesio de Oro" draggable="false"></div>';
  }

  const confetti = () => {
    const colors = ['#f6dc84', '#d4a82a', '#c9ced8', '#ffffff', '#b88913'];
    let out = '';
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.3;
      const d = 120 + Math.random() * 120;
      out += `<i style="background:${colors[i % colors.length]};--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d + 140)}px;--rot:${Math.round(Math.random() * 720 - 360)}deg;animation-delay:${(0.25 + Math.random() * 0.15).toFixed(2)}s"></i>`;
    }
    return `<div class="vconfetti">${out}</div>`;
  };

  const screens = {
    waiting: () => `
      <section class="vscreen vscreen--waiting" data-screen="waiting">
        <div class="vcenter">
          ${trophy()}
          <div class="vbrand">El Adefesio de Oro</div>
          <p class="vlead">Esperando a que empiece la votación<span class="vdots"><span>.</span><span>.</span><span>.</span></span></p>
          <p class="vnote">Dejá esta pantalla abierta, arranca sola.</p>
        </div>
      </section>`,

    welcome: () => `
      <section class="vscreen vscreen--welcome" data-screen="welcome">
        <div class="vcenter">
          ${trophy()}
          <div class="vbrand">El Adefesio de Oro</div>
          <p class="vlead">¡La votación está abierta!</p>
          <p class="vnote" data-slot="welcome-note">Premio al peor regalo de la familia</p>
        </div>
        <div class="vfooter">
          <button type="button" class="vbtn" data-action="enter">Entrar a votar ${I.arrowRight}</button>
        </div>
      </section>`,

    who: (names = []) => `
      <section class="vscreen vscreen--who" data-screen="who">
        <header class="vhead">
          <div class="vkicker">Paso 1 de 2</div>
          <h1 class="vtitle">¿Quién sos?</h1>
          <p class="vsub">Tocá tu nombre</p>
        </header>
        <div class="vlist" data-slot="who-list">${names.map((n) => nameBtn(n)).join('')}</div>
        <div class="vconfirm" data-slot="confirm">
          <div class="vconfirm-card">
            <p class="vconfirm-q">¿Sos <b data-slot="confirm-name"></b>?</p>
            <div class="vconfirm-actions">
              <button type="button" class="vbtn vbtn--ghost" data-action="confirm-no">No</button>
              <button type="button" class="vbtn" data-action="confirm-yes">Sí, soy yo</button>
            </div>
          </div>
        </div>
      </section>`,

    vote: (names = []) => `
      <section class="vscreen vscreen--vote" data-screen="vote">
        <header class="vhead">
          <div class="vkicker" data-slot="vote-kicker">Paso 2 de 2</div>
          <h1 class="vtitle">¿Quién hizo el peor regalo?</h1>
          <p class="vsub" data-slot="vote-sub">Elegí a una persona. No te podés votar a vos.</p>
        </header>
        <div class="vlist" data-slot="vote-list">${names.map((n) => nameBtn(n)).join('')}</div>
        <div class="vfooter">
          <button type="button" class="vbtn" data-action="send" disabled>Enviar voto</button>
          <div style="text-align:center"><button type="button" class="vlink" data-action="not-me" data-slot="not-me"></button></div>
        </div>
      </section>`,

    sent: () => `
      <section class="vscreen vscreen--sent" data-screen="sent">
        ${confetti()}
        <div class="vcenter">
          <div class="vcheck">${I.check}</div>
          <div class="vbrand">¡Voto enviado!</div>
          <p class="vlead">Gracias por votar</p>
          <p class="vnote">Ahora mirá la tele.</p>
        </div>
      </section>`,

    suspense: () => `
      <section class="vscreen vscreen--suspense" data-screen="suspense">
        <div class="vcenter">
          ${trophy()}
          <div class="vbrand">¡Llegó el momento!</div>
          <p class="vlead">Mirá la tele<span class="vdots"><span>.</span><span>.</span><span>.</span></span></p>
        </div>
      </section>`,

    winner: () => `
      <section class="vscreen vscreen--winner" data-screen="winner">
        <div class="vcenter" style="overflow-y:auto;overflow-x:hidden;justify-content:flex-start;padding-top:12px">
          ${trophy()}
          <p class="vlead" data-slot="winner-lead">El Adefesio de Oro es para...</p>
          <div class="vwinner-name" data-slot="winner-name"></div>
          <p class="vnote" data-slot="winner-votes"></p>
          <div class="vresults" data-slot="winner-table"></div>
        </div>
      </section>`,
  };

  window.VApp = { esc, nameBtn, screens };
})();
