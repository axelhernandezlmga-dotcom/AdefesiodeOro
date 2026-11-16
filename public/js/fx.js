// Efectos en canvas: particulas doradas de fondo, confeti, fuegos artificiales y destellos.
window.FX = (function () {
  const GOLDS = ['#f6dc84', '#d4a82a', '#ffe9a8', '#b88913', '#fff6d6'];
  const CONFETTI = ['#f6dc84', '#d4a82a', '#b88913', '#e8ecf3', '#c9ced8', '#9aa3b2', '#fff3c4'];

  const bg = document.createElement('canvas');
  const fx = document.createElement('canvas');
  bg.className = 'fx-canvas fx-bg';
  fx.className = 'fx-canvas fx-front';
  const bctx = bg.getContext('2d');
  const fctx = fx.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    for (const c of [bg, fx]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    }
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // sprite de brillo
  function makeGlow(color) {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, '#fffbe8');
    grd.addColorStop(0.2, color);
    grd.addColorStop(0.55, color + '55');
    grd.addColorStop(1, color + '00');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return s;
  }
  const glowGold = makeGlow('#e8bf4a');
  const glowSilver = makeGlow('#d6dbe6');

  // ---- fondo: polvo dorado flotando ----
  const dust = [];
  function seedDust() {
    dust.length = 0;
    const n = Math.round(Math.min(90, (W * H) / 26000));
    for (let i = 0; i < n; i++) dust.push(newDust(true));
  }
  function newDust(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 20,
      r: 2 + Math.random() * 7,
      vy: -(0.08 + Math.random() * 0.35),
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.002 + Math.random() * 0.006,
      a: 0.15 + Math.random() * 0.5,
      tw: Math.random() * Math.PI * 2,
    };
  }
  let bgEnabled = true;
  let bgIntensity = 1;

  // ---- frente ----
  const parts = [];
  const rockets = [];
  let confettiUntil = 0;
  let confettiRate = 0;

  function burst(x, y, { count = 40, speed = 6, colors = GOLDS, life = 70, gravity = 0.12, size = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      parts.push({
        kind: 'spark', x, y, px: x, py: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.6), age: 0,
        color: colors[(Math.random() * colors.length) | 0],
        size: size * (0.6 + Math.random() * 0.8), gravity, drag: 0.965,
        glow: Math.random() < 0.5 ? glowGold : glowSilver,
      });
    }
    start();
  }

  function confettiPiece(x, y, vx, vy) {
    parts.push({
      kind: 'confetti', x, y, vx, vy,
      w: 8 + Math.random() * 10, h: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 0.25,
      flip: Math.random() * Math.PI * 2, vflip: 0.08 + Math.random() * 0.15,
      sway: Math.random() * Math.PI * 2,
      color: CONFETTI[(Math.random() * CONFETTI.length) | 0],
      life: 600, age: 0,
    });
  }

  function confetti(durationMs = 6000, rate = 6) {
    confettiUntil = performance.now() + durationMs;
    confettiRate = rate;
    start();
  }

  function cannon(x, y, angle, count = 80, power = 18) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * 0.7;
      const s = power * (0.45 + Math.random() * 0.6);
      confettiPiece(x, y, Math.cos(a) * s, Math.sin(a) * s);
    }
    start();
  }

  function firework(x, y) {
    rockets.push({ x, y: H + 10, tx: x, ty: y, vy: -(H - y) / 38, px: x, py: H + 10 });
    start();
  }

  function fountain(x, y, ms = 3000, perFrame = 2) {
    const until = performance.now() + ms;
    fountains.push({ x, y, until, perFrame });
    start();
  }
  const fountains = [];

  function clear() {
    parts.length = 0;
    rockets.length = 0;
    fountains.length = 0;
    confettiUntil = 0;
  }

  // ---- loop ----
  let running = false;
  let last = performance.now();
  function start() {
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    const dt = Math.min(2.5, (now - last) / 16.67);
    last = now;

    // fondo
    bctx.clearRect(0, 0, W, H);
    if (bgEnabled) {
      bctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < dust.length; i++) {
        const p = dust[i];
        p.y += p.vy * dt;
        p.sway += p.swaySpeed * dt;
        p.tw += 0.02 * dt;
        const x = p.x + Math.sin(p.sway) * 18;
        if (p.y < -20) dust[i] = newDust(false);
        bctx.globalAlpha = p.a * bgIntensity * (0.65 + 0.35 * Math.sin(p.tw));
        const s = p.r * 4;
        bctx.drawImage(glowGold, x - s / 2, p.y - s / 2, s, s);
      }
      bctx.globalAlpha = 1;
      bctx.globalCompositeOperation = 'source-over';
    }

    // frente
    fctx.clearRect(0, 0, W, H);
    if (now < confettiUntil) {
      const n = confettiRate * dt;
      for (let i = 0; i < n; i++) confettiPiece(Math.random() * W, -20, (Math.random() - 0.5) * 2, 2 + Math.random() * 3);
    }
    for (const f of fountains) {
      if (now > f.until) continue;
      for (let i = 0; i < f.perFrame; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const s = 3 + Math.random() * 5;
        parts.push({
          kind: 'spark', x: f.x + (Math.random() - 0.5) * 60, y: f.y, px: f.x, py: f.y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 60 + Math.random() * 50, age: 0,
          color: GOLDS[(Math.random() * GOLDS.length) | 0], size: 2 + Math.random() * 2.5,
          gravity: 0.06, drag: 0.98, glow: glowGold,
        });
      }
    }
    for (let i = fountains.length - 1; i >= 0; i--) if (now > fountains[i].until) fountains.splice(i, 1);

    // cohetes
    fctx.globalCompositeOperation = 'lighter';
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.px = r.x; r.py = r.y;
      r.y += r.vy * dt;
      r.vy *= 0.985;
      fctx.strokeStyle = 'rgba(255,230,160,0.9)';
      fctx.lineWidth = 3;
      fctx.beginPath();
      fctx.moveTo(r.px, r.py + 18);
      fctx.lineTo(r.x, r.y);
      fctx.stroke();
      if (r.y <= r.ty || r.vy > -2) {
        rockets.splice(i, 1);
        const colors = Math.random() < 0.5 ? GOLDS : ['#e8ecf3', '#c9ced8', '#fff', '#f6dc84'];
        burst(r.x, r.y, { count: 110, speed: 9, colors, life: 80, gravity: 0.07, size: 2.6 });
        if (window.Sfx) window.Sfx.pop();
      }
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.kind === 'spark') {
        p.px = p.x; p.py = p.y;
        p.vx *= Math.pow(p.drag, dt);
        p.vy = p.vy * Math.pow(p.drag, dt) + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = 1 - p.age / p.life;
        if (k <= 0) { parts.splice(i, 1); continue; }
        fctx.globalAlpha = Math.min(1, k * 1.4);
        fctx.strokeStyle = p.color;
        fctx.lineWidth = p.size * k + 0.5;
        fctx.beginPath();
        fctx.moveTo(p.px - p.vx * 1.5, p.py - p.vy * 1.5);
        fctx.lineTo(p.x, p.y);
        fctx.stroke();
        const s = p.size * 6 * k;
        fctx.drawImage(p.glow, p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    fctx.globalCompositeOperation = 'source-over';
    fctx.globalAlpha = 1;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.kind !== 'confetti') continue;
      p.vx *= Math.pow(0.985, dt);
      p.vy = Math.min(p.vy * Math.pow(0.985, dt) + 0.22 * dt, 5.5);
      p.sway += 0.05 * dt;
      p.x += (p.vx + Math.sin(p.sway) * 0.9) * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      p.flip += p.vflip * dt;
      if (p.y > H + 40 || p.age > p.life) { parts.splice(i, 1); continue; }
      const c = Math.cos(p.flip);
      fctx.save();
      fctx.translate(p.x, p.y);
      fctx.rotate(p.rot);
      fctx.scale(1, c);
      fctx.fillStyle = p.color;
      fctx.globalAlpha = 0.75 + 0.25 * Math.abs(c);
      fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      fctx.restore();
    }

    if (bgEnabled || parts.length || rockets.length || now < confettiUntil || fountains.length) {
      requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function mount(parent = document.body) {
    parent.prepend(bg);
    parent.appendChild(fx);
    resize();
    seedDust();
    start();
    window.addEventListener('resize', () => { resize(); seedDust(); });
  }

  return {
    mount, burst, confetti, cannon, firework, fountain, clear,
    setBackground(on, intensity = 1) { bgEnabled = on; bgIntensity = intensity; if (on) start(); },
    size: () => ({ W, H }),
  };
})();
