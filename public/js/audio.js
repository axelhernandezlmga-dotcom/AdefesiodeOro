// Sonidos sintetizados con Web Audio API (sin archivos de audio)
window.Sfx = (function () {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('adefesio.muted') === '1'; } catch (e) {}

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  const ready = () => ctx && ctx.state === 'running';

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('adefesio.muted', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  }

  function noise(dest, t, dur) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur);
    return src;
  }
  function env(g, t, a, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }
  const hz = (semi, base = 440) => base * Math.pow(2, semi / 12);

  // "Plim" cuando alguien vota: campanita que sube un poco cada vez
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
  function plim(i = 0) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    const f = hz(SCALE[Math.min(i, SCALE.length - 1)], 659.25);
    [[1, 0.32, 1.4], [2, 0.08, 0.6], [3.01, 0.05, 0.35], [4.2, 0.025, 0.2]].forEach(([mult, peak, dec]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      env(g, t, 0.004, peak, dec);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dec + 0.1);
    });
    // eco suave
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * 2;
    env(g, t + 0.12, 0.004, 0.08, 0.6);
    o.connect(g).connect(master);
    o.start(t + 0.12);
    o.stop(t + 0.9);
  }

  // Redoble de tambor que acelera y crece. Devuelve una funcion para cortarlo.
  function drumroll(duration) {
    if (!ready()) return () => {};
    const group = ctx.createGain();
    group.gain.value = 1;
    group.connect(master);
    const t0 = ctx.currentTime + 0.05;
    let t = t0;
    let n = 0;
    while (t < t0 + duration) {
      const p = (t - t0) / duration; // 0..1
      const interval = 0.13 - 0.1 * Math.pow(p, 0.7);
      const vel = 0.08 + 0.75 * Math.pow(p, 1.6);
      // golpe de redoblante: ruido filtrado
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700 + Math.random() * 500;
      bp.Q.value = 0.7;
      const g = ctx.createGain();
      env(g, t, 0.002, vel * (n % 2 ? 0.8 : 1), 0.07);
      noise(bp, t, 0.12);
      bp.connect(g).connect(group);
      // cuerpo del tambor
      if (n % 2 === 0) {
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.frequency.setValueAtTime(210, t);
        o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
        env(og, t, 0.002, vel * 0.35, 0.09);
        o.connect(og).connect(group);
        o.start(t);
        o.stop(t + 0.12);
      }
      // timbal grave cada tanto
      if (n % 8 === 0) {
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(55, t + 0.4);
        env(og, t, 0.004, 0.15 + vel * 0.5, 0.45);
        o.connect(og).connect(group);
        o.start(t);
        o.stop(t + 0.5);
      }
      t += interval * (0.9 + Math.random() * 0.2);
      n++;
    }
    // colchon de ruido que crece
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 2200;
    lp.Q.value = 0.5;
    const bed = ctx.createGain();
    bed.gain.setValueAtTime(0.0001, t0);
    bed.gain.exponentialRampToValueAtTime(0.18, t0 + duration);
    bed.gain.exponentialRampToValueAtTime(0.0001, t0 + duration + 0.08);
    noise(lp, t0, duration + 0.1);
    lp.connect(bed).connect(group);

    return function stop() {
      try {
        group.gain.cancelScheduledValues(ctx.currentTime);
        group.gain.setValueAtTime(group.gain.value, ctx.currentTime);
        group.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
        setTimeout(() => group.disconnect(), 300);
      } catch (e) {}
    };
  }

  function cymbal(peak = 0.6, decay = 2.8) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5200;
    const g = ctx.createGain();
    env(g, t, 0.003, peak, decay);
    noise(hp, t, decay + 0.2);
    hp.connect(g).connect(master);
    // parciales metalicos
    const mg = ctx.createGain();
    env(mg, t, 0.002, peak * 0.12, decay * 0.6);
    const mhp = ctx.createBiquadFilter();
    mhp.type = 'highpass';
    mhp.frequency.value = 3000;
    mhp.connect(mg).connect(master);
    [263, 401, 587, 733, 919, 1201].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * 4.1;
      o.connect(mhp);
      o.start(t);
      o.stop(t + decay);
    });
  }

  function boom(peak = 0.9) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.9);
    env(g, t, 0.005, peak, 1.2);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 1.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const ng = ctx.createGain();
    env(ng, t, 0.003, peak * 0.5, 0.4);
    noise(lp, t, 0.5);
    lp.connect(ng).connect(master);
  }

  function brass(freq, t, dur, peak = 0.12) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(freq * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(freq * 7, t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(freq * 3.5, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.04);
    g.gain.setValueAtTime(peak * 0.85, t + Math.max(0.05, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    lp.connect(g).connect(master);
    [-7, 0, 6].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.3);
    });
  }

  // Fanfarria de entrega de premios
  function fanfare() {
    if (!ready()) return;
    const t = ctx.currentTime + 0.02;
    const C4 = 261.63;
    const n = (s) => hz(s, C4);
    brass(n(7), t, 0.11);
    brass(n(7), t + 0.15, 0.11);
    brass(n(7), t + 0.3, 0.11);
    [0, 4, 7, 12].forEach((s) => brass(n(s + 12) / 2, t + 0.45, 0.55, 0.09));
    [5, 9, 12].forEach((s) => brass(n(s), t + 1.05, 0.3, 0.09));
    [7, 11, 14].forEach((s) => brass(n(s), t + 1.38, 0.3, 0.09));
    [-12, 0, 4, 7, 12, 16].forEach((s) => brass(n(s), t + 1.72, 2.2, 0.085));
    setTimeout(() => boom(0.7), 1720);
    setTimeout(() => cymbal(0.35, 2.4), 1720);
  }

  function whoosh(peak = 0.25, dur = 0.55) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise(bp, t, dur + 0.05);
    bp.connect(g).connect(master);
  }

  // Colchon grave de suspenso
  function drone(dur = 6) {
    if (!ready()) return;
    const t = ctx.currentTime + 0.02;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lp.connect(g).connect(master);
    [55, 82.4, 110.3].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
  }

  function pop() {
    if (!ready()) return;
    const t = ctx.currentTime + 0.01;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 1200;
    const g = ctx.createGain();
    env(g, t, 0.002, 0.25, 0.3);
    noise(bp, t, 0.35);
    bp.connect(g).connect(master);
    // chisporroteo
    for (let i = 0; i < 6; i++) {
      const tt = t + 0.15 + Math.random() * 0.5;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const cg = ctx.createGain();
      env(cg, tt, 0.001, 0.06, 0.03);
      noise(hp, tt, 0.05);
      hp.connect(cg).connect(master);
    }
  }

  return {
    init, setMuted, isMuted: () => muted, ready,
    plim, drumroll, cymbal, boom, fanfare, whoosh, drone, pop,
  };
})();
