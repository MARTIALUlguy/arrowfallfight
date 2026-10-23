import { getAvailableActions, getActionDefinition } from "@/engine/actions";
import { actionQteLength, chooseAttack, chooseDefense, makeQteResult, submitAttackQte, submitDefenseQte } from "@/engine/battle";
import { getCard } from "@/data/cards";
import type { AiDifficulty, BattleState, ChosenAction, QteResult } from "@/types";
import { createRng, pick } from "@/systems/rng";
import { hasPerfectOnlyModifier } from "@/engine/qte";

function actionScore(state: BattleState, action: ChosenAction, defending: boolean): number {
  if (action.kind === "basic-attack") return 8;
  if (action.kind === "basic-guard") return 8;
  if (action.kind === "ultimate") return 24;
  if (action.kind === "super-activate") return 12;
  const fighterIndex = defending ? state.defenderIndex : state.attackerIndex;
  const definition = getActionDefinition(state.combatants[fighterIndex], action, defending);
  const card = action.kind === "card" && action.cardId ? getCard(action.cardId) : null;
  const damage = definition.effect.damage ?? 0;
  const utility = (definition.effect.heal ?? 0) * 0.6
    + (definition.effect.block ?? 0) * 0.08
    + (definition.effect.shield ?? 0) * 0.7
    + (definition.effect.superGain ?? 0) * 0.12
    + (definition.effect.drawCards ?? 0) * 2;
  const lowHpBonus = state.combatants[fighterIndex].hp < 35 ? utility : 0;
  return damage + utility + lowHpBonus - (card ? 1 : 0);
}

function hardActionScore(state: BattleState, action: ChosenAction, defending: boolean): number {
  const fighterIndex = defending ? state.defenderIndex : state.attackerIndex;
  const fighter = state.combatants[fighterIndex];
  const targetIndex = defending ? state.attackerIndex : state.defenderIndex;
  const target = state.combatants[targetIndex];
  const effect = getActionDefinition(fighter, action, defending).effect;
  let score = actionScore(state, action, defending);

  if (!defending) {
    const targetStatuses = new Set(target.statuses.map((status) => status.id));
    score += (effect.targetStatuses ?? []).reduce((total, status) =>
      total + (targetStatuses.has(status.id) ? 1 : 3),
    0);
    if (effect.ignoreDefenseExceptPerfectGuard) score += 8;
    if (effect.damageEnemyShieldPercent && targetStatuses.has("shield")) score += 6;
    if (fighter.characterId === "nyra" && targetStatuses.has("chill")) score += 5;
    const recentGuards = state.history.defenderActions.slice(-3);
    if (
      recentGuards.length > 0
      && recentGuards.filter((kind) => kind === "basic-guard").length >= Math.ceil(recentGuards.length / 2)
      && action.kind === "basic-attack"
    ) {
      score += 5;
    }
    return score;
  }

  const incoming = state.chosenAttack
    ? getActionDefinition(target, state.chosenAttack).effect
    : {};
  const incomingDefinition = state.chosenAttack
    ? getActionDefinition(target, state.chosenAttack)
    : null;
  const incomingDamage = (incoming.damage ?? 0) * (incoming.hits ?? 1);
  const incomingType = incomingDefinition?.cardType;
  const canNegate = effect.negateOnPerfect
    || (effect.negateMeleeOnPerfect && incomingType === "attack-melee");
  score += incomingDamage * (effect.block ?? 0) / 100 * 1.5;
  if (canNegate) score += incomingDamage * 1.5;
  if (effect.counterDamage) score += effect.counterDamage;
  if (effect.counterOnPerfect) score += effect.counterOnPerfect;
  if (effect.shield) score += effect.shield * 0.8;
  if (effect.heal && fighter.hp < fighter.maxHp * 0.7) score += effect.heal;
  if (effect.cleanseNegative && fighter.statuses.some((status) =>
    ["burn", "bleed", "poison", "chill", "weak", "silence"].includes(status.id),
  )) {
    score += 7;
  }
  return score;
}

function chooseAction(
  state: BattleState,
  defending: boolean,
  difficulty: AiDifficulty,
  seed: number,
): ChosenAction {
  const fighterIndex = defending ? state.defenderIndex : state.attackerIndex;
  const options = getAvailableActions(state, fighterIndex, defending);
  const score = difficulty === "hard" ? hardActionScore : actionScore;
  const ranked = [...options].sort((a, b) =>
    score(state, b, defending) - score(state, a, defending),
  );
  if (difficulty !== "easy") return ranked[0];
  const rng = createRng(seed);
  const shortlist = ranked.slice(0, Math.min(3, ranked.length));
  return pick(rng, shortlist);
}

export function chooseAiAttack(state: BattleState, difficulty: AiDifficulty): BattleState {
  if (!state.teams[1].includes(state.attackerIndex)) throw new Error("L'IA n'est pas l'attaquante.");
  const action = chooseAction(state, false, difficulty, state.turn * 31 + state.combatants[state.attackerIndex].hp);
  return chooseAttack(state, action);
}

export function chooseAiDefense(state: BattleState, difficulty: AiDifficulty): BattleState {
  if (!state.teams[1].includes(state.defenderIndex)) throw new Error("L'IA n'est pas la défenseuse.");
  const action = chooseAction(state, true, difficulty, state.turn * 47 + state.combatants[state.defenderIndex].hp);
  return chooseDefense(state, action);
}

export function makeAiQte(
  state: BattleState,
  defending: boolean,
  difficulty: AiDifficulty,
): QteResult {
  const length = actionQteLength(state, defending);
  const fighterIndex = defending ? state.defenderIndex : state.attackerIndex;
  const fighter = state.combatants[fighterIndex];
  if (difficulty === "easy" && !hasPerfectOnlyModifier(fighter)) {
    return makeQteResult(Array.from({ length }, () => "good"));
  }
  if (difficulty === "hard" || hasPerfectOnlyModifier(fighter)) {
    return makeQteResult(Array.from({ length }, () => "perfect"));
  }
  const rng = createRng(state.turn * 97 + fighter.hp + (defending ? 13 : 0));
  return makeQteResult(Array.from({ length }, () => rng() < 0.8 ? "perfect" : "good"));
}

export function submitAiQte(
  state: BattleState,
  defending: boolean,
  difficulty: AiDifficulty,
): BattleState {
  const result = makeAiQte(state, defending, difficulty);
  return defending ? submitDefenseQte(state, result) : submitAttackQte(state, result);
}

export const chooseEasyAiAttack = (state: BattleState) => chooseAiAttack(state, "easy");
export const chooseEasyAiDefense = (state: BattleState) => chooseAiDefense(state, "easy");
export const makeEasyAiQte = (state: BattleState, defending: boolean) =>
  makeAiQte(state, defending, "easy");
export const submitEasyAiQte = (state: BattleState, defending: boolean) =>
  submitAiQte(state, defending, "easy");
