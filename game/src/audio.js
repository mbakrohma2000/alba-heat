// audio.js — every sound in Alba Heat is synthesised with WebAudio: the
// engine hum that follows the car's speed, the two-tone police siren, the
// pickup chime, the mission-complete jingle, collision thuds and the warm
// ambient pad under the sunset. One job: own the audio graph; there are no
// audio files anywhere in the game.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineSub = null, engineGain = null;
  let sirenOsc = null, sirenGain = null;
  let muted = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);

      // Ambient pad: two detuned triangles through a slow-breathing lowpass.
      const padGain = ctx.createGain(); padGain.gain.value = 0.035;
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass'; padFilter.frequency.value = 420;
      padGain.connect(padFilter); padFilter.connect(master);
      for (const freq of [110, 164.81, 220]) {
        const o = ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = freq;
        o.connect(padGain); o.start();
      }
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 130;
      lfo.connect(lfoGain); lfoGain.connect(padFilter.frequency); lfo.start();

      // Engine: a saw and a sub sine through a lowpass, gain driven by speed.
      const engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass'; engFilter.frequency.value = 520;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engFilter.connect(engineGain); engineGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineOsc.connect(engFilter); engineOsc.start();
      engineSub = ctx.createOscillator(); engineSub.type = 'sine'; engineSub.frequency.value = 28;
      engineSub.connect(engFilter); engineSub.start();

      // Siren: a square wave whose pitch an LFO swings between two tones.
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'square'; sirenOsc.frequency.value = 820;
      const sirenFilter = ctx.createBiquadFilter();
      sirenFilter.type = 'bandpass'; sirenFilter.frequency.value = 900; sirenFilter.Q.value = 2;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenFilter); sirenFilter.connect(sirenGain); sirenGain.connect(master);
      const sirenLfo = ctx.createOscillator(); sirenLfo.frequency.value = 0.55;
      const sirenLfoGain = ctx.createGain(); sirenLfoGain.gain.value = 150;
      sirenLfo.connect(sirenLfoGain); sirenLfoGain.connect(sirenOsc.frequency);
      sirenOsc.start(); sirenLfo.start();
    } catch (err) {
      ctx = null;
    }
  }

  function blip(freq, at, dur, gain, type = 'sine') {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const t = ctx.currentTime + at;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // A short burst of filtered noise: the shared body of shots and screeches.
  function noiseBurst(dur, filterType, freqFrom, freqTo, gainVal) {
    if (!ctx) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      const t = ctx.currentTime;
      filter.frequency.setValueAtTime(freqFrom, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t + dur);
      const g = ctx.createGain(); g.gain.value = gainVal;
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start();
    } catch (err) { /* a missed noise is not worth an exception */ }
  }

  return {
    init,
    get started() { return !!ctx; },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.03);
      return muted;
    },
    setMuted(value) {
      muted = !!value;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.03);
      return muted;
    },
    setEngine(on, norm) {
      if (!ctx || !engineGain) return;
      const t = ctx.currentTime;
      const freq = 52 + norm * 178;
      engineOsc.frequency.setTargetAtTime(freq, t, 0.06);
      engineSub.frequency.setTargetAtTime(freq * 0.5, t, 0.06);
      engineGain.gain.setTargetAtTime(on ? 0.028 + norm * 0.05 : 0, t, 0.09);
    },
    setSiren(on, closeness) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.006 + closeness * 0.035 : 0, ctx.currentTime, 0.12);
    },
    chime() { blip(880, 0, 0.22, 0.16); blip(1318, 0.09, 0.3, 0.14); },
    success() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, i * 0.09, 0.34, 0.15, 'triangle')); },
    click() { blip(1250, 0, 0.06, 0.08); },
    // Combat sounds: a pistol crack, a fist landing, tyres on a spike strip.
    shot() {
      noiseBurst(0.14, 'highpass', 900, 500, 0.5);
      blip(150, 0, 0.09, 0.4, 'square');
    },
    punch() { noiseBurst(0.09, 'lowpass', 700, 160, 0.5); },
    dryFire() { blip(1900, 0, 0.04, 0.12, 'square'); },
    reload() { blip(700, 0, 0.05, 0.14, 'square'); blip(1050, 0.13, 0.05, 0.16, 'square'); },
    screech() { noiseBurst(0.5, 'bandpass', 2400, 700, 0.28); },
    thud(strength) {
      if (!ctx) return;
      try {
        const len = Math.floor(ctx.sampleRate * 0.16);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource(); src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 260;
        const g = ctx.createGain();
        g.gain.value = Math.min(0.5, 0.12 + strength * 0.03);
        src.connect(filter); filter.connect(g); g.connect(master);
        src.start();
      } catch (err) { /* a missed thud is not worth an exception */ }
    },
  };
}
