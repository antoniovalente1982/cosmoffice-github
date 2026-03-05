/**
 * Sound effects for Cosmoffice — generated via Web Audio API (no mp3 files needed)
 * AudioContext is unlocked on first user interaction (click/keydown)
 */

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }
    return audioCtx;
}

// Unlock audio on first user gesture (required by browsers)
function unlockAudio() {
    if (audioUnlocked) return;
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => { audioUnlocked = true; });
        } else {
            audioUnlocked = true;
        }
    } catch { }
}

// Auto-attach unlock listeners
if (typeof window !== 'undefined') {
    const events = ['click', 'touchstart', 'keydown'] as const;
    const unlock = () => {
        unlockAudio();
        events.forEach(e => document.removeEventListener(e, unlock));
    };
    events.forEach(e => document.addEventListener(e, unlock, { once: false, passive: true }));
}

/**
 * Play a gentle knock sound (like knocking on a door) — 3 quick taps
 */
export function playKnockSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = 400 + i * 30;
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

        for (let i = 0; i < 2; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = i === 0 ? 880 : 1100;
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

        const notes = [523.25, 659.25];
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

/**
 * Play a welcome whoosh when entering the office (soft wind + chime)
 */
export function playWelcomeSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Soft white-noise whoosh (wind effect)
        const bufferSize = ctx.sampleRate * 0.6;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * 0.5;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 800;
        noiseFilter.Q.value = 0.5;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.1);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.6);

        // Warm ascending arpeggio: C5 → E5 → G5
        const notes = [523.25, 659.25, 783.99];
        for (let i = 0; i < notes.length; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = notes[i];
            osc.type = 'sine';

            const t = now + 0.1 + i * 0.16;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.07, t + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

            osc.start(t);
            osc.stop(t + 0.4);
        }
    } catch { }
}

/**
 * Play a short chat notification ping — subtle "blip" so users know someone wrote
 */
export function playChatPingSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Two quick soft notes: E6 → A5 (pleasant, non-intrusive)
        const notes = [1318.5, 880];
        for (let i = 0; i < notes.length; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = notes[i];
            osc.type = 'sine';

            const t = now + i * 0.08;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.06, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

            osc.start(t);
            osc.stop(t + 0.15);
        }
    } catch { }
}
