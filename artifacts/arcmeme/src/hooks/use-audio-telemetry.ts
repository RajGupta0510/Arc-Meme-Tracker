import { useState, useCallback } from "react";

export function useAudioTelemetry() {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("arcmeme.sound_muted") === "true";
    } catch {
      return false;
    }
  });

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("arcmeme.sound_muted", String(next));
      } catch (err) {
        // ignore
      }
      return next;
    });
  }, []);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (isMuted || typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      return new AudioContextClass();
    } catch {
      return null;
    }
  }, [isMuted]);

  const playBuySound = useCallback((amount = 0) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      
      // Pitch scales with buy size
      const baseFreq = 440;
      const scaleFactor = Math.min(200, amount / 100);
      const targetFreq = baseFreq + scaleFactor;
      
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(targetFreq * 1.5, ctx.currentTime + 0.35);
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // ignore browser context locks
    }
  }, [getAudioContext]);

  const playSellSound = useCallback((amount = 0) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sawtooth";
      
      const baseFreq = 380;
      const scaleFactor = Math.min(100, amount / 100);
      const targetFreq = Math.max(120, baseFreq - scaleFactor);
      
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(targetFreq, ctx.currentTime + 0.45);
      
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // ignore
    }
  }, [getAudioContext]);

  const playAlarmSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.type = "square";
      osc2.type = "sine";
      
      osc1.frequency.setValueAtTime(260, ctx.currentTime);
      osc1.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
      osc1.frequency.setValueAtTime(260, ctx.currentTime + 0.3);
      osc1.frequency.setValueAtTime(330, ctx.currentTime + 0.45);
      
      osc2.frequency.setValueAtTime(130, ctx.currentTime);
      osc2.frequency.setValueAtTime(165, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.6);
      osc2.stop(ctx.currentTime + 0.6);
    } catch {
      // ignore
    }
  }, [getAudioContext]);

  const playHypeSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "triangle";
      
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.6);
      
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // ignore
    }
  }, [getAudioContext]);

  const playTickerClick = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.045);
    } catch {
      // ignore
    }
  }, [getAudioContext]);

  return {
    isMuted,
    toggleMute,
    playBuySound,
    playSellSound,
    playAlarmSound,
    playHypeSound,
    playTickerClick,
  };
}
