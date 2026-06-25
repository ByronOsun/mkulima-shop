export function playBeep(type: 'success' | 'error' = 'success') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // "Tiiiiit" — sustained 1000 Hz tone, loud enough for phone speakers
      osc.type = 'square'; // square wave cuts through better than sine on small speakers
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.9, ctx.currentTime);
      gain.gain.setValueAtTime(0.9, ctx.currentTime + 0.30);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.40);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.40);
    } else {
      // Double low buzz for not-found
      osc.type = 'square';
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.9, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.9, ctx.currentTime + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.38);
    }

    osc.onended = () => ctx.close();
  } catch {
    // AudioContext blocked or unavailable — silent fail
  }
}
