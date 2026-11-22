// UMBRA HEIST — WebAudio sounds, all synthesised in code, no audio files:
// soft footsteps, a loot chime, a two-tone alarm when the guard gives chase,
// a win fanfare and a capture sting.
export function createAudio() {
  let context = null;
  let master = null;
  let stepAt = 0;
  let alarmAt = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  return {
    /** Call on the first key press so the browser unlocks audio. */
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume(); },
    /** A soft footstep, throttled so it follows the player's pace. */
    footstep(sneaking, nowMs) {
      if (!ensure() || nowMs - stepAt < (sneaking ? 420 : 260)) return;
      stepAt = nowMs;
      tone(sneaking ? 140 : 190, 0.07, 'sine', sneaking ? 0.12 : 0.3);
    },
    /** Two-tone alarm while the guard chases, at most once a second. */
    alarm(nowMs) {
      if (!ensure() || nowMs - alarmAt < 900) return;
      alarmAt = nowMs;
      tone(660, 0.16, 'square', 0.16);
      tone(440, 0.2, 'square', 0.16, 0.18);
    },
    /** The Star Chart chime. */
    loot() {
      tone(880, 0.16, 'sine', 0.35);
      tone(1318, 0.22, 'sine', 0.3, 0.09);
      tone(1760, 0.3, 'sine', 0.25, 0.18);
    },
    /** Escaped unseen. */
    win() {
      [523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, 0.28, 'triangle', 0.3, index * 0.12));
    },
    /** Caught by the guard. */
    caught() {
      tone(220, 0.3, 'sawtooth', 0.25);
      tone(147, 0.5, 'sawtooth', 0.25, 0.22);
    },
  };
}
