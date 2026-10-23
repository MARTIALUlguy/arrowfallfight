import { getActionDefinition } from "@/engine/actions";
import { getCard } from "@/data/cards";
import { getCharacter } from "@/data/characters";
import { canApplyStatus, getPerfectMajority } from "@/engine/qte";
import type {
  BattleState,
  CardEffect,
  ChosenAction,
  CombatantState,
  QteResult,
  StatusApplication,
  StatusId,
} from "@/types";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function cloneState(state: BattleState): BattleState {
  return {
    ...state,
    combatants: state.combatants.map((fighter) => ({
      ...fighter,
      hand: [...fighter.hand],
      drawPile: [...fighter.drawPile],
      discardPile: [...fighter.discardPile],
      statuses: fighter.statuses.map((status) => ({ ...status })),
      cooldowns: { ...fighter.cooldowns },
      recentDamageTaken: [...fighter.recentDamageTaken],
      vars: { ...fighter.vars },
    })),
    history: {
      attackerActions: [...state.history.attackerActions],
      defenderActions: [...state.history.defenderActions],
    },
    log: [...state.log],
  };
}

function addStatus(
  target: CombatantState,
  application: StatusApplication,
  sourceIndex?: number,
): void {
  const stacks = application.amount ?? 1;
  const existing = target.statuses.find((status) => status.id === application.id);
  if (existing) {
    if (
      application.stackable
      || ["burn", "bleed", "poison", "mark", "shield"].includes(application.id)
    ) {
      existing.stacks = Math.min(3, existing.stacks + stacks);
    }
    existing.turnsLeft = Math.max(existing.turnsLeft, application.duration ?? -1);
    if (sourceIndex !== undefined) existing.sourceIndex = sourceIndex;
    return;
  }
  target.statuses.push({
    id: application.id,
    stacks: application.id === "shield" ? stacks : Math.min(3, stacks),
    turnsLeft: application.duration ?? -1,
    sourceIndex,
  });
}

function hasStatus(fighter: CombatantState, id: StatusId): boolean {
  return fighter.statuses.some((status) => status.id === id);
}

function removeStatus(fighter: CombatantState, id: StatusId): void {
  fighter.statuses = fighter.statuses.filter((status) => status.id !== id);
}

function heal(fighter: CombatantState, amount: number): void {
  fighter.hp = Math.min(fighter.maxHp, fighter.hp + Math.max(0, amount));
}

function gainResources(fighter: CombatantState, effect: CardEffect): void {
  fighter.energy = clamp(fighter.energy + (effect.energyGain ?? 0), 0, fighter.maxEnergy);
  fighter.mana = clamp(fighter.mana + (effect.manaGain ?? 0), 0, fighter.maxMana);
  fighter.superGauge = clamp(fighter.superGauge + (effect.superGain ?? 0), 0, 100);
}

export function drawCards(fighter: CombatantState, amount: number): void {
  for (let i = 0; i < amount; i++) {
    if (fighter.hand.length >= fighter.maxHandSize) break;
    if (fighter.drawPile.length === 0) {
      fighter.drawPile = fighter.discardPile.splice(0);
      for (let j = fighter.drawPile.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [fighter.drawPile[j], fighter.drawPile[k]] = [fighter.drawPile[k], fighter.drawPile[j]];
      }
    }
    const card = fighter.drawPile.pop();
    if (card) fighter.hand.push(card);
  }
}

function applyEffectSetup(
  effect: CardEffect,
  actor: CombatantState,
  target: CombatantState,
  qte: QteResult,
): void {
  if (effect.heal) heal(actor, effect.heal);
  if (effect.shield) addStatus(actor, { id: "shield", amount: effect.shield });
  if (effect.shieldOnPerfect && getPerfectMajority(qte.grades)) {
    addStatus(actor, { id: "shield", amount: effect.shieldOnPerfect });
  }
  gainResources(actor, effect);
  if (effect.stealEnergy) {
    const amount = Math.min(target.energy, effect.stealEnergy);
    target.energy -= amount;
    actor.energy = clamp(actor.energy + amount, 0, actor.maxEnergy);
  }
  if (effect.stealMana) {
    const amount = Math.min(target.mana, effect.stealMana);
    target.mana -= amount;
    actor.mana = clamp(actor.mana + amount, 0, actor.maxMana);
  }
  if (effect.stealEnergyOnPerfect && getPerfectMajority(qte.grades)) {
    const amount = Math.min(target.energy, effect.stealEnergyOnPerfect);
    target.energy -= amount;
    actor.energy = clamp(actor.energy + amount, 0, actor.maxEnergy);
  }
  if (effect.removeEnemyEnergy) {
    target.energy = Math.max(0, target.energy - effect.removeEnemyEnergy);
  }
  if (effect.enemyNextAttackCostPlus) {
    target.vars.nextAttackCostPlus = (target.vars.nextAttackCostPlus ?? 0)
      + effect.enemyNextAttackCostPlus;
  }
  if (effect.nextRangedCardCostMinus) {
    actor.vars.nextRangedCardCostMinus = effect.nextRangedCardCostMinus;
  }
  if (effect.nextAttackBonusPercent) {
    actor.nextAttackBonusPercent += effect.nextAttackBonusPercent;
  }
  if (effect.drawCards) drawCards(actor, effect.drawCards);
  if (effect.consumeBurnAsDamage) {
    const burn = actor.statuses.find((status) => status.id === "burn");
    if (burn) {
      target.hp = Math.max(0, target.hp - burn.stacks * 3);
      removeStatus(actor, "burn");
    }
  }
  if (effect.cleanseNegative) {
    const removable = actor.statuses.filter((status) =>
      ["burn", "bleed", "poison", "chill", "stun", "weak", "mark", "silence"].includes(status.id),
    );
    const count = effect.cleanseNegative === true ? removable.length : effect.cleanseNegative;
    for (const status of removable.slice(0, count)) removeStatus(actor, status.id);
  }
  if (effect.stripEnemyPositiveStatus) {
    const positive = target.statuses.find((status) =>
      ["shield", "regen", "haste"].includes(status.id),
    );
    if (positive) removeStatus(target, positive.id);
  }
  if (effect.varsSet) Object.assign(actor.vars, effect.varsSet);
}

function applyStatuses(
  effect: CardEffect,
  actor: CombatantState,
  target: CombatantState,
  qte: QteResult,
  sourceIndex: number,
): void {
  for (const application of effect.selfStatuses ?? []) {
    if (application.onPerfect && !getPerfectMajority(qte.grades)) continue;
    if (!canApplyStatus(actor, application.id)) {
      if (application.id === "chill") actor.vars.chillImmune = 0;
      continue;
    }
    addStatus(actor, application, sourceIndex);
  }
  for (const application of effect.targetStatuses ?? []) {
    if (application.onPerfect && !getPerfectMajority(qte.grades)) continue;
    if (!canApplyStatus(target, application.id)) {
      if (application.id === "chill") target.vars.chillImmune = 0;
      continue;
    }
    addStatus(target, application, sourceIndex);
  }
}

function calculateDamage(
  effect: CardEffect,
  actor: CombatantState,
  target: CombatantState,
  qte: QteResult,
): number {
  let damage = effect.damage ?? 0;
  if (effect.bonusIfSelfLowHp && actor.hp < actor.maxHp / 2) damage += effect.bonusIfSelfLowHp;
  if (effect.bonusIfTargetBurning && hasStatus(target, "burn")) damage += effect.bonusIfTargetBurning;
  if (effect.bonusIfLastQtePerfect && actor.vars.lastQtePerfect) {
    damage += effect.bonusIfLastQtePerfect;
  }
  if (effect.bonusPerRecentDamageTaken) {
    damage += effect.bonusPerRecentDamageTaken
      * actor.recentDamageTaken.reduce((total, amount) => total + amount, 0);
  }
  if (effect.bonusPerTargetStack) {
    const stacks = target.statuses.find((status) => status.id === effect.bonusPerTargetStack?.status)?.stacks ?? 0;
    damage += stacks * effect.bonusPerTargetStack.per;
  }
  if (effect.bonusPerMark) {
    damage += (target.statuses.find((status) => status.id === "mark")?.stacks ?? 0)
      * effect.bonusPerMark;
  }
  if (actor.characterId === "nyra" && hasStatus(target, "chill")) damage *= 1.3;
  damage *= qte.multiplier;
  if (hasStatus(actor, "weak")) damage *= 0.8;
  damage *= 1 + (target.statuses.find((status) => status.id === "mark")?.stacks ?? 0) * 0.25;
  damage *= 1 + actor.nextAttackBonusPercent / 100;
  return Math.max(0, Math.round(damage));
}

function absorbShield(target: CombatantState, damage: number): number {
  let remaining = damage;
  for (const shield of target.statuses.filter((status) => status.id === "shield")) {
    const absorbed = Math.min(remaining, shield.stacks);
    shield.stacks -= absorbed;
    remaining -= absorbed;
  }
  target.statuses = target.statuses.filter((status) => status.id !== "shield" || status.stacks > 0);
  return remaining;
}

function applyDamage(
  actor: CombatantState,
  target: CombatantState,
  damage: number,
  ignoreShield = false,
): number {
  const hpDamage = ignoreShield ? damage : absorbShield(target, damage);
  const actual = Math.min(target.hp, hpDamage);
  target.hp = Math.max(0, target.hp - actual);
  target.recentDamageTaken[0] = (target.recentDamageTaken[0] ?? 0) + actual;
  if (target.characterId === "vorn" && damage >= 10) {
    addStatus(target, { id: "shield", amount: 4 });
  }
  actor.superGauge = clamp(actor.superGauge + Math.ceil(actual / 4), 0, 100);
  target.superGauge = clamp(target.superGauge + Math.ceil(actual / 6), 0, 100);
  return actual;
}

function resultForAction(action: ChosenAction | null, qte: QteResult | null): QteResult {
  if (qte) return qte;
  if (action?.kind === "card" && action.cardId && getCard(action.cardId).qte === 0) {
    return { grades: [], multiplier: 1, allPerfect: false, perfects: 0, goods: 0, misses: 0 };
  }
  return { grades: [], multiplier: 0.6, allPerfect: false, perfects: 0, goods: 0, misses: 0 };
}

function effectFor(
  fighter: CombatantState,
  action: ChosenAction | null,
  defending: boolean,
): CardEffect {
  return action ? getActionDefinition(fighter, action, defending).effect : {};
}

function applyAttack(
  state: BattleState,
  attackerIndex: number,
  defenderIndex: number,
  attackQte: QteResult,
  defenseQte: QteResult,
): void {
  const attacker = state.combatants[attackerIndex];
  const defender = state.combatants[defenderIndex];
  const attack = state.chosenAttack;
  const defense = state.chosenDefense;
  const attackEffect = effectFor(attacker, attack, false);
  const defenseEffect = effectFor(defender, defense, true);
  const attackDef = attack ? getActionDefinition(attacker, attack, false) : null;
  const defenseDef = defense ? getActionDefinition(defender, defense, true) : null;
  const isBasicAttack = attack?.kind === "basic-attack";
  const attackEnabled = attack?.kind !== "basic-guard" && attack?.kind !== "super-activate";
  const attackerQteModifiers = {
    qteMinus: attacker.vars.qteMinus ?? 0,
    perfectOnly: attacker.vars.nextQtePerfectOnly ?? 0,
  };
  const defenderQteModifiers = {
    qteMinus: defender.vars.qteMinus ?? 0,
    perfectOnly: defender.vars.nextQtePerfectOnly ?? 0,
  };

  if (attackEnabled) applyEffectSetup(attackEffect, attacker, defender, attackQte);
  applyEffectSetup(defenseEffect, defender, attacker, defenseQte);

  const totalHits = attackEnabled ? Math.max(1, attackEffect.hits ?? 1) : 0;
  let totalBlocked = 0;
  let totalDamage = 0;
  let totalAttackImpact = 0;
  const defenseIsPerfect = getPerfectMajority(defenseQte.grades);
  let blockPercent = defenseEffect.block ?? 0;
  if (defenseIsPerfect && defenseEffect.blockOnPerfect) {
    blockPercent = Math.max(blockPercent, defenseEffect.blockOnPerfect);
  }
  const negate = defenseIsPerfect && (
    defenseEffect.negateOnPerfect
    || (defenseEffect.negateMeleeOnPerfect && attackDef?.cardType === "attack-melee")
  );

  if (attackEffect.damageEnemyShieldPercent) {
    const shield = defender.statuses.find((status) => status.id === "shield");
    if (shield) {
      const broken = Math.min(
        shield.stacks,
        Math.round((attackEffect.damage ?? 0) * attackEffect.damageEnemyShieldPercent / 100),
      );
      shield.stacks -= broken;
      defender.statuses = defender.statuses.filter((status) => status.id !== "shield" || status.stacks > 0);
    }
  }
  for (let hit = 0; hit < totalHits; hit++) {
    let damage = calculateDamage(attackEffect, attacker, defender, attackQte);
    // Mode Super : +20 % de dégâts infligés.
    if (attacker.superTurnsLeft > 0) {
      damage = Math.round(damage * 1.2);
    }
    if (attackEffect.hits) {
      damage = Math.max(0, Math.round(
        (attackEffect.damage ?? 0) * attackQte.multiplier
        + (hit === 0 ? damage - (attackEffect.damage ?? 0) * attackQte.multiplier : 0),
      ));
    }
    if (isBasicAttack) blockPercent = 0;
    if (attackEffect.ignoreDefenseExceptPerfectGuard && !defenseIsPerfect) blockPercent = 0;
    if (negate) damage = 0;
    const blocked = Math.round(damage * clamp(blockPercent, 0, 100) / 100);
    const finalDamage = Math.max(0, damage - blocked);
    totalBlocked += blocked;
    totalAttackImpact += finalDamage;
    totalDamage += applyDamage(attacker, defender, finalDamage, attackEffect.ignoreShield);
  }
  attacker.recentDamageTaken = [];
  if (attackEnabled && ((attackEffect.damage ?? 0) > 0 || attackEffect.consumeBurnAsDamage)) {
    attacker.nextAttackBonusPercent = 0;
  }
  if (defenseEffect.reflectBlockedPercent && totalBlocked > 0) {
    applyDamage(defender, attacker, Math.round(totalBlocked * defenseEffect.reflectBlockedPercent / 100));
  }
  const counterAllowed = !defenseEffect.counterIfMelee || attackDef?.cardType === "attack-melee";
  if (
    counterAllowed
    && (defenseEffect.counterDamage || defenseEffect.counterStatuses?.length
      || defenseEffect.counterOnPerfect && defenseIsPerfect)
  ) {
    const counter = defenseEffect.counterOnPerfect && defenseIsPerfect
      ? defenseEffect.counterOnPerfect
      : defenseEffect.counterDamage ?? 0;
    applyDamage(defender, attacker, counter);
    applyStatuses(
      { targetStatuses: defenseEffect.counterStatuses },
      defender,
      attacker,
      defenseQte,
      defenderIndex,
    );
  }
  if (attackEnabled) applyStatuses(attackEffect, attacker, defender, attackQte, attackerIndex);
  applyStatuses(defenseEffect, defender, attacker, defenseQte, defenderIndex);
  if (attackEnabled && attacker.characterId === "kael" && (attackEffect.damage ?? 0) > 0) {
    addStatus(defender, { id: "bleed", duration: 3, stackable: true }, attackerIndex);
  }
  if (attackEnabled && attacker.characterId === "echo" && attackQte.allPerfect) {
    addStatus(defender, { id: "mark", duration: 2, stackable: true }, attackerIndex);
  }
  if (attacker.characterId === "sylphe" && totalAttackImpact > 0) {
    attacker.energy = clamp(attacker.energy + 1, 0, attacker.maxEnergy);
  }
  if (defender.characterId === "sylphe" && (totalBlocked > 0 || negate)) {
    defender.mana = clamp(defender.mana + 1, 0, defender.maxMana);
  }
  recordPerfectQte(attacker, attackQte);
  recordPerfectQte(defender, defenseQte);
  attacker.vars.lastQtePerfect = attackQte.allPerfect ? 1 : 0;
  defender.vars.lastQtePerfect = defenseQte.allPerfect ? 1 : 0;
  if (attackerQteModifiers.qteMinus > 0 && (attackDef?.qte ?? 0) > 0) attacker.vars.qteMinus = 0;
  if (defenderQteModifiers.qteMinus > 0 && (defenseDef?.qte ?? 0) > 0) defender.vars.qteMinus = 0;
  if (attackerQteModifiers.perfectOnly > 0 && (attackDef?.qte ?? 0) > 0) {
    attacker.vars.nextQtePerfectOnly = 0;
  }
  if (defenderQteModifiers.perfectOnly > 0 && (defenseDef?.qte ?? 0) > 0) {
    defender.vars.nextQtePerfectOnly = 0;
  }
  if (defenseEffect.blockedToMana && totalBlocked) {
    defender.mana = clamp(defender.mana + defenseEffect.blockedToMana, 0, defender.maxMana);
  }
  state.log.push(totalDamage > 0
    ? `${attacker.characterId} inflige ${totalDamage} dégâts${totalBlocked ? ` (${totalBlocked} bloqués)` : ""}.`
    : `${attacker.characterId} ne trouve pas d'ouverture.`);
}

function recordPerfectQte(fighter: CombatantState, qte: QteResult): void {
  if (qte.grades.length === 0) return;
  fighter.perfectStreak = qte.allPerfect ? Math.min(3, fighter.perfectStreak + 1) : 0;
  if (fighter.characterId === "aiko") {
    fighter.vars.fluidityBonus = qte.allPerfect
      ? Math.min(6, fighter.perfectStreak * 2)
      : 0;
  }
}

function endTurnStatuses(state: BattleState, fighterIndex: number): void {
  const fighter = state.combatants[fighterIndex];
  let mordrakDotDamage = 0;
  for (const status of [...fighter.statuses]) {
    let dotDamage = 0;
    if (status.id === "burn") dotDamage = 3 + (status.stacks - 1) * 2;
    if (status.id === "bleed") dotDamage = status.stacks * 2;
    if (status.id === "poison") dotDamage = status.stacks;
    if (dotDamage > 0) {
      const actualDamage = Math.min(fighter.hp, dotDamage);
      fighter.hp = Math.max(0, fighter.hp - actualDamage);
      if (
        status.sourceIndex !== undefined
        && state.combatants[status.sourceIndex].characterId === "mordrak"
        && (status.id === "bleed" || status.id === "poison")
      ) {
        mordrakDotDamage += actualDamage;
      }
    }
    if (status.id === "regen") heal(fighter, 4 * status.stacks);
    if (status.turnsLeft > 0) status.turnsLeft -= 1;
  }
  fighter.statuses = fighter.statuses.filter((status) => status.turnsLeft !== 0);
  const mordrakIndex = state.combatants.findIndex((combatant) => combatant.characterId === "mordrak");
  if (mordrakDotDamage > 0 && mordrakIndex !== -1) {
    heal(state.combatants[mordrakIndex], Math.round(mordrakDotDamage * 0.25));
  }
}

function startTurn(fighter: CombatantState): void {
  for (const abilityId of Object.keys(fighter.cooldowns)) {
    fighter.cooldowns[abilityId] = Math.max(0, fighter.cooldowns[abilityId] - 1);
  }
  fighter.energy = clamp(fighter.energy + 1, 0, fighter.maxEnergy);
  fighter.mana = clamp(fighter.mana + 1, 0, fighter.maxMana);
  if (fighter.characterId === "aiko" && fighter.vars.fluidityBonus) {
    fighter.energy = clamp(fighter.energy + fighter.vars.fluidityBonus, 0, fighter.maxEnergy);
    fighter.vars.fluidityBonus = 0;
    fighter.perfectStreak = 0;
  }
  drawCards(fighter, 1);
}

function checkWinner(state: BattleState): void {
  const livingTeam = state.teams.map((team) =>
    team.some((index) => state.combatants[index].hp > 0),
  );
  if (!livingTeam[0]) state.winner = 1;
  else if (!livingTeam[1]) state.winner = 0;
  else if (state.turn > state.maxTurns) {
    const teamHealth = state.teams.map((team) =>
      team.reduce((total, index) => {
        const fighter = state.combatants[index];
        return total + fighter.hp / fighter.maxHp;
      }, 0) / team.length,
    );
    state.winner = teamHealth[0] >= teamHealth[1] ? 0 : 1;
  }
  if (state.winner !== null) {
    state.phase = "BATTLE_END";
    const winners = state.teams[state.winner]
      .map((index) => state.combatants[index].characterId)
      .join(" et ");
    state.log.push(`${winners} remporte le combat.`);
  }
}

function findLivingTeamMember(
  state: BattleState,
  teamIndex: 0 | 1,
  preferredIndex: number,
): number {
  const team = state.teams[teamIndex];
  const preferredPosition = Math.max(0, team.indexOf(preferredIndex));
  for (let offset = 0; offset < team.length; offset++) {
    const candidate = team[(preferredPosition + offset) % team.length];
    if (state.combatants[candidate].hp > 0) return candidate;
  }
  return team[0];
}

function nextLivingTeamMember(state: BattleState, teamIndex: 0 | 1, fromIndex: number): number {
  const team = state.teams[teamIndex];
  const position = team.indexOf(fromIndex);
  for (let offset = 1; offset <= team.length; offset++) {
    const candidate = team[(Math.max(position, 0) + offset) % team.length];
    if (state.combatants[candidate].hp > 0) return candidate;
  }
  return team[0];
}

export function resolveExchange(state: BattleState): BattleState {
  const next = cloneState(state);
  const attackerIndex = next.attackerIndex;
  const defenderIndex = next.defenderIndex;

  // Stun: skip the stunned fighter's action phase, force auto-Guard, consume the status.
  for (const [index, kind] of [
    [attackerIndex, "attack"] as const,
    [defenderIndex, "defense"] as const,
  ]) {
    const fighter = next.combatants[index];
    if (hasStatus(fighter, "stun")) {
      removeStatus(fighter, "stun");
      if (kind === "attack") {
        next.chosenAttack = { kind: "basic-guard" };
      } else {
        next.chosenDefense = { kind: "basic-guard" };
      }
      next.log.push(`${fighter.characterId} est étourdi et saute sa phase d'action !`);
    }
  }

  const attackQte = resultForAction(next.chosenAttack, next.attackQte);
  const defenseQte = resultForAction(next.chosenDefense, next.defenseQte);

  applyAttack(next, attackerIndex, defenderIndex, attackQte, defenseQte);
  // Mode Super : décrémenter superTurnsLeft (sauf pour le combattant qui vient d'activer ce tour).
  if (next.chosenAttack?.kind !== "super-activate") {
    next.combatants[attackerIndex].superTurnsLeft = Math.max(0, next.combatants[attackerIndex].superTurnsLeft - 1);
  }
  if (next.chosenDefense?.kind !== "super-activate") {
    next.combatants[defenderIndex].superTurnsLeft = Math.max(0, next.combatants[defenderIndex].superTurnsLeft - 1);
  }
  endTurnStatuses(next, attackerIndex);
  next.history.attackerActions.push(next.chosenAttack?.kind ?? "basic-attack");
  next.history.defenderActions.push(next.chosenDefense?.kind ?? "basic-guard");
  checkWinner(next);
  if (next.winner !== null) return next;

  let followingAttacker: number;
  let followingDefender: number;
  if (next.teams[0].length > 1) {
    if (next.teams[0].includes(attackerIndex)) {
      followingAttacker = next.teams[1][0];
      followingDefender = findLivingTeamMember(next, 0, attackerIndex);
    } else {
      followingAttacker = findLivingTeamMember(
        next,
        0,
        next.nextTeamMemberIndex ?? next.teams[0][0],
      );
      followingDefender = next.teams[1][0];
      next.nextTeamMemberIndex = nextLivingTeamMember(next, 0, followingAttacker);
    }
  } else {
    followingAttacker = defenderIndex;
    followingDefender = attackerIndex;
  }
  next.attackerIndex = followingAttacker;
  next.defenderIndex = followingDefender;
  if (followingAttacker === next.teams[0][0]) next.turn += 1;
  next.chosenAttack = null;
  next.chosenDefense = null;
  next.attackQte = null;
  next.defenseQte = null;
  next.phase = "ATTACK_SELECT";
  startTurn(next.combatants[followingAttacker]);
  checkWinner(next);
  return next;
}
