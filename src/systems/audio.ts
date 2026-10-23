"use client";

export type SoundEffect = "click" | "perfect" | "good" | "miss" | "impact" | "victory" | "defeat";

interface MusicController {
  setVolume: (volume: number) => void;
  stop: () => void;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (typeof window === "undefined" || !window.AudioContext) {
    throw new Error("Web Audio API is not available in this browser.");
  }
  audioContext ??= new window.AudioContext();
  return audioContext;
}

export async function unlockAudio(): Promise<void> {
  const context = getAudioContext();
  if (context.state !== "running") await context.resume();
}

export function playSound(effect: SoundEffect, volume: number): void {
  if (volume <= 0) return;
  const context = getAudioContext();
  const now = context.currentTime;
  const notes: Record<SoundEffect, { frequency: number; duration: number; wave: OscillatorType }> = {
    click: { frequency: 480, duration: 0.055, wave: "sine" },
    perfect: { frequency: 880, duration: 0.12, wave: "triangle" },
    good: { frequency: 590, duration: 0.09, wave: "sine" },
    miss: { frequency: 170, duration: 0.16, wave: "sawtooth" },
    impact: { frequency: 115, duration: 0.2, wave: "triangle" },
    victory: { frequency: 660, duration: 0.35, wave: "triangle" },
    defeat: { frequency: 145, duration: 0.4, wave: "sine" },
  };
  const note = notes[effect];
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = note.wave;
  oscillator.frequency.setValueAtTime(note.frequency, now);
  if (effect === "victory") {
    oscillator.frequency.setValueAtTime(880, now + 0.12);
    oscillator.frequency.setValueAtTime(1100, now + 0.24);
  }
  gain.gain.setValueAtTime(Math.min(0.25, volume * 0.18), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + note.duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + note.duration);
}

export async function startMusic(volume: number): Promise<MusicController> {
  const context = getAudioContext();
  if (context.state !== "running") await context.resume();

  const master = context.createGain();
  master.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) * 0.12, context.currentTime);
  master.connect(context.destination);

  const drone = context.createOscillator();
  const droneGain = context.createGain();
  drone.type = "sine";
  drone.frequency.value = 55;
  droneGain.gain.value = 0.45;
  drone.connect(droneGain);
  droneGain.connect(master);
  drone.start();

  const notes = [220, 261.63, 329.63, 392, 329.63, 293.66, 261.63, 196];
  let noteIndex = 0;
  let timer: number | undefined;
  let stopped = false;

  const scheduleNote = () => {
    if (stopped) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const startAt = context.currentTime + 0.02;
    oscillator.type = "triangle";
    oscillator.frequency.value = notes[noteIndex % notes.length];
    envelope.gain.setValueAtTime(0.001, startAt);
    envelope.gain.linearRampToValueAtTime(0.24, startAt + 0.08);
    envelope.gain.exponentialRampToValueAtTime(0.001, startAt + 0.62);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.64);
    noteIndex += 1;
    timer = window.setTimeout(scheduleNote, 620);
  };
  scheduleNote();

  return {
    setVolume(nextVolume) {
      master.gain.setTargetAtTime(
        Math.max(0, Math.min(1, nextVolume)) * 0.12,
        context.currentTime,
        0.08,
      );
    },
    stop() {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      drone.stop();
      drone.disconnect();
      droneGain.disconnect();
      master.disconnect();
    },
  };
}
