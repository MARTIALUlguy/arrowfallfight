"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { CharacterDef } from "@/types";

interface BattleSceneProps {
  player: CharacterDef;
  partner?: CharacterDef;
  enemy: CharacterDef;
  turn: number;
  impactKey: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

function FighterGlyph({
  character,
  side,
  compact = false,
}: {
  character: CharacterDef;
  side: "left" | "right";
  compact?: boolean;
}) {
  const flipped = side === "right";
  return (
    <svg
      viewBox="0 0 180 210"
      role="img"
      aria-label={character.id}
      className={`${compact ? "h-28 w-24 sm:h-36 sm:w-32 md:h-48 md:w-44" : "h-32 w-28 sm:h-40 sm:w-36 md:h-48 md:w-44"} drop-shadow-[0_0_18px_var(--fighter-accent)] ${flipped ? "-scale-x-100" : ""}`}
      style={{ "--fighter-accent": character.accent } as CSSProperties}
    >
      <defs>
        <radialGradient id={`aura-${character.id}`}>
          <stop offset="0" stopColor={character.accent} stopOpacity=".3" />
          <stop offset="1" stopColor={character.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`body-${character.id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={character.secondary} />
          <stop offset="1" stopColor={character.accent} />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="112" rx="82" ry="92" fill={`url(#aura-${character.id})`} />
      <path d="M39 187 Q49 145 70 139 L70 115 Q51 102 57 72 Q61 42 90 39 Q119 42 123 72 Q129 102 110 115 L110 139 Q133 146 142 187 Q90 205 39 187Z"
        fill={`url(#body-${character.id})`} stroke={character.accent} strokeWidth="3" />
      <path d="M59 75 Q61 36 91 35 Q120 39 123 75 Q109 62 92 63 Q74 62 59 75Z"
        fill="#10162f" stroke={character.accent} strokeWidth="3" />
      <path d="M69 88h12m18 0h12" stroke="#f5f7ff" strokeWidth="4" strokeLinecap="round" />
      <path d="M81 105q9 6 18 0" fill="none" stroke="#10162f" strokeWidth="3" strokeLinecap="round" />
      <path d="M54 148 Q90 162 126 148" fill="none" stroke="#ffffff" strokeOpacity=".32" strokeWidth="3" />
      <path d="M48 175 L132 175" stroke={character.secondary} strokeOpacity=".8" strokeWidth="4" />
    </svg>
  );
}

export function BattleScene({ player, partner, enemy, turn, impactKey }: BattleSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLElement>(null);
  const partnerAccent = partner?.accent ?? "";

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || impactKey === 0) return;
    scene.classList.remove("battle-impact");
    void scene.offsetWidth;
    scene.classList.add("battle-impact");
  }, [impactKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const bounds = parent.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
      canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = Array.from({ length: reducedMotion ? 16 : 44 }, () => ({
      x: Math.random() * parent.clientWidth,
      y: Math.random() * 180,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.15 - Math.random() * 0.4,
      radius: 0.6 + Math.random() * 1.6,
      alpha: 0.2 + Math.random() * 0.65,
      color: Math.random() > 0.5
        ? player.accent
        : partnerAccent && Math.random() > 0.5 ? partnerAccent : enemy.accent,
    }));
    let frame = 0;
    let request = 0;
    const draw = () => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        if (!reducedMotion) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.y < 0) {
            particle.y = height;
            particle.x = Math.random() * width;
          }
        }
        context.globalAlpha = particle.alpha;
        context.fillStyle = particle.color;
        context.shadowBlur = 10;
        context.shadowColor = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      frame += 1;
      if (!reducedMotion || frame < 2) request = window.requestAnimationFrame(draw);
    };
    draw();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(request);
    };
  }, [enemy.accent, partnerAccent, player.accent]);

  return (
    <section
      ref={sceneRef}
      className="battle-scene relative isolate overflow-hidden rounded-2xl border border-night-700 bg-[#080c1c] px-2 py-2 sm:px-4"
      aria-label={`Battle arena, turn ${turn}`}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-7 h-px bg-gradient-to-r from-transparent via-neon-blue/70 to-transparent" />
      <div className={`relative flex h-full items-end ${partner ? "justify-around" : "justify-between px-[2%] sm:px-[8%] md:px-[17%]"}`}>
        <div className="battle-idle"><FighterGlyph character={player} side="left" compact={Boolean(partner)} /></div>
        {partner && (
          <div className="battle-idle battle-idle-delayed">
            <FighterGlyph character={partner} side="left" compact />
          </div>
        )}
        <div className="mb-10 flex shrink-0 flex-col items-center text-[10px] uppercase tracking-[0.2em] text-neon-blue/70 sm:mb-12 sm:text-xs sm:tracking-[0.35em]">
          <span>VS</span>
          <span className="mt-1 text-[10px] tracking-[0.2em]">#{String(turn).padStart(2, "0")}</span>
        </div>
        <div className="battle-idle battle-idle-delayed"><FighterGlyph character={enemy} side="right" compact={Boolean(partner)} /></div>
      </div>
    </section>
  );
}
