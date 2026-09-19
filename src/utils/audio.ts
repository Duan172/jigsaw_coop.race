// Sound effects using Web Audio API

class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    // Auto-unlock AudioContext on first user gesture anywhere
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.getContext();
        ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(evt => {
          window.removeEventListener(evt, unlock);
        });
      };
      ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(evt => {
        window.addEventListener(evt, unlock, { once: true, passive: true });
      });
    }
  }

  public getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Soft click when picking up a piece
  playPick() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.05);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // ignore
    }
  }

  // Distinctive, tactile mechanical jigsaw snap sound with a crisp lock click
  playSnap() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;

      // 1. Mechanical snap "thump/pop" transient (fast frequency drop)
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(850, now);
      popOsc.frequency.exponentialRampToValueAtTime(120, now + 0.035);
      popGain.gain.setValueAtTime(0.35, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      popOsc.connect(popGain);
      popGain.connect(ctx.destination);
      popOsc.start(now);
      popOsc.stop(now + 0.045);

      // 2. High-frequency crisp click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(2400, now + 0.005);
      clickOsc.frequency.exponentialRampToValueAtTime(800, now + 0.025);
      clickGain.gain.setValueAtTime(0.2, now + 0.005);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now + 0.005);
      clickOsc.stop(now + 0.035);

      // 3. Cheerful melodic snap chime chords (C6, E6, G6)
      [659.25, 880, 1046.5].forEach((freq, idx) => {
        const chimeOsc = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(freq, now + 0.02 + idx * 0.025);
        chimeGain.gain.setValueAtTime(0.18, now + 0.02 + idx * 0.025);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02 + idx * 0.025 + 0.18);
        chimeOsc.connect(chimeGain);
        chimeGain.connect(ctx.destination);
        chimeOsc.start(now + 0.02 + idx * 0.025);
        chimeOsc.stop(now + 0.02 + idx * 0.025 + 0.2);
      });
    } catch {
      // ignore
    }
  }

  // Wrong placement or miss sound
  playMiss() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore
    }
  }

  // Toggle sound effects
  setEnabled(val: boolean) {
    this.enabled = val;
  }

  // Fanfare when puzzle is completed
  playPuzzleComplete() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      const now = ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.25, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.48);
      });
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundEffects();
