/**
 * Sound effects for Cosmoffice — generated via Web Audio API (no mp3 files needed)
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }
    return audioCtx;
}

/**
 * Play a gentle knock sound (like knocking on a door)
 */
export function playKnockSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Three quick knocks
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = 400 + i * 30; // Slightly increasing pitch
            osc.type = 'sine';

            const t = now + i * 0.15;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

            osc.start(t);
            osc.stop(t + 0.12);
        }
    } catch { }
}

/**
 * Play a call ring notification (gentle bell)
 */
export function playCallRingSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Two-tone bell ring
        for (let i = 0; i < 2; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = i === 0 ? 880 : 1100; // A5 → C#6
            osc.type = 'sine';

            const t = now + i * 0.3;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

            osc.start(t);
            osc.stop(t + 0.3);
        }
    } catch { }
}

/**
 * Play a call accepted chime (positive confirmation)
 */
export function playCallAcceptedSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Rising two-note chime (positive feel)
        const notes = [523.25, 659.25]; // C5 → E5
        for (let i = 0; i < notes.length; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = notes[i];
            osc.type = 'sine';

            const t = now + i * 0.15;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

            osc.start(t);
            osc.stop(t + 0.35);
        }
    } catch { }
}

/**
 * Play a call declined sound (soft descending tone)
 */
export function playCallDeclinedSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(330, now + 0.3);
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.start(now);
        osc.stop(now + 0.45);
    } catch { }
}
