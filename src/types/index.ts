// ============================================================================
// ARROWFALL — Types du domaine partagés
// Moteur, UI, IA et données utilisent uniquement ces définitions.
// ============================================================================

// ---------------------------------------------------------------------------
// QTE / Réflexes
// ---------------------------------------------------------------------------

export type Direction = "up" | "down" | "left" | "right";

export type InputGrade = "perfect" | "good" | "miss";

export interface QteSequence {
  /** Flèches à enchaîner, dans l'ordre. */
  directions: Direction[];
  /** Temps total imparti (ms), déjà modulé par Gel/Célérité/Mode zen. */
  totalTimeMs: number;
}

export interface QteResult {
  grades: InputGrade[];
  /** 0,6 → 1,0 (×1,1 si 100 % Perfect, géré par le résolveur). */
  multiplier: number;
  allPerfect: boolean;
  perfects: number;
  goods: number;
  misses: number;
}

// ---------------------------------------------------------------------------
// Cartes
// ---------------------------------------------------------------------------

export type CardType =
  | "attack-melee"
  | "attack-ranged"
  | "defense"
  | "utility"
  | "buff";

export type Rarity = "common" | "rare" | "epic";

export interface ResourceCost {
  energy?: number;
  mana?: number;
  /** Coût payé en HP (Échange sanglant, Pacte sombre). */
  hp?: number;
}

/** Application d'un statut. `amount` = dégâts du tick / points de bouclier / compteur. */
export interface StatusApplication {
  id: StatusId;
  amount?: number;
  /** Tours de durée. Omettre = permanent jusqu'à purge/chute. */
  duration?: number;
  /** Empilable (saignement, poison, marque) : augmente `stacks` au lieu de rafraîchir. */
  stackable?: boolean;
  /** Ce statut ne s'applique que si le QTE est majoritairement Perfect. */
  onPerfect?: boolean;
}

/**
 * Effet déclaratif d'une action (carte, compétence, ultime, attaque/défense classique).
 * Le résolveur (engine/resolver.ts, Phase 1) est le seul à l'interpréter.
 */
export interface CardEffect {
  // --- Dégâts ---
  damage?: number;
  /** Coups multiples : `damage` infligé `hits` fois (décomposé pour le vol de ressources). */
  hits?: number;
  /** +X dégâts par cumul du statut présent sur la cible. */
  bonusPerTargetStack?: { status: StatusId; per: number };
  /** +X dégâts par Marque appliquée sur la cible. */
  bonusPerMark?: number;
  bonusIfTargetBurning?: number;
  /** +X si vos HP < 50 %. */
  bonusIfSelfLowHp?: number;
  /** +X si votre dernier QTE était 100 % Perfect. */
  bonusIfLastQtePerfect?: number;
  /** +X dégâts par point de dégâts subis depuis votre dernier demi-tour (Vengeance). */
  bonusPerRecentDamageTaken?: number;

  // --- Défense ---
  /** % de réduction de base (Garde = 40). */
  block?: number;
  /** % de réduction si le QTE est majoritairement Perfect. */
  blockOnPerfect?: number;
  /** Annule intégralement l'attaque si QTE majoritairement Perfect. */
  negateOnPerfect?: boolean;
  /** Annule toute attaque de mêlée si QTE majoritairement Perfect (Iaido). */
  negateMeleeOnPerfect?: boolean;
  /** % des dégâts bloqués renvoyés à l'attaquant. */
  reflectBlockedPercent?: number;
  /** Riposte fixe après résolution (déclenchée selon `counterIfMelee`). */
  counterDamage?: number;
  /** Riposte déclenchée seulement si le QTE défensif est majoritairement Perfect. */
  counterOnPerfect?: number;
  /** La riposte ne déclenche que si l'attaque adverse était de mêlée. */
  counterIfMelee?: boolean;
  /** Statuts infligés par la riposte (Ossements, Flocon vengeur, Piège). */
  counterStatuses?: StatusApplication[];

  // --- Ignore / brise ---
  ignoreShield?: boolean;
  /** Ignore 100 % de la défense adverse sauf Garde parfaite. */
  ignoreDefenseExceptPerfectGuard?: boolean;
  /** Inflige X % de son montant en dégâts au Bouclier adverse (Écrasement). */
  damageEnemyShieldPercent?: number;

  // --- Soins / bouclier ---
  heal?: number;
  shield?: number;
  shieldOnPerfect?: number;
  /** Convertit X dégâts bloqués en Mana (Voile d'os). */
  blockedToMana?: number;

  // --- Ressources ---
  energyGain?: number;
  manaGain?: number;
  superGain?: number;
  /** Vol d'énergie : prise sur la cible, créditée au joueur. */
  stealEnergy?: number;
  stealMana?: number;
  /** Vol d'énergie déclenché seulement sur QTE majoritairement Perfect. */
  stealEnergyOnPerfect?: number;
  removeEnemyEnergy?: number;
  /** Augmente le coût de la prochaine attaque adverse de X (Provocation). */
  enemyNextAttackCostPlus?: number;
  /** Votre prochaine carte de type attack-ranged coûte −X Mana. */
  nextRangedCardCostMinus?: number;
  drawCards?: number;

  // --- Statuts ---
  /** Sur la cible de l'action (ennemi si attaque, attaquant si défense). */
  targetStatuses?: StatusApplication[];
  /** Sur soi-même. */
  selfStatuses?: StatusApplication[];
  /** Purge les statuts négatifs du porteur (true = tous, nombre = N). */
  cleanseNegative?: boolean | number;
  /** Retire 1 statut positif adverse (Fracasse-runique). */
  stripEnemyPositiveStatus?: boolean;
  /** Rafraîchit votre Brûlure active en dégâts directs (Souffle ardent). */
  consumeBurnAsDamage?: boolean;

  // --- Divers ---
  nextAttackBonusPercent?: number;
  revealNextAction?: boolean;
  /** Pose des variables de mécanique de personnage (vars du CombatantState). */
  varsSet?: Record<string, number>;
}

export interface CardDef {
  id: string;
  type: CardType;
  rarity: Rarity;
  cost: ResourceCost;
  /** Nombre de flèches du QTE. 0 = effet instantané, joué pendant la phase d'action. */
  qte: number;
  /**
   * true = badge doré affiché sur la carte : au moins un effet (statut onPerfect,
   * riposte onPerfect, annulation…) ne se déclenche que sur QTE majoritairement Perfect.
   */
  statusOnPerfectOnly?: boolean;
  /** Carte signature : restreinte au personnage indiqué. Absent = universelle. */
  characterId?: string;
  nameKey: string;
  descriptionKey: string;
  flavorKey?: string;
  effect: CardEffect;
}

// ---------------------------------------------------------------------------
// Statuts
// ---------------------------------------------------------------------------

export type StatusId =
  | "burn"
  | "bleed"
  | "poison"
  | "chill"
  | "stun"
  | "shield"
  | "regen"
  | "weak"
  | "haste"
  | "mark"
  | "silence";

/** Instance de statut sur un combattant, à l'exécution. */
export interface ActiveStatus {
  id: StatusId;
  stacks: number;
  /** Tours restants. -1 = permanent (bouclier consommé par les dégâts). */
  turnsLeft: number;
  /** Combattant à l'origine du statut, utilisé notamment par Moisson. */
  sourceIndex?: number;
}

// ---------------------------------------------------------------------------
// Personnages
// ---------------------------------------------------------------------------

export interface AbilityDef {
  id: string;
  kind: "attack" | "defense";
  nameKey: string;
  descriptionKey: string;
  cost: ResourceCost;
  /** Cooldown en demi-tours (le document fixe 2). */
  cooldown: number;
  qte: number;
  statusOnPerfectOnly?: boolean;
  effect: CardEffect;
}

export type UltimateMode = "offensive" | "defensive" | "hybrid";

export interface UltimateDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  mode: UltimateMode;
  /** Toujours 7 flèches. */
  qte: number;
  statusOnPerfectOnly?: boolean;
  /** Effet principal (offensif, ou hybride : dégâts + bouclier pour Vörn). */
  effect: CardEffect;
  /** Effet défensif additionnel si le mode est hybride (Aïko : bloque 80 % + riposte). */
  defensiveEffect?: CardEffect;
}

export interface CharacterQuotes {
  /** Toutes les répliques sont des clés i18n (voir src/i18n/fr.ts). */
  attack: string[];
  damage: string[];
  victory: string[];
  defeat: string[];
  ultimate: string[];
  taunt: string[];
}

export interface CharacterDef {
  id: string;
  nameKey: string;
  titleKey: string;
  /** Couleur d'accent hex (aura, UI, QTE). */
  accent: string;
  /** Couleur secondaire (dégradés, particules). */
  secondary: string;
  hp: number;
  archetype: "melee" | "ranged" | "hybrid";
  resourceFocus: "energy" | "mana" | "hybrid";
  mechanicNameKey: string;
  mechanicDescriptionKey: string;
  abilityAttack: AbilityDef;
  abilityDefense: AbilityDef;
  ultimate: UltimateDef;
  /** 3 cartes signature (ids référencés dans cards.ts). */
  signatureCardIds: string[];
  /** Deck recommandé : exactement 20 ids (doublons inclus). */
  recommendedDeck: string[];
  quotes: CharacterQuotes;
}

// ---------------------------------------------------------------------------
// État de combat (moteur, Phase 1)
// ---------------------------------------------------------------------------

export type BattlePhase =
  | "TURN_START"
  | "ATTACK_SELECT"
  | "DEFENSE_SELECT"
  | "ATTACK_QTE"
  | "DEFENSE_QTE"
  | "RESOLVE"
  | "CHECK_END"
  | "BATTLE_END";

export type ActionKind =
  | "basic-attack"
  | "basic-guard"
  | "card"
  | "ability"
  | "super-activate"
  | "ultimate";

export interface ChosenAction {
  kind: ActionKind;
  cardId?: string;
  /** true si le mode Super a été activé pour cette action. */
  superActivated?: boolean;
}

export interface CombatantState {
  characterId: string;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  mana: number;
  maxMana: number;
  superGauge: number; // 0 → 100
  superTurnsLeft: number; // mode Super restant (en demi-tours)
  ultimateUsed: boolean;
  hand: string[];
  maxHandSize: number;
  drawPile: string[];
  discardPile: string[];
  statuses: ActiveStatus[];
  /** abilityId → demi-tours de cooldown restants. */
  cooldowns: Record<string, number>;
  /** Dégâts subis par demi-tour (index 0 = dernier demi-tour) — alimente Vengeance. */
  recentDamageTaken: number[];
  /** Série de QTE 100 % Perfect (mécanique Fluidité d'Aïko). */
  perfectStreak: number;
  /** +X % sur la prochaine attaque (Coup critique, Pas de l'ombre d'Écho). */
  nextAttackBonusPercent: number;
  /** Champ générique pour les mécaniques de personnage (compteurs, immunités…). */
  vars: Record<string, number>;
}

export interface BattleState {
  phase: BattlePhase;
  /** Index du combattant actif dans `combatants`. */
  attackerIndex: number;
  /** Index du combattant qui défend contre l'attaque en cours. */
  defenderIndex: number;
  combatants: CombatantState[];
  /** Indices des combattants de chaque équipe; `winner` désigne une équipe. */
  teams: [number[], number[]];
  /** Prochain attaquant allié après le tour du boss (mode coopération). */
  nextTeamMemberIndex: number | null;
  /** Numéro de tour complet (1-based). Un tour = deux demi-tours. */
  turn: number;
  /** Max 20 tours complets, puis victoire au % de HP. */
  maxTurns: number;
  chosenAttack: ChosenAction | null;
  chosenDefense: ChosenAction | null;
  attackQte: QteResult | null;
  defenseQte: QteResult | null;
  /** Historique des actions (mind-games de l'IA difficile). */
  history: {
    attackerActions: ActionKind[];
    defenderActions: ActionKind[];
  };
  log: string[];
  winner: 0 | 1 | null;
}

// ---------------------------------------------------------------------------
// Modes de jeu & IA
// ---------------------------------------------------------------------------

export type GameMode = "campaign" | "local-pvp" | "survival" | "coop" | "online";

export type AiDifficulty = "easy" | "normal" | "hard";

// ---------------------------------------------------------------------------
// Sauvegarde & options
// ---------------------------------------------------------------------------

export interface GameSettings {
  language: "fr" | "en";
  musicVolume: number; // 0 → 1
  sfxVolume: number; // 0 → 1
  /** QTE sans chrono, multiplicateur fixe 0,85. */
  zenMode: boolean;
  aiDifficulty: AiDifficulty;
}

export interface SaveData {
  version: 1;
  settings: GameSettings;
  campaign: {
    /** Chapitres terminés (1-based). */
    completedChapters: number[];
    /** Ids de cartes universelles débloquées en campagne. */
    unlockedCards: string[];
  };
  records: {
    survivalBestWave: number;
    totalMatches: number;
    totalPerfects: number;
    bestPerfectStreak: number;
  };
  /** Decks personnalisés : characterId → 20 ids de cartes. */
  customDecks: Record<string, string[]>;
  survivalRun: {
    characterId: string;
    wave: number;
    hp: number;
    maxHp: number;
    energy: number;
    maxEnergy: number;
    mana: number;
    maxMana: number;
    superGauge: number;
    maxHandSize: number;
    deck: string[];
    bonuses: string[];
    lastBonus: string | null;
    bonusAppliedWave: number;
  } | null;
  tutorialSeen: boolean;
}
