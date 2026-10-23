import { getActionDefinition, getAvailableActions, getEffectiveActionCost } from "@/engine/actions";
import { validateCharacterDeck } from "@/data/decks";
import { resolveExchange } from "@/engine/resolver";
import { getCard } from "@/data/cards";
import { getCharacter } from "@/data/characters";
import { createRng, shuffle, timeSeed } from "@/systems/rng";
import type { BattleState, ChosenAction, CombatantState, QteResult } from "@/types";

function hasStatus(fighter: CombatantState, id: string): boolean {
  return fighter.statuses.some((status) => status.id === id);
}
function removeStatus(fighter: CombatantState, id: string): void {
  fighter.statuses = fighter.statuses.filter((status) => status.id !== id);
}
function createCombatant(characterId: string, deck: string[], rng: () => number): CombatantState {
  const character = getCharacter(characterId);
  const drawPile = shuffle(rng, deck);
  return {
    characterId,
    hp: character.hp,
    maxHp: character.hp,
    energy: 3,
    maxEnergy: 10,
    mana: 3,
    maxMana: 10,
    superGauge: 0,
    superTurnsLeft: 0,
    ultimateUsed: false,
    hand: drawPile.splice(0, 5),
    maxHandSize: 7,
    drawPile,
    discardPile: [],
    statuses: [],
    cooldowns: {},
    recentDamageTaken: [],
    perfectStreak: 0,
    nextAttackBonusPercent: 0,
    vars: {},
  };
}

function copyCombatants(state: BattleState): BattleState["combatants"] {
  return state.combatants.map((fighter) => ({
    ...fighter,
    hand: [...fighter.hand],
    drawPile: [...fighter.drawPile],
    discardPile: [...fighter.discardPile],
    statuses: fighter.statuses.map((status) => ({ ...status })),
    cooldowns: { ...fighter.cooldowns },
    recentDamageTaken: [...fighter.recentDamageTaken],
    vars: { ...fighter.vars },
  }));
}

export function createBattleState(
  playerCharacterId: string,
  enemyCharacterId?: string,
  playerDeck?: string[],
  seed = timeSeed(),
  enemyHpBonus = 0,
  enemyDeck?: string[],
): BattleState {
  const player = getCharacter(playerCharacterId);
  const opponents = ["kael", "lyra", "vorn", "sylphe", "mordrak", "aiko", "echo", "nyra"]
    .filter((id) => id !== player.id);
  const enemyId = enemyCharacterId ?? opponents[seed % opponents.length];
  const enemy = getCharacter(enemyId);
  const playerDeckIds = playerDeck ?? player.recommendedDeck;
  const deckValidation = validateCharacterDeck(player.id, playerDeckIds);
  if (!deckValidation.ok) {
    throw new Error(`Deck invalide pour ${player.id} (${deckValidation.reason}).`);
  }
  const rng = createRng(seed);
  const enemyDeckIds = enemyDeck ?? enemy.recommendedDeck;
  const enemyDeckValidation = validateCharacterDeck(enemy.id, enemyDeckIds);
  if (!enemyDeckValidation.ok) {
    throw new Error(`Deck invalide pour ${enemy.id} (${enemyDeckValidation.reason}).`);
  }
  const enemyCombatant = createCombatant(enemy.id, enemyDeckIds, rng);
  enemyCombatant.maxHp += enemyHpBonus;
  enemyCombatant.hp += enemyHpBonus;
  return {
    phase: "ATTACK_SELECT",
    attackerIndex: 0,
    defenderIndex: 1,
    combatants: [
      createCombatant(player.id, playerDeckIds, rng),
      enemyCombatant,
    ],
    teams: [[0], [1]],
    nextTeamMemberIndex: null,
    turn: 1,
    maxTurns: 20,
    chosenAttack: null,
    chosenDefense: null,
    attackQte: null,
    defenseQte: null,
    history: { attackerActions: [], defenderActions: [] },
    log: [`${player.id} contre ${enemy.id}. Le combat commence.`],
    winner: null,
  };
}

export function createCoopBattleState(
  firstCharacterId: string,
  secondCharacterId: string,
  firstDeck?: string[],
  secondDeck?: string[],
  seed = timeSeed(),
  bossCharacterId = "vorn",
): BattleState {
  if (
    firstCharacterId === secondCharacterId
    || firstCharacterId === bossCharacterId
    || secondCharacterId === bossCharacterId
  ) {
    throw new Error("Les deux héros doivent être différents et distincts du boss.");
  }
  const first = getCharacter(firstCharacterId);
  const second = getCharacter(secondCharacterId);
  const firstDeckIds = firstDeck ?? first.recommendedDeck;
  const secondDeckIds = secondDeck ?? second.recommendedDeck;
  const firstValidation = validateCharacterDeck(first.id, firstDeckIds);
  const secondValidation = validateCharacterDeck(second.id, secondDeckIds);
  if (!firstValidation.ok) throw new Error(`Deck invalide pour ${first.id} (${firstValidation.reason}).`);
  if (!secondValidation.ok) throw new Error(`Deck invalide pour ${second.id} (${secondValidation.reason}).`);

  const state = createBattleState(first.id, bossCharacterId, firstDeckIds, seed, 60);
  const partner = createCombatant(second.id, secondDeckIds, createRng(seed ^ 0x5f3759df));
  state.combatants = [state.combatants[0], partner, state.combatants[1]];
  state.teams = [[0, 1], [2]];
  state.defenderIndex = 2;
  state.nextTeamMemberIndex = 1;
  state.log = [`${first.id} et ${second.id} affrontent ${bossCharacterId}. Le combat coopératif commence.`];
  return state;
}

function spend(state: BattleState, index: number, action: ChosenAction, defending: boolean): void {
  const fighter = state.combatants[index];
  const definition = getActionDefinition(fighter, action, defending);
  const cost = getEffectiveActionCost(state, index, action, defending);
  const rangedDiscount = action.kind === "card" && action.cardId
    && getCard(action.cardId).type === "attack-ranged"
    ? fighter.vars.nextRangedCardCostMinus ?? 0
    : 0;
  if (
    fighter.energy < (cost.energy ?? 0)
    || fighter.mana < (cost.mana ?? 0)
    || fighter.hp <= (cost.hp ?? 0)
  ) {
    throw new Error("Ressources insuffisantes.");
  }
  fighter.energy -= cost.energy ?? 0;
  fighter.mana -= cost.mana ?? 0;
  fighter.hp -= cost.hp ?? 0;
  if (rangedDiscount) fighter.vars.nextRangedCardCostMinus = 0;
  if (definition.abilityId) {
    const ability = getCharacter(fighter.characterId);
    fighter.cooldowns[definition.abilityId] =
      (defending ? ability.abilityDefense : ability.abilityAttack).cooldown;
  }
  if (definition.isUltimate) {
    fighter.ultimateUsed = true;
    fighter.superGauge = 0;
    fighter.superTurnsLeft = 0;
  }
  if (action.kind === "super-activate") {
    fighter.superGauge = 0;
    fighter.superTurnsLeft = 3;
  }
  if (action.kind === "card" && action.cardId) {
    const cardIndex = fighter.hand.indexOf(action.cardId);
    if (cardIndex < 0) throw new Error("Cette carte n'est plus dans la main.");
    fighter.hand.splice(cardIndex, 1);
    fighter.discardPile.push(action.cardId);
  }
}

export function chooseAttack(state: BattleState, action: ChosenAction): BattleState {
  if (state.phase !== "ATTACK_SELECT") throw new Error("Ce n'est pas la phase de choix d'attaque.");
  const fighter = state.combatants[state.attackerIndex];
  // Stun : saute la phase d'action, garde automatique, consomme le statut.
  const stunned = hasStatus(fighter, "stun");
  if (stunned) {
    action = { kind: "basic-guard" };
  }
  if (!stunned && !isAvailable(state, state.attackerIndex, action, false)) {
    throw new Error("Cette action n'est pas disponible.");
  }
  if (action.kind === "basic-guard" && !hasStatus(state.combatants[state.attackerIndex], "stun")) {
    throw new Error("La Garde ne peut pas être choisie comme attaque.");
  }
  const definition = getActionDefinition(fighter, action);
  if (action.kind === "card" && definition.cardType === "defense") {
    throw new Error("Une carte défensive ne peut pas être jouée en attaque.");
  }
  if (action.kind === "ultimate" && getCharacter(fighter.characterId).ultimate.mode === "defensive") {
    throw new Error("Cet ultime ne peut être utilisé qu'en défense.");
  }
  const next = { ...state, combatants: copyCombatants(state) };
  if (stunned) {
    removeStatus(next.combatants[state.attackerIndex], "stun");
    next.log = [...next.log, `${fighter.characterId} est étourdi et saute sa phase d'action !`];
  }
  spend(next, state.attackerIndex, action, false);
  next.chosenAttack = action;
  next.phase = "DEFENSE_SELECT";
  return next;
}

export function chooseDefense(state: BattleState, action: ChosenAction): BattleState {
  if (state.phase !== "DEFENSE_SELECT") throw new Error("Ce n'est pas la phase de choix de défense.");
  const defenderIndex = state.defenderIndex;
  const fighter = state.combatants[defenderIndex];
  const stunned = hasStatus(fighter, "stun");
  if (stunned) {
    action = { kind: "basic-guard" };
  }
  if (!stunned && !isAvailable(state, defenderIndex, action, true)) {
    throw new Error("Cette action n'est pas disponible.");
  }
  if (action.kind === "basic-attack") throw new Error("Une attaque ne peut pas être choisie en défense.");
  const definition = getActionDefinition(fighter, action, true);
  if (action.kind === "card" && definition.cardType !== "defense") {
    throw new Error("Seules les cartes défensives peuvent être jouées en défense.");
  }
  if (action.kind === "ultimate" && getCharacter(fighter.characterId).ultimate.mode === "offensive") {
    throw new Error("Cet ultime ne peut être utilisé qu'en attaque.");
  }
  const next = { ...state, combatants: copyCombatants(state) };
  if (stunned) {
    removeStatus(next.combatants[defenderIndex], "stun");
    next.log = [...next.log, `${fighter.characterId} est étourdi et saute sa phase d'action !`];
  }
  spend(next, defenderIndex, action, true);
  next.chosenDefense = action;
  next.phase = "ATTACK_QTE";
  if (actionQteLength(next, false) === 0) {
    return { ...next, phase: "DEFENSE_QTE" };
  }
  return next;
}

function isAvailable(
  state: BattleState,
  fighterIndex: number,
  action: ChosenAction,
  defending: boolean,
): boolean {
  return getAvailableActions(state, fighterIndex, defending).some((available) =>
    available.kind === action.kind && available.cardId === action.cardId,
  );
}

export function submitAttackQte(state: BattleState, result: QteResult): BattleState {
  if (state.phase !== "ATTACK_QTE") throw new Error("Le QTE d'attaque n'est pas attendu.");
  const next = { ...state, attackQte: result };
  const defenderIndex = state.defenderIndex;
  if (actionQteLength(next, true) === 0) {
    return resolveExchange({ ...next, phase: "RESOLVE" });
  }
  return { ...next, phase: "DEFENSE_QTE" };
}

export function submitDefenseQte(state: BattleState, result: QteResult): BattleState {
  if (state.phase !== "DEFENSE_QTE") throw new Error("Le QTE de défense n'est pas attendu.");
  return resolveExchange({ ...state, defenseQte: result, phase: "RESOLVE" });
}

export function actionQteLength(
  state: BattleState,
  defending: boolean,
): number {
  const index = defending
    ? state.defenderIndex
    : state.attackerIndex;
  const action = defending ? state.chosenDefense : state.chosenAttack;
  if (!action) return 0;
  const fighter = state.combatants[index];
  const baseLength = getActionDefinition(fighter, action, defending).qte;
  const targetIndex = defending ? state.attackerIndex : state.defenderIndex;
  const nyraChillBonus = state.combatants[targetIndex].characterId === "nyra"
    && fighter.statuses.some((status) => status.id === "chill")
    ? 1
    : 0;
  return Math.max(0, baseLength - (fighter.vars.qteMinus ?? 0) - nyraChillBonus);
}

export function makeQteResult(grades: QteResult["grades"], zenMode = false): QteResult {
  const perfects = grades.filter((grade) => grade === "perfect").length;
  const goods = grades.filter((grade) => grade === "good").length;
  const misses = grades.length - perfects - goods;
  const allPerfect = grades.length > 0 && perfects === grades.length;
  const multiplier = grades.length === 0
    ? 1
    : Math.min(1, 0.6 + (perfects * 0.4 + goods * 0.2) / grades.length);
  return {
    grades,
    multiplier: zenMode ? 0.85 : allPerfect ? 1.1 : multiplier,
    allPerfect,
    perfects,
    goods,
    misses,
  };
}
