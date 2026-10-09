export class AudioSystem {
  private context: AudioContext | null = null;
  private mediaPrimed = false;
  private readonly notenClip = this.createClip('./audio/noten.mp3');
  private readonly ayaClip = this.createClip('./audio/aya.mp3');
  private readonly shemoClip = this.createClip('./audio/shemo.mp3');
  private readonly yerushalaimClip = this.createClip('./audio/yesrushalaim.mp3');
  private readonly shobidakClip = this.createClip('./audio/shobidak.mp3');
  private readonly morgenClip = this.createClip('./audio/morgen.mp3');
  private readonly waterClip = this.createClip('./audio/water2.mp3');
  private readonly dekelClip = this.createClip('./audio/dekelsong.mp3');

  constructor() {
    window.addEventListener('pointerdown', this.unlock, { once: true });
    window.addEventListener('keydown', this.unlock, { once: true });
  }

  playHeadshot(): void {
    const context = this.getContext();
    if (context) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(180, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(70, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.15);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const voiceLine = new SpeechSynthesisUtterance('Headshot!');
      voiceLine.lang = 'en-US';
      voiceLine.rate = 0.9;
      voiceLine.pitch = 0.75;
      voiceLine.volume = 1;
      window.speechSynthesis.speak(voiceLine);
    }
  }

  playPunch(): void {
    const context = this.getContext();
    if (!context) return;

    const duration = 0.18;
    const buffer = context.createBuffer(
      1,
      Math.floor(context.sampleRate * duration),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const decay = 1 - index / samples.length;
      samples[index] = (Math.random() * 2 - 1) * decay * decay;
    }

    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    noiseGain.gain.setValueAtTime(0.7, context.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    noise.connect(filter).connect(noiseGain).connect(context.destination);

    const thump = context.createOscillator();
    const thumpGain = context.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(115, context.currentTime);
    thump.frequency.exponentialRampToValueAtTime(48, context.currentTime + duration);
    thumpGain.gain.setValueAtTime(0.55, context.currentTime);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    thump.connect(thumpGain).connect(context.destination);

    noise.start();
    thump.start();
    noise.stop(context.currentTime + duration);
    thump.stop(context.currentTime + duration);
  }

  playNoten(): void {
    this.playClip(this.notenClip);
  }

  playAya(): void {
    this.playClip(this.ayaClip);
  }

  playShemo(): void {
    this.playClip(this.shemoClip);
  }

  playYerushalaim(): void {
    this.playClip(this.yerushalaimClip);
  }

  playShobidak(): void {
    this.playClip(this.shobidakClip);
  }

  playMorgen(): void {
    this.playClip(this.morgenClip);
  }

  playWater(): void {
    this.playClip(this.waterClip);
  }

  playDekel(): void {
    this.playClip(this.dekelClip);
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.unlock);
    window.removeEventListener('keydown', this.unlock);
    this.notenClip.pause();
    this.ayaClip.pause();
    this.shemoClip.pause();
    this.yerushalaimClip.pause();
    this.shobidakClip.pause();
    this.morgenClip.pause();
    this.waterClip.pause();
    this.dekelClip.pause();
    void this.context?.close();
  }

  private readonly unlock = (): void => {
    const context = this.getContext();
    if (context?.state === 'suspended') void context.resume();
    this.primeMediaClips();
  };

  private getContext(): AudioContext | null {
    if (!this.context) {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  private createClip(source: string): HTMLAudioElement {
    const clip = new Audio(source);
    clip.preload = 'auto';
    return clip;
  }

  private playClip(clip: HTMLAudioElement): void {
    clip.currentTime = 0;
    void clip.play().catch(() => {
      // Browsers may block sound until the first touch, click, or key press.
    });
  }

  private primeMediaClips(): void {
    if (this.mediaPrimed) return;
    this.mediaPrimed = true;
    for (const clip of [
      this.notenClip,
      this.ayaClip,
      this.shemoClip,
      this.yerushalaimClip,
      this.shobidakClip,
      this.morgenClip,
      this.waterClip,
      this.dekelClip,
    ]) {
      const wasMuted = clip.muted;
      clip.muted = true;
      const playback = clip.play();
      clip.pause();
      clip.currentTime = 0;
      clip.muted = wasMuted;
      void playback.catch(() => {
        // A later interaction can still start the clip normally.
      });
    }
  }
}
