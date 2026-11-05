let audioCtx: AudioContext | null = null;
let ptVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockAudio() {
  getAudioContext();
  loadVoices();
}

function loadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const update = () => {
    const voices = window.speechSynthesis.getVoices();
    ptVoice =
      voices.find((v) => /pt[-_]BR/i.test(v.lang)) ||
      voices.find((v) => /^pt/i.test(v.lang)) ||
      null;
    voicesLoaded = true;
  };
  update();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = update;
  }
}

export function playHospitalBeep(isUrgent = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Hospital musical chord: D5 -> A5 gentle notification, or urgent triple pitch
    const freqs = isUrgent ? [880, 1175, 1568] : [587.33, 880];
    const startOffset = ctx.currentTime;

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startOffset + idx * 0.18);

      const t0 = startOffset + idx * 0.18;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0);
      osc.stop(t0 + 0.38);
    });
  } catch (err) {
    console.warn('Audio play failed:', err);
  }
}

export const tocarSineta = (isUrgent = false) => playHospitalBeep(isUrgent);
export const tocarEmergencia = () => playHospitalBeep(true);

export function speakTicket(senha: string, guiche: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    if (!voicesLoaded) loadVoices();
    window.speechSynthesis.cancel();

    // Spell ticket clearly: e.g. "Senha C 0 0 1, Guichê 2"
    const letter = senha[0] || '';
    const numberPart = parseInt(senha.slice(1), 10) || senha.slice(1);
    const text = `Senha ${letter}, ${numberPart}. Guichê ${guiche}.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}

export function anunciarSenhaPainel(senha: string, guiche: number) {
  playHospitalBeep();
  setTimeout(() => {
    speakTicket(senha, guiche);
  }, 420);
}
