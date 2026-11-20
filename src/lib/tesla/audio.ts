class SparkAudio {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private whir: AudioBuffer | null = null;
  private nextBang = 0;
  private osc: OscillatorNode | null = null;
  private oscGain: GainNode | null = null;
  private whirSrc: AudioBufferSourceNode | null = null;
  private whirGain: GainNode | null = null;

  private context() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.28), this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const env = Math.exp(-i / (this.ctx.sampleRate * 0.045));
        d[i] = (Math.random() * 2 - 1) * env;
      }
      this.noise = n;
      const w = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const wd = w.getChannelData(0);
      for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
      this.whir = w;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.context();
  }

  private blip(when: number, gain: number, decay: number) {
    const ctx = this.context();
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400 + Math.random() * 900;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    const t = Math.max(when, ctx.currentTime);
    g.gain.setValueAtTime(Math.max(0.0001, gain), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  /** Schedule real break-rate cracks. Call once per frame while enabled. */
  realBps(bps: number, enabled: boolean) {
    if (!enabled) {
      this.nextBang = 0;
      return;
    }
    const ctx = this.context();
    if (!ctx) return;
    const period = 1 / Math.max(20, Math.min(400, bps));
    if (this.nextBang < ctx.currentTime) this.nextBang = ctx.currentTime + 0.02;
    let guard = 0;
    while (this.nextBang < ctx.currentTime + 0.12 && guard < 8) {
      this.blip(this.nextBang, 0.07, 0.07);
      this.nextBang += period;
      guard++;
    }
  }

  lensCrack(enabled: boolean) {
    if (!enabled) return;
    const ctx = this.context();
    if (!ctx) return;
    this.blip(ctx.currentTime, 0.09, 0.22);
  }

  hum(freq: number, enabled: boolean) {
    const ctx = this.context();
    if (!ctx) return;
    if (!enabled) {
      this.stopHum();
      return;
    }
    const f = Math.max(28, Math.min(240, freq));
    if (!this.osc || !this.oscGain) {
      this.osc = ctx.createOscillator();
      this.osc.type = "sine";
      this.oscGain = ctx.createGain();
      this.oscGain.gain.value = 0.018;
      this.osc.connect(this.oscGain);
      this.oscGain.connect(ctx.destination);
      this.osc.start();
    }
    this.osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
  }

  whirring(amount: number, enabled: boolean) {
    const ctx = this.context();
    if (!ctx || !this.whir) return;
    if (!enabled || amount <= 0.02) {
      this.stopWhir();
      return;
    }
    if (!this.whirSrc || !this.whirGain) {
      this.whirSrc = ctx.createBufferSource();
      this.whirSrc.buffer = this.whir;
      this.whirSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 420;
      bp.Q.value = 0.8;
      this.whirGain = ctx.createGain();
      this.whirGain.gain.value = 0.0001;
      this.whirSrc.connect(bp);
      bp.connect(this.whirGain);
      this.whirGain.connect(ctx.destination);
      this.whirSrc.start();
    }
    this.whirGain.gain.setTargetAtTime(0.012 + amount * 0.03, ctx.currentTime, 0.08);
  }

  stopHum() {
    if (this.osc) {
      try {
        this.osc.stop();
      } catch {
        /* already stopped */
      }
      this.osc.disconnect();
      this.osc = null;
    }
    this.oscGain?.disconnect();
    this.oscGain = null;
  }

  stopWhir() {
    if (this.whirSrc) {
      try {
        this.whirSrc.stop();
      } catch {
        /* already stopped */
      }
      this.whirSrc.disconnect();
      this.whirSrc = null;
    }
    this.whirGain?.disconnect();
    this.whirGain = null;
  }

  stopAll() {
    this.nextBang = 0;
    this.stopHum();
    this.stopWhir();
  }
}

export const sparkAudio = new SparkAudio();
