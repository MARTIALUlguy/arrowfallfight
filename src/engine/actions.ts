import { getCard } from "@/data/cards";
import { getCharacter } from "@/data/characters";
import type { BattleState, CardEffect, CardType, ChosenAction, CombatantState, ResourceCost } from "@/types";

export interface ActionDefinition {
  effect: CardEffect;
  qte: number;
  cost: ResourceCost;
  cardType?: CardType;
  abilityId?: string;
  isUltimate?: boolean;
}

export function getActionDefinition(
  combatant: CombatantState,
  action: ChosenAction,
  defending = false,
): ActionDefinition {
  const character = getCharacter(combatant.characterId);
  switch (action.kind) {
    case "basic-attack":
      return { effect: { damage: 8 }, qte: 3, cost: {}, cardType: "attack-melee" };
    case "basic-guard":
      return { effect: { block: 40, blockOnPerfect: 55 }, qte: 3, cost: {} };
    case "card": {
      if (!action.cardId) throw new Error("Une action carte doit préciser cardId.");
      const card = getCard(action.cardId);
      if (card.characterId && card.characterId !== combatant.characterId) {
        throw new Error(`La carte ${card.id} n'appartient pas à ${combatant.characterId}.`);
      }
      return { effect: card.effect, qte: card.qte, cost: card.cost, cardType: card.type };
    }
    case "ability": {
      const ability = defending ? character.abilityDefense : character.abilityAttack;
      return {
        effect: ability.effect,
        qte: ability.qte,
        cost: ability.cost,
        abilityId: ability.id,
      };
    }
    case "ultimate": {
      const effect = defending && character.ultimate.mode === "hybrid"
        ? character.ultimate.defensiveEffect ?? character.ultimate.effect
        : character.ultimate.effect;
      return {
        effect,
        qte: character.ultimate.qte,
        cost: {},
        isUltimate: true,
      };
    }
    case "super-activate":
      return { effect: {}, qte: 0, cost: {} };
  }
}

export function canPayCost(combatant: CombatantState, cost: ResourceCost): boolean {
  return combatant.energy >= (cost.energy ?? 0)
    && combatant.mana >= (cost.mana ?? 0)
    && combatant.hp > (cost.hp ?? 0);
}

export function getEffectiveActionCost(
  state: BattleState,
  combatantIndex: number,
  action: ChosenAction,
  defending = false,
): ResourceCost {
  const fighter = state.combatants[combatantIndex];
  const definition = getActionDefinition(fighter, action, defending);
  const cost = { ...definition.cost };
  const targetIndex = defending ? state.attackerIndex : state.defenderIndex;
  const target = state.combatants[targetIndex];
  const isAttack = action.kind === "basic-attack"
    || definition.cardType === "attack-melee"
    || definition.cardType === "attack-ranged"
    || (definition.effect.damage ?? 0) > 0;

  if (
    !defending
    && fighter.characterId === "kael"
    && isAttack
    && target.statuses.some((status) => status.id === "bleed")
    && (cost.energy ?? 0) > 0
  ) {
    cost.energy = Math.max(0, (cost.energy ?? 0) - 1);
  }

  if (
    action.kind === "card"
    && action.cardId
    && getCard(action.cardId).type === "attack-ranged"
  ) {
    cost.mana = Math.max(0, (cost.mana ?? 0) - (fighter.vars.nextRangedCardCostMinus ?? 0));
  }
  return cost;
}

export function getAvailableActions(
  state: BattleState,
  combatantIndex: number,
  defending = false,
): ChosenAction[] {
  const fighter = state.combatants[combatantIndex];
  const character = getCharacter(fighter.characterId);
  const options: ChosenAction[] = [
    { kind: defending ? "basic-guard" : "basic-attack" },
  ];
  const ability = defending ? character.abilityDefense : character.abilityAttack;
  const abilityAction: ChosenAction = { kind: "ability" };
  if (
    canPayCost(fighter, getEffectiveActionCost(state, combatantIndex, abilityAction, defending))
    && (fighter.cooldowns[ability.id] ?? 0) === 0
  ) {
    options.push(abilityAction);
  }

  if (!defending) {
    for (const cardId of fighter.hand) {
      const card = getCard(cardId);
      const action: ChosenAction = { kind: "card", cardId };
      if (
        card.type !== "defense"
        && !(fighter.statuses.some((status) => status.id === "silence"))
        && canPayCost(fighter, getEffectiveActionCost(state, combatantIndex, action))
      ) {
        options.push(action);
      }
    }
  } else {
    for (const cardId of fighter.hand) {
      const card = getCard(cardId);
      const action: ChosenAction = { kind: "card", cardId };
      if (
        card.type === "defense"
        && !(fighter.statuses.some((status) => status.id === "silence"))
        && canPayCost(fighter, getEffectiveActionCost(state, combatantIndex, action, true))
      ) {
        options.push(action);
      }
    }
  }

  // Mode Super : l'ultime est jouable tant que le mode Super est actif.
  if (fighter.superTurnsLeft > 0 && !fighter.ultimateUsed) {
    if (
      defending ? character.ultimate.mode !== "offensive" : character.ultimate.mode !== "defensive"
    ) {
      options.push({ kind: "ultimate" });
    }
  }
  // Activation du mode Super : disponible quand la jauge est pleine et le mode inactif.
  if (!defending && fighter.superGauge >= 100 && fighter.superTurnsLeft === 0) {
    options.push({ kind: "super-activate" });
  }
  return options;
}
