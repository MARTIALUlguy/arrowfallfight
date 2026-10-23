// ============================================================================
// ARROWFALL — Survie : vagues infinies + bonus entre vagues
// ============================================================================

import type { AiDifficulty } from "@/types";

export interface SurvivalBonus {
  id: string;
  nameKey: string;
  descriptionKey: string;
}

/** Choix de bonus proposés entre deux vagues (3 tirés au hasard). */
export const SURVIVAL_BONUSES: SurvivalBonus[] = [
  { id: "heal", nameKey: "survival.bonus.heal.name", descriptionKey: "survival.bonus.heal.description" },
  { id: "max-energy", nameKey: "survival.bonus.max-energy.name", descriptionKey: "survival.bonus.max-energy.description" },
  { id: "max-mana", nameKey: "survival.bonus.max-mana.name", descriptionKey: "survival.bonus.max-mana.description" },
  { id: "hand-size", nameKey: "survival.bonus.hand-size.name", descriptionKey: "survival.bonus.hand-size.description" },
  { id: "draw", nameKey: "survival.bonus.draw.name", descriptionKey: "survival.bonus.draw.description" },
  { id: "super", nameKey: "survival.bonus.super.name", descriptionKey: "survival.bonus.super.description" },
];

/** Difficulté de l'IA en fonction du numéro de vague (1-based). */
export function survivalDifficulty(wave: number): AiDifficulty {
  if (wave <= 2) return "easy";
  if (wave <= 5) return "normal";
  return "hard";
}

/** Bonus de stats de l'IA par vague (HP bonus, à ajouter au max du perso). */
export function survivalEnemyHpBonus(wave: number): number {
  return Math.min(30, (wave - 1) * 3);
}
