import type { ActiveStatus, CombatantState, Direction, QteSequence } from "@/types";
import type { Rng } from "@/systems/rng";

const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];
export const QTE_PERFECT_WINDOW_MS = 360;
export const QTE_GOOD_WINDOW_MS = 650;
export const QTE_ARROW_DURATION_MS = 900;

export function createQteSequence(
  length: number,
  fighter: CombatantState,
  rng: Rng,
  zenMode = false,
): QteSequence {
  const directions = Array.from({ length }, () =>
    DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)],
  );
  const chilled = fighter.statuses.some((status) => status.id === "chill");
  const hasted = fighter.statuses.some((status) => status.id === "haste");
  const statusMultiplier = (chilled ? 0.75 : 1) * (hasted ? 1.25 : 1);
  return {
    directions,
    totalTimeMs: zenMode ? Number.POSITIVE_INFINITY : Math.round(
      length * QTE_ARROW_DURATION_MS * statusMultiplier,
    ),
  };
}

export function getPerfectMajority(
  grades: readonly ("perfect" | "good" | "miss")[],
): boolean {
  return grades.length > 0 && grades.filter((grade) => grade === "perfect").length > grades.length / 2;
}

export function hasPerfectOnlyModifier(fighter: CombatantState): boolean {
  return (fighter.vars.nextQtePerfectOnly ?? 0) > 0;
}

export function isChillImmune(fighter: CombatantState): boolean {
  return (fighter.vars.chillImmune ?? 0) > 0;
}

export function canApplyStatus(fighter: CombatantState, statusId: ActiveStatus["id"]): boolean {
  return statusId !== "chill" || !isChillImmune(fighter);
}
