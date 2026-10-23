"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { actionQteLength, chooseAttack, chooseDefense, createBattleState, createCoopBattleState, makeQteResult, submitAttackQte, submitDefenseQte } from "@/engine/battle";
import { chooseAiAttack, chooseAiDefense, submitAiQte } from "@/engine/ai";
import { getAvailableActions, getEffectiveActionCost } from "@/engine/actions";
import { getCard } from "@/data/cards";
import { getCharacter } from "@/data/characters";
import { STATUSES } from "@/data/statuses";
import { BattleScene } from "@/components/battle/BattleScene";
import { createQteSequence, hasPerfectOnlyModifier, QTE_ARROW_DURATION_MS, QTE_GOOD_WINDOW_MS, QTE_PERFECT_WINDOW_MS } from "@/engine/qte";
import { defaultSettings, loadSave, updateSave } from "@/systems/save";
import { playSound, startMusic, unlockAudio } from "@/systems/audio";
import { validateCharacterDeck } from "@/data/decks";
import { useI18n } from "@/systems/i18n";
import type { BattleState, ChosenAction, Direction, GameSettings, InputGrade, QteResult } from "@/types";
import { getChapter } from "@/data/campaign";
import { CHARACTERS } from "@/data/characters";
import { SURVIVAL_BONUSES, survivalDifficulty, survivalEnemyHpBonus } from "@/data/survival";
import { drawCards } from "@/engine/resolver";
import { useRouter } from "next/navigation";
import {
  closeOnlineSession,
  getOnlineSession,
  isOnlineMessage,
  sendOnlineMessage,
} from "@/systems/online-session";

const ARROWS: Record<Direction, string> = {
  up: "↑",
  right: "→",
  down: "↓",
  left: "←",
};

function GameContent() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") ?? "campaign";
  const onlineRole = params.get("role") === "guest" ? "guest" : "host";
  const onlineSession = mode === "online" ? getOnlineSession() : null;
  const cooperative = mode === "coop";
  const requestedCharacterId = params.get("character") ?? "kael";
  const requestedPartnerId = params.get("partner") ?? "lyra";
  const requestedOpponentId = params.get("opponent") ?? "";
  const characterId = CHARACTERS.some((entry) =>
    entry.id === requestedCharacterId
      && (!cooperative || entry.id !== "vorn")
      && (mode !== "online" || entry.id !== "vorn"),
  ) ? requestedCharacterId : "kael";
  const partnerCharacterId = CHARACTERS.some((entry) =>
    entry.id === requestedPartnerId && entry.id !== characterId && entry.id !== "vorn",
  ) ? requestedPartnerId : characterId === "lyra" ? "kael" : "lyra";
  const requestedChapterId = Number(params.get("chapter") ?? "1");
  const chapterId = Number.isInteger(requestedChapterId)
    && requestedChapterId >= 1
    && requestedChapterId <= 8
    ? requestedChapterId
    : 1;
  const chapter = mode === "campaign" ? getChapter(chapterId) : null;
  const wave = Math.max(1, Number(params.get("wave") ?? "1") || 1);
  const localPvp = mode === "local-pvp";
  const requestedOpponent = requestedOpponentId;
  const opponentId = cooperative
    ? "vorn"
    : localPvp || mode === "online"
    ? requestedOpponent
    : chapter?.opponentId ?? CHARACTERS.find((entry) => entry.id !== characterId)?.id ?? "kael";
  const opponentValid = CHARACTERS.some((entry) =>
    entry.id === opponentId
      && (mode !== "online" || entry.id !== "vorn"),
  );
  const safeOpponentId = opponentValid
    ? opponentId
    : mode === "online" && characterId !== "lyra" ? "lyra" : "kael";
  const onlineHostCharacterId = onlineRole === "guest" ? safeOpponentId : characterId;
  const onlineGuestCharacterId = onlineRole === "guest" ? characterId : safeOpponentId;
  const runDifficulty = mode === "campaign" && chapter
    ? chapter.difficulty
    : mode === "survival" ? survivalDifficulty(wave) : null;
  const roomCode = params.get("room") ?? "";
  const battleSeed = useMemo(
    () => Array.from(`${mode}:${onlineHostCharacterId}:${onlineGuestCharacterId}:${partnerCharacterId}:${safeOpponentId}:${chapterId}:${wave}:${roomCode}`).reduce(
      (seed, character) => (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0,
      7,
    ),
    [characterId, onlineHostCharacterId, onlineGuestCharacterId, partnerCharacterId, mode, safeOpponentId, chapterId, wave, roomCode],
  );
  const createBattleForRoute = (seed: number) => {
    const save = loadSave();
    const playerCustomDeck = save.customDecks[characterId];
    const survivalDeck = save.survivalRun?.characterId === characterId
      && save.survivalRun.wave === wave
      ? save.survivalRun.deck
      : null;
    const selectedPlayerDeck = survivalDeck ?? playerCustomDeck;
    const playerDeck = selectedPlayerDeck && validateCharacterDeck(characterId, selectedPlayerDeck).ok
      ? selectedPlayerDeck
      : undefined;
    if (mode === "online") {
      const hostDeck = save.customDecks[onlineHostCharacterId];
      const guestDeck = save.customDecks[onlineGuestCharacterId];
      const validHostDeck = hostDeck && validateCharacterDeck(onlineHostCharacterId, hostDeck).ok
        ? hostDeck
        : undefined;
      const validGuestDeck = guestDeck && validateCharacterDeck(onlineGuestCharacterId, guestDeck).ok
        ? guestDeck
        : undefined;
      return createBattleState(
        onlineHostCharacterId,
        onlineGuestCharacterId,
        validHostDeck,
        seed,
        0,
        validGuestDeck,
      );
    }
    if (cooperative) {
      const customPartnerDeck = save.customDecks[partnerCharacterId];
      const partnerDeck = customPartnerDeck
        && validateCharacterDeck(partnerCharacterId, customPartnerDeck).ok
        ? customPartnerDeck
        : undefined;
      return createCoopBattleState(
        characterId,
        partnerCharacterId,
        playerDeck,
        partnerDeck,
        seed,
        safeOpponentId,
      );
    }
    const opponentCustomDeck = save.customDecks[safeOpponentId];
    const enemyDeck = opponentCustomDeck && validateCharacterDeck(safeOpponentId, opponentCustomDeck).ok
      ? opponentCustomDeck
      : undefined;
    const enemyId = mode === "survival"
      ? CHARACTERS.filter((entry) => entry.id !== characterId)[(wave - 1) % (CHARACTERS.length - 1)].id
      : safeOpponentId;
    const enemyBonus = mode === "survival" ? survivalEnemyHpBonus(wave) : 0;
    const nextBattle = createBattleState(
      characterId,
      enemyId,
      playerDeck,
      seed,
      enemyBonus,
      mode === "local-pvp" ? enemyDeck : undefined,
    );
    if (mode === "survival") {
      const run = save.survivalRun;
      const fighter = nextBattle.combatants[0];
      if (run && run.characterId === characterId && run.wave === wave && wave > 1) {
        fighter.hp = Math.min(fighter.maxHp, run.hp);
        fighter.maxHp = run.maxHp;
        fighter.hp = Math.min(fighter.maxHp, run.hp);
        fighter.energy = Math.min(fighter.maxEnergy, run.energy);
        fighter.maxEnergy = run.maxEnergy;
        fighter.energy = Math.min(fighter.maxEnergy, run.energy);
        fighter.mana = Math.min(fighter.maxMana, run.mana);
        fighter.maxMana = run.maxMana;
        fighter.mana = Math.min(fighter.maxMana, run.mana);
        fighter.superGauge = run.superGauge;
        fighter.maxHandSize = run.maxHandSize;
        if (run.lastBonus === "draw" && run.bonusAppliedWave !== wave) drawCards(fighter, 2);
      }
    }
    return nextBattle;
  };
  const [battle, setBattle] = useState<BattleState>(() =>
    createBattleForRoute(battleSeed),
  );
  const [quote, setQuote] = useState<{ text: string; fighterIndex: number } | null>(null);
  const [activeBattleSeed, setActiveBattleSeed] = useState(battleSeed);
  const [settings, setSettings] = useState<GameSettings>(() => defaultSettings());
  const aiDifficulty = runDifficulty ?? settings.aiDifficulty;
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sequence, setSequence] = useState<Direction[]>([]);
  const [grades, setGrades] = useState<InputGrade[]>([]);
  const [now, setNow] = useState(0);
  const [arrowStartedAt, setArrowStartedAt] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [onlineConnected, setOnlineConnected] = useState(
    mode === "online" && (onlineSession?.connection.open ?? false),
  );
  const [onlineReady, setOnlineReady] = useState(
    mode !== "online" || (onlineRole === "host" && onlineSession !== null),
  );
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const qteSessionRef = useRef("");
  const qteLockRef = useRef(false);
  const resultRecordedRef = useRef("");
  const perfectStreakRef = useRef(0);
  const musicControllerRef = useRef<Awaited<ReturnType<typeof startMusic>> | null>(null);
  const routeSeedRef = useRef(battleSeed);
  const battleRef = useRef(battle);
  const qteActionKeyRef = useRef("");
  const zenModeRef = useRef(settings.zenMode);
  const translateRef = useRef(t);
  const pendingQteStartRef = useRef<{ key: string; directions: Direction[] } | null>(null);
  battleRef.current = battle;
  translateRef.current = t;
  const player = battle.combatants[0];
  const enemyIndex = battle.teams[1][0];
  const enemy = battle.combatants[enemyIndex];
  const allies = battle.teams[0].map((index) => battle.combatants[index]);
  const playerCharacter = getCharacter(player.characterId);
  const enemyCharacter = getCharacter(enemy.characterId);
  const onlineLocalIndex = onlineRole === "host" ? 0 : 1;
  const humanAttacking = localPvp
    || (mode === "online" ? battle.attackerIndex === onlineLocalIndex : battle.teams[0].includes(battle.attackerIndex));
  const humanDefending = localPvp
    || (mode === "online" ? battle.defenderIndex === onlineLocalIndex : battle.teams[0].includes(battle.defenderIndex));
  const attackActorIndex = battle.attackerIndex;
  const defenseActorIndex = battle.defenderIndex;
  const isHumanQte = battle.phase === "ATTACK_QTE" ? humanAttacking : humanDefending;
  const isQtePhase = battle.phase === "ATTACK_QTE" || battle.phase === "DEFENSE_QTE";
  const qteLength = isQtePhase ? actionQteLength(battle, battle.phase === "DEFENSE_QTE") : 0;
  const qteFighter = battle.combatants[
    battle.phase === "DEFENSE_QTE"
      ? battle.defenderIndex
      : battle.attackerIndex
  ];
  const perfectOnly = hasPerfectOnlyModifier(qteFighter);
  const currentArrowElapsed = now === 0 ? 0 : Math.max(0, now - arrowStartedAt);
  const chillMultiplier = qteFighter.statuses.some((status) => status.id === "chill") ? 0.75 : 1;
  const hasteMultiplier = qteFighter.statuses.some((status) => status.id === "haste") ? 1.25 : 1;
  const qteTimeFactor = chillMultiplier * hasteMultiplier;
  const arrowDuration = QTE_ARROW_DURATION_MS * qteTimeFactor;
  const perfectWindow = QTE_PERFECT_WINDOW_MS * qteTimeFactor;
  const goodWindow = QTE_GOOD_WINDOW_MS * qteTimeFactor;
  const arrowTimeLeft = Math.max(0, arrowDuration - currentArrowElapsed);
  const qteTotalTime = qteLength * arrowDuration;
  const qteTimePercent = settings.zenMode
    ? 100
    : qteLength === 0 ? 0 : (arrowTimeLeft / QTE_ARROW_DURATION_MS) * 100;
  const qteActionKey = `${battle.phase}:${battle.turn}:${battle.attackerIndex}:${battle.chosenAttack?.kind}:${battle.chosenAttack?.cardId}:${battle.chosenDefense?.kind}:${battle.chosenDefense?.cardId}`;
  qteActionKeyRef.current = qteActionKey;
  zenModeRef.current = settings.zenMode;
  const attackActions = useMemo(
    () => getAvailableActions(battle, attackActorIndex),
    [battle, attackActorIndex],
  );
  const defenseActions = useMemo(
    () => getAvailableActions(battle, defenseActorIndex, true),
    [battle, defenseActorIndex],
  );

  useEffect(() => {
    if (mode !== "online") return;
    if (!onlineSession) {
      setOnlineConnected(false);
      setOnlineReady(false);
      return;
    }
    const { connection, role } = onlineSession;
    setOnlineConnected(connection.open);
    if (role === "host") setOnlineReady(true);
    setOnlineError(null);
    const onData = (payload: unknown) => {
      if (!isOnlineMessage(payload)) return;
      if (payload.type === "leave") {
        setOnlineConnected(false);
        setOnlineError(translateRef.current("online.disconnected"));
        return;
      }
      if (payload.type === "battle-state" && role === "guest") {
        const incoming = payload.state;
        if (!Array.isArray(incoming.combatants) || incoming.combatants.length !== 2
          || !Array.isArray(incoming.teams) || incoming.teams.length !== 2
          || (incoming.phase !== "ATTACK_SELECT" && incoming.phase !== "DEFENSE_SELECT"
            && incoming.phase !== "ATTACK_QTE" && incoming.phase !== "DEFENSE_QTE"
            && incoming.phase !== "BATTLE_END")) {
          setOnlineError(translateRef.current("online.invalidState"));
          return;
        }
        battleRef.current = incoming;
        setBattle(incoming);
        setOnlineReady(true);
        return;
      }
      if (payload.type === "sync-request" && role === "host") {
        if (connection.open) {
          connection.send({ type: "battle-state", state: battleRef.current });
        }
        return;
      }
      if (payload.type === "qte-start" && role === "guest") {
        pendingQteStartRef.current = payload;
        if (payload.key === qteActionKeyRef.current) {
          pendingQteStartRef.current = null;
          qteLockRef.current = false;
          setSequence(payload.directions);
          setGrades([]);
          setNow(0);
          setArrowStartedAt(performance.now());
        }
        return;
      }
      if (role !== "host") return;
      const current = battleRef.current;
      if (payload.type === "action") {
        try {
          if (payload.actor === "attack"
            && current.phase === "ATTACK_SELECT"
            && current.attackerIndex === 1) {
            const next = chooseAttack(current, payload.action);
            battleRef.current = next;
            setBattle(next);
          } else if (payload.actor === "defense"
            && current.phase === "DEFENSE_SELECT"
            && current.defenderIndex === 1) {
            const next = chooseDefense(current, payload.action);
            battleRef.current = next;
            setBattle(next);
          }
        } catch (actionError) {
          setOnlineError(actionError instanceof Error ? actionError.message : translateRef.current("online.invalidAction"));
        }
        return;
      }
      if (payload.type === "qte-result") {
        if ((current.phase !== "ATTACK_QTE" && current.phase !== "DEFENSE_QTE")
          || payload.key !== qteActionKeyRef.current
          || (current.phase === "ATTACK_QTE" ? current.attackerIndex : current.defenderIndex) !== 1
          || payload.grades.length !== actionQteLength(current, current.phase === "DEFENSE_QTE")) {
          setOnlineError(translateRef.current("online.invalidQte"));
          return;
        }
        const result = makeQteResult(payload.grades, zenModeRef.current);
        const next = current.phase === "ATTACK_QTE"
          ? submitAttackQte(current, result)
          : submitDefenseQte(current, result);
        battleRef.current = next;
        setBattle(next);
      }
    };
    const onClose = () => {
      setOnlineConnected(false);
      setOnlineError(translateRef.current("online.disconnected"));
    };
    const onOpen = () => {
      setOnlineConnected(true);
      setOnlineError(null);
    };
    connection.on("data", onData);
    connection.on("close", onClose);
    connection.on("open", onOpen);
    return () => {
      connection.off("data", onData);
      connection.off("close", onClose);
      connection.off("open", onOpen);
    };
  }, [mode, onlineSession]);

  useEffect(() => {
    if (
      mode !== "online"
      || onlineRole !== "guest"
      || !onlineSession
      || !onlineConnected
      || onlineReady
    ) return;
    const requestState = () => {
      sendOnlineMessage({ type: "sync-request" });
    };
    requestState();
    const retry = window.setInterval(requestState, 1000);
    return () => window.clearInterval(retry);
  }, [mode, onlineRole, onlineSession, onlineConnected, onlineReady]);

  useEffect(() => {
    if (mode === "online" && onlineRole === "host" && onlineSession && onlineConnected) {
      sendOnlineMessage({ type: "battle-state", state: battle });
    }
  }, [battle, mode, onlineRole, onlineSession, onlineConnected]);

  useEffect(() => {
    const save = loadSave();
    setSettings(save.settings);
    setTutorialOpen(!save.tutorialSeen);
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    musicControllerRef.current?.setVolume(settings.musicVolume);
  }, [settings.musicVolume]);

  useEffect(() => () => {
    musicControllerRef.current?.stop();
  }, []);

  const toggleMusic = async () => {
    if (musicControllerRef.current) {
      musicControllerRef.current.stop();
      musicControllerRef.current = null;
      setMusicEnabled(false);
      return;
    }
    try {
      musicControllerRef.current = await startMusic(settings.musicVolume);
      setMusicEnabled(true);
      setAudioError(null);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : t("options.audioError"));
    }
  };

  const recordQteStats = useCallback((result: QteResult) => {
    let streak = perfectStreakRef.current;
    for (const grade of result.grades) {
      streak = grade === "perfect" ? streak + 1 : 0;
    }
    perfectStreakRef.current = streak;
    const save = loadSave();
    updateSave({
      records: {
        ...save.records,
        totalPerfects: save.records.totalPerfects + result.perfects,
        bestPerfectStreak: Math.max(save.records.bestPerfectStreak, streak),
      },
    });
  }, []);

  const closeTutorial = () => {
    setTutorialOpen(false);
    updateSave({ tutorialSeen: true });
  };

  useEffect(() => {
    if (routeSeedRef.current === battleSeed) return;
    routeSeedRef.current = battleSeed;
    setBattle(createBattleForRoute(battleSeed));
    setActiveBattleSeed(battleSeed);
    qteSessionRef.current = "";
    resultRecordedRef.current = "";
  }, [battleSeed]);

  useEffect(() => {
    if (mode !== "survival" || wave <= 1) return;
    const run = loadSave().survivalRun;
    if (
      run?.characterId === characterId
      && run.wave === wave
      && run.lastBonus === "draw"
      && run.bonusAppliedWave !== wave
    ) {
      updateSave({ survivalRun: { ...run, bonusAppliedWave: wave } });
    }
  }, [characterId, mode, wave]);

  useEffect(() => {
    if (localPvp || mode === "online" || !settingsLoaded || battle.phase !== "ATTACK_SELECT"
      || !battle.teams[1].includes(battle.attackerIndex)) return;
    setBattle((current) => chooseAiAttack(current, aiDifficulty));
  }, [battle.phase, battle.attackerIndex, battle.teams, aiDifficulty, settingsLoaded, localPvp, mode]);

  useEffect(() => {
    if (localPvp || mode === "online" || !settingsLoaded || battle.phase !== "DEFENSE_SELECT"
      || !battle.teams[1].includes(battle.defenderIndex)) return;
    setBattle((current) => chooseAiDefense(current, aiDifficulty));
  }, [battle.phase, battle.attackerIndex, battle.defenderIndex, battle.teams, aiDifficulty, settingsLoaded, localPvp, mode]);

  // Répliques de personnages : tirage aléatoire par événement.
  useEffect(() => {
    if (battle.phase === "ATTACK_SELECT") {
      const fighter = battle.combatants[battle.attackerIndex];
      const character = getCharacter(fighter.characterId);
      const keys = character.quotes.attack;
      if (keys.length > 0) {
        const key = keys[Math.floor(Math.random() * keys.length)];
        setQuote({ text: t(key), fighterIndex: battle.attackerIndex });
        const timer = window.setTimeout(() => setQuote(null), 2500);
        return () => window.clearTimeout(timer);
      }
    }
    if (battle.phase === "BATTLE_END" && battle.winner !== null) {
      const winnerIndex = battle.winner;
      const loserIndex = winnerIndex === 0 ? 1 : 0;
      const winnerChar = getCharacter(battle.combatants[winnerIndex].characterId);
      const loserChar = getCharacter(battle.combatants[loserIndex].characterId);
      const wKeys = winnerChar.quotes.victory;
      const lKeys = loserChar.quotes.defeat;
      if (wKeys.length > 0) {
        const key = wKeys[Math.floor(Math.random() * wKeys.length)];
        setQuote({ text: t(key), fighterIndex: winnerIndex });
      }
      const timer = window.setTimeout(() => setQuote(null), 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [battle.phase, battle.attackerIndex, battle.winner, t]);

  useEffect(() => {
    if (!isQtePhase || (mode === "online" && (!onlineReady || !onlineConnected))) return;
    if (qteSessionRef.current === qteActionKey) return;
    qteSessionRef.current = qteActionKey;
    qteLockRef.current = false;
    setGrades([]);
    setNow(0);
    if (mode === "online" && onlineRole === "guest") {
      const pending = pendingQteStartRef.current;
      if (pending?.key === qteActionKey) {
        pendingQteStartRef.current = null;
        setSequence(pending.directions);
        setArrowStartedAt(performance.now());
      } else {
        setSequence([]);
      }
      return;
    }
    const qte = createQteSequence(qteLength, qteFighter, Math.random, settings.zenMode);
    setSequence(qte.directions);
    setArrowStartedAt(performance.now());
    if (mode === "online" && onlineRole === "host" && !isHumanQte && qteLength > 0) {
      sendOnlineMessage({
        type: "qte-start",
        key: qteActionKey,
        directions: qte.directions,
      });
      return;
    }
    if (qteLength > 0 && !isHumanQte) {
      if (mode === "online") return;
      setBattle((current) => submitAiQte(
        current,
        current.phase === "DEFENSE_QTE",
        aiDifficulty,
      ));
      return;
    }
    if (qteLength === 0) {
      const result = makeQteResult([]);
      setBattle((current) => current.phase === "ATTACK_QTE"
        ? submitAttackQte(current, result)
        : submitDefenseQte(current, result));
    }
  }, [
    battle.phase,
    mode,
    onlineConnected,
    onlineReady,
    onlineRole,
    battle.attackerIndex,
    battle.chosenAttack?.cardId,
    battle.chosenAttack?.kind,
    battle.chosenDefense?.cardId,
    battle.chosenDefense?.kind,
    qteActionKey,
    qteFighter,
    isHumanQte,
    isQtePhase,
    qteLength,
    aiDifficulty,
    settings.zenMode,
  ]);

  useEffect(() => {
    if (battle.phase !== "BATTLE_END" || activeBattleSeed !== battleSeed) return;
    const resultKey = `${mode}:${chapterId}:${wave}:${battle.winner}:${battle.turn}`;
    if (resultRecordedRef.current === resultKey) return;
    resultRecordedRef.current = resultKey;
    const save = loadSave();
    try {
      playSound(battle.winner === 0 ? "victory" : "defeat", settings.sfxVolume);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : t("options.audioError"));
    }
    const patch: Parameters<typeof updateSave>[0] = {
      records: { ...save.records, totalMatches: save.records.totalMatches + 1 },
    };
    if (mode === "campaign" && chapter && battle.winner === 0) {
      patch.campaign = {
        completedChapters: Array.from(new Set([...save.campaign.completedChapters, chapter.id])).sort((a, b) => a - b),
        unlockedCards: Array.from(new Set([...save.campaign.unlockedCards, ...chapter.unlockCards])),
      };
    }
    if (mode === "survival") {
      patch.records = {
        ...save.records,
        totalMatches: save.records.totalMatches + 1,
        survivalBestWave: Math.max(save.records.survivalBestWave, wave),
      };
      if (battle.winner !== 0) patch.survivalRun = null;
    }
    updateSave(patch);
  }, [battle.phase, battle.winner, battle.turn, mode, chapter, chapterId, wave, activeBattleSeed, battleSeed, settings.sfxVolume, t]);

  const recordGrade = useCallback((grade: InputGrade, currentGrades = grades) => {
    if (qteLockRef.current) return;
    const updated = [...currentGrades, grade];
    setGrades(updated);
    setArrowStartedAt(performance.now());
    if (settings.sfxVolume > 0) {
      void unlockAudio()
        .then(() => playSound(grade, settings.sfxVolume))
        .catch((error: unknown) => {
          setAudioError(error instanceof Error ? error.message : t("options.audioError"));
        });
    }
    if (updated.length !== sequence.length) return;
    qteLockRef.current = true;
    const result: QteResult = makeQteResult(updated, settings.zenMode);
    recordQteStats(result);
    if (mode === "online" && onlineRole === "guest") {
      const sent = sendOnlineMessage({
        type: "qte-result",
        key: qteActionKey,
        grades: updated,
      });
      if (!sent) setOnlineError(t("online.disconnected"));
      return;
    }
    setBattle((current) => current.phase === "ATTACK_QTE"
      ? submitAttackQte(current, result)
      : submitDefenseQte(current, result));
  }, [grades, mode, onlineRole, qteActionKey, recordQteStats, sequence.length, settings.sfxVolume, settings.zenMode, t]);

  const pressDirection = useCallback((direction: Direction) => {
    if (mode === "online" && (!onlineReady || !onlineConnected)) return;
    if (!isQtePhase || !isHumanQte || sequence.length === 0 || grades.length >= sequence.length) return;
    const elapsed = performance.now() - arrowStartedAt;
    const correct = sequence[grades.length] === direction;
    const grade: InputGrade = !correct || elapsed > goodWindow
      ? "miss"
      : settings.zenMode || perfectOnly || elapsed <= perfectWindow
        ? "perfect"
        : "good";
    recordGrade(grade);
  }, [
    arrowStartedAt,
    grades.length,
    isHumanQte,
    isQtePhase,
    mode,
    onlineConnected,
    onlineReady,
    goodWindow,
    perfectWindow,
    perfectOnly,
    recordGrade,
    sequence,
    settings.zenMode,
  ]);

  useEffect(() => {
    if (!isQtePhase || !isHumanQte || settings.zenMode || qteLength === 0) return;
    const timer = window.setInterval(() => {
      const time = performance.now();
      setNow(time);
      if (time - arrowStartedAt >= arrowDuration) {
        window.clearInterval(timer);
        recordGrade("miss");
      }
    }, 40);
    return () => window.clearInterval(timer);
  }, [arrowDuration, arrowStartedAt, isHumanQte, isQtePhase, qteLength, recordGrade, settings.zenMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowRight: "right",
        ArrowDown: "down",
        ArrowLeft: "left",
      };
      const mapped = direction[event.key];
      if (!mapped) return;
      event.preventDefault();
      pressDirection(mapped);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressDirection]);

  const playAction = (action: ChosenAction, defending: boolean) => {
    if (mode === "online" && (!onlineReady || !onlineConnected)) return;
    if (settings.sfxVolume > 0) {
      void unlockAudio()
        .then(() => playSound("click", settings.sfxVolume))
        .catch((error: unknown) => {
          setAudioError(error instanceof Error ? error.message : t("options.audioError"));
        });
    }
    if (mode === "online" && onlineRole === "guest") {
      const sent = sendOnlineMessage({
        type: "action",
        actor: defending ? "defense" : "attack",
        action,
      });
      if (!sent) setOnlineError(t("online.disconnected"));
      return;
    }
    setBattle((current) => defending
      ? chooseDefense(current, action)
      : chooseAttack(current, action));
  };

  const actionLabel = (action: ChosenAction, defending: boolean, fighterIndex: number) => {
    const character = getCharacter(battle.combatants[fighterIndex].characterId);
    if (action.kind === "basic-attack") return t("battle.basicAttack");
    if (action.kind === "basic-guard") return t("battle.basicGuard");
    if (action.kind === "ultimate") return t("battle.ultimate");
    if (action.kind === "super-activate") return t("battle.activateSuper");
    if (action.kind === "ability") {
      return t((defending ? character.abilityDefense : character.abilityAttack).nameKey);
    }
    if (action.kind === "card" && action.cardId) return t(getCard(action.cardId).nameKey);
    return t("battle.noAction");
  };

  const renderActionButton = (
    action: ChosenAction,
    index: number,
    defending: boolean,
    fighterIndex: number,
  ) => {
    const fighter = battle.combatants[fighterIndex];
    const character = getCharacter(fighter.characterId);
    const card = action.kind === "card" && action.cardId ? getCard(action.cardId) : null;
    const cost = getEffectiveActionCost(battle, fighterIndex, action, defending);
    const isUltimate = action.kind === "ultimate";
    const ability = action.kind === "ability"
      ? (defending ? character.abilityDefense : character.abilityAttack)
      : null;
    const disabled = battle.phase === "BATTLE_END";
    return (
      <button
        key={`${action.kind}-${action.cardId ?? "base"}-${index}`}
        onClick={() => playAction(action, defending)}
        disabled={disabled}
        className="flex min-h-20 flex-col justify-between rounded-lg border border-night-600 bg-night-800/80 p-3 text-left transition hover:border-neon-blue hover:bg-night-700 disabled:opacity-50"
      >
        <span className="font-display font-semibold">{actionLabel(action, defending, fighterIndex)}</span>
        <span className="mt-2 text-xs text-night-600">
          {card?.descriptionKey ? t(card.descriptionKey) : ability?.descriptionKey ? t(ability.descriptionKey) : ""}
          {cost && Object.keys(cost).length > 0 && (
            <span className="mt-1 block text-neon-blue">
              {cost.energy ? `${t("common.energy")} ${cost.energy} ` : ""}
              {cost.mana ? `${t("common.mana")} ${cost.mana} ` : ""}
              {cost.hp ? `${t("common.hp")} ${cost.hp}` : ""}
            </span>
          )}
          {isUltimate && <span className="mt-1 block text-neon-yellow">{t("battle.superReady")}</span>}
          {ability && (
            <span className="mt-1 block text-night-600">
              {t("select.cooldown", { n: fighter.cooldowns[ability.id] ?? 0 })}
            </span>
          )}
        </span>
      </button>
    );
  };

  const renderFighter = (
    fighter: typeof player,
    character: typeof playerCharacter,
    playerLabel: string,
    key: string,
  ) => (
    <section key={key} className="rounded-xl border bg-night-800/50 p-4" style={{ borderColor: `${character.accent}88` }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold" style={{ color: character.accent }}>
            {t(character.nameKey)}
          </h2>
          <p className="text-xs text-night-600">{playerLabel}</p>
        </div>
        <span className="text-sm">{Math.max(0, fighter.hp)} / {fighter.maxHp} {t("common.hp")}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-night-950">
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.max(0, (fighter.hp / fighter.maxHp) * 100)}%`,
            backgroundColor: character.accent,
          }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>{t("common.energy")}: {fighter.energy}/{fighter.maxEnergy}</div>
        <div>{t("common.mana")}: {fighter.mana}/{fighter.maxMana}</div>
        <div>{t("common.superGauge")}: {fighter.superGauge}%</div>
      </div>
      {fighter.superTurnsLeft > 0 && (
        <div className="mt-2 rounded bg-neon-yellow/20 px-2 py-1 text-xs font-semibold text-neon-yellow">
          {t("battle.superActive")} ({fighter.superTurnsLeft})
        </div>
      )}
      <p className="mt-3 text-xs text-night-600">
        {t(character.mechanicDescriptionKey)}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-night-600">
        <span>
          {t(character.abilityAttack.nameKey)} · {t("select.cooldown", {
            n: fighter.cooldowns[character.abilityAttack.id] ?? 0,
          })}
        </span>
        <span>
          {t(character.abilityDefense.nameKey)} · {t("select.cooldown", {
            n: fighter.cooldowns[character.abilityDefense.id] ?? 0,
          })}
        </span>
      </div>
      <div className="mt-3 flex min-h-7 flex-wrap gap-2">
        {fighter.statuses.map((status) => (
          <span
            key={status.id}
            className="rounded-full border px-2 py-1 text-xs"
            style={{ borderColor: STATUSES[status.id].color, color: STATUSES[status.id].color }}
            title={t(STATUSES[status.id].descriptionKey)}
          >
            {t(STATUSES[status.id].nameKey)}{status.stacks > 1 ? ` ×${status.stacks}` : ""}
          </span>
        ))}
      </div>
    </section>
  );

  const phaseLabel = battle.phase === "ATTACK_SELECT"
    ? localPvp
      ? t("pvp.playerTurn", { n: battle.attackerIndex + 1 })
      : mode === "online"
        ? t("pvp.playerTurn", { n: battle.attackerIndex + 1 })
      : cooperative && humanAttacking
        ? t("pvp.playerTurn", { n: battle.teams[0].indexOf(battle.attackerIndex) + 1 })
        : humanAttacking ? t("battle.playerAttack") : t("battle.enemyAttack")
    : battle.phase === "DEFENSE_SELECT"
      ? localPvp
        ? t("pvp.playerTurn", { n: defenseActorIndex + 1 })
        : mode === "online"
          ? t("pvp.playerTurn", { n: defenseActorIndex + 1 })
        : cooperative && humanDefending
          ? t("pvp.playerTurn", { n: battle.teams[0].indexOf(defenseActorIndex) + 1 })
        : humanDefending ? t("battle.playerDefense") : t("battle.enemyDefense")
      : battle.phase === "BATTLE_END" ? t("battle.gameOver") : t("qte.go");
  const survivalBonusChoices = mode === "survival"
    ? Array.from({ length: 3 }, (_, index) =>
      SURVIVAL_BONUSES[(wave - 1 + index * 2) % SURVIVAL_BONUSES.length],
    )
    : [];

  const continueSurvival = (bonusId: string) => {
    const fighter = battle.combatants[0];
    const existing = loadSave().survivalRun;
    const previousRun = existing?.characterId === characterId && existing.wave === wave
      ? existing
      : null;
    const deck = previousRun?.deck
      ?? (loadSave().customDecks[characterId]
        && validateCharacterDeck(characterId, loadSave().customDecks[characterId]).ok
        ? loadSave().customDecks[characterId]
        : getCharacter(characterId).recommendedDeck);
    const run = {
      characterId,
      wave: wave + 1,
      hp: fighter.hp,
      maxHp: fighter.maxHp,
      energy: fighter.energy,
      maxEnergy: fighter.maxEnergy,
      mana: fighter.mana,
      maxMana: fighter.maxMana,
      superGauge: fighter.superGauge,
      maxHandSize: fighter.maxHandSize,
      deck: [...deck],
      bonuses: [...(previousRun?.bonuses ?? []), bonusId],
      lastBonus: bonusId,
      bonusAppliedWave: 0,
    };
    if (bonusId === "heal") run.hp = Math.min(run.maxHp, run.hp + 25);
    if (bonusId === "max-energy") {
      run.maxEnergy += 3;
      run.energy = Math.min(run.maxEnergy, run.energy + 3);
    }
    if (bonusId === "max-mana") {
      run.maxMana += 3;
      run.mana = Math.min(run.maxMana, run.mana + 3);
    }
    if (bonusId === "hand-size") run.maxHandSize += 1;
    if (bonusId === "super") run.superGauge = Math.min(100, run.superGauge + 20);
    updateSave({ survivalRun: run });
    router.push(`/game?mode=survival&character=${characterId}&wave=${wave + 1}`);
  };

  return (
    <main className="game-shell mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 py-6 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="neon-title font-display text-3xl font-bold tracking-widest">{t("app.title")}</h1>
          <p className="mt-1 text-sm text-night-600">
            {localPvp
              ? t("pvp.subtitle")
              : mode === "survival"
                ? `${t("survival.wave", { n: wave })} · ${t(`battle.aiDifficulty.${aiDifficulty}`)}`
                : mode === "campaign" && chapter
                  ? `${t("campaign.chapter", { n: chapter.id })} · ${t(`battle.aiDifficulty.${aiDifficulty}`)}`
                  : cooperative
                    ? `${t("coop.subtitle")} · ${t(`battle.aiDifficulty.${aiDifficulty}`)}`
                    : mode === "online"
                      ? `${t("online.title")} · ${t(`online.${onlineRole}`)}`
                  : `${t("common.turn", { n: battle.turn })} · ${t(`battle.aiDifficulty.${aiDifficulty}`)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleMusic()}
            aria-pressed={musicEnabled}
            className="rounded-lg border border-night-600 px-3 py-2 text-sm hover:border-neon-blue"
          >
            {musicEnabled ? t("options.stopMusicPreview") : t("options.musicPreview")}
          </button>
          <button
            type="button"
            onClick={() => {
              setTutorialStep(0);
              setTutorialOpen(true);
            }}
            className="rounded-lg border border-night-600 px-3 py-2 text-sm hover:border-neon-blue"
          >
            {t("tutorial.reopen")}
          </button>
          <Link
            href={mode === "online" ? "/online" : "/"}
            onClick={() => {
              if (mode === "online") closeOnlineSession();
            }}
            className="rounded-lg border border-night-600 px-4 py-2 text-sm hover:border-neon-blue"
          >
            ← {mode === "online" ? t("online.leave") : t("battle.exit")}
          </Link>
        </div>
      </header>
      {audioError && <p role="alert" className="text-sm text-neon-red">{audioError}</p>}
      {mode === "online" && !onlineSession && (
        <p role="alert" className="rounded-lg border border-neon-red/50 p-3 text-sm text-neon-red">
          {t("online.noSession")}
        </p>
      )}
      {mode === "online" && onlineError && (
        <p role="alert" className="rounded-lg border border-neon-red/50 p-3 text-sm text-neon-red">
          {onlineError}
        </p>
      )}
      <BattleScene
        player={playerCharacter}
        partner={cooperative ? getCharacter(battle.combatants[battle.teams[0][1]].characterId) : undefined}
        enemy={enemyCharacter}
        turn={battle.turn}
        impactKey={battle.history.attackerActions.length}
      />

      <section className={`grid gap-3 ${cooperative ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {battle.combatants.map((fighter, index) => renderFighter(
          fighter,
          getCharacter(fighter.characterId),
          localPvp
            ? t("pvp.player", { n: index + 1 })
          : mode === "online"
            ? index === onlineLocalIndex ? t("common.you") : t("common.enemy")
          : cooperative && battle.teams[0].includes(index)
              ? t("pvp.player", { n: battle.teams[0].indexOf(index) + 1 })
              : index === enemyIndex ? t("common.enemy") : t("common.you"),
            `fighter-${index}-${fighter.characterId}`,
        ))}
      </section>

      <section className="combat-controls rounded-xl border border-night-700 bg-night-800/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">{phaseLabel}</h2>
          <span className="rounded-full border border-neon-blue/50 px-3 py-1 text-xs text-neon-blue">
            {mode}
          </span>
          {(battle.combatants.some((fighter) => fighter.statuses.some((status) => status.id === "stun"))) && (
            <span className="rounded-full border border-neon-yellow/50 bg-neon-yellow/10 px-3 py-1 text-xs text-neon-yellow">
              {t("battle.stunned")}
            </span>
          )}
          {quote && (
            <span className="rounded-full border border-neon-blue/50 bg-neon-blue/10 px-3 py-1 text-xs italic text-neon-blue">
              “{quote.text}”
            </span>
          )}
        </div>

        {mode === "online" && !onlineConnected ? (
          <p role="status" className="text-sm text-neon-yellow">{t("online.disconnected")}</p>
        ) : mode === "online" && !onlineReady ? (
          <p role="status" className="text-sm text-neon-blue">{t("online.waitingForSync")}</p>
        ) : battle.phase === "BATTLE_END" ? (
          <div className="flex flex-wrap gap-3">
            <p className="w-full text-lg">
              {localPvp
                ? t("pvp.winner", { n: (battle.winner ?? 0) + 1 })
                : mode === "online"
                  ? t("pvp.winner", { n: (battle.winner ?? 0) + 1 })
                : battle.winner === 0 ? t("battle.youWin") : t("battle.youLose")}
            </p>
            {mode === "campaign" && chapter && (
              <p className="w-full text-sm text-night-600">
                {t(battle.winner === 0 ? chapter.victoryKey : chapter.defeatKey)}
              </p>
            )}
            {mode === "survival" && battle.winner === 0 && (
              <div className="grid w-full gap-3 sm:grid-cols-3">
                {survivalBonusChoices.map((bonus) => (
                  <button
                    key={bonus.id}
                    type="button"
                    onClick={() => continueSurvival(bonus.id)}
                    className="rounded-lg border border-night-600 bg-night-900 p-4 text-left hover:border-neon-green"
                  >
                    <span className="block font-display font-semibold text-neon-green">{t(bonus.nameKey)}</span>
                    <span className="mt-1 block text-sm text-night-600">{t(bonus.descriptionKey)}</span>
                  </button>
                ))}
              </div>
            )}
            {mode === "survival" && battle.winner !== 0 && (
              <p className="w-full text-sm text-night-600">{t("survival.gameOver")}</p>
            )}
            {mode === "campaign" && battle.winner === 0 && chapter && chapter.id < 8 && (
              <Link href="/campaign" className="rounded-lg bg-neon-blue px-4 py-2 font-semibold text-night-950">
                {t("campaign.nextChapter")}
              </Link>
            )}
            {mode === "campaign" && chapter?.id === 8 && battle.winner === 0 && (
              <Link href="/campaign" className="rounded-lg bg-neon-green px-4 py-2 font-semibold text-night-950">
                {t("campaign.complete")}
              </Link>
            )}
            {mode === "local-pvp" && (
              <Link href="/pvp" className="rounded-lg bg-neon-blue px-4 py-2 font-semibold text-night-950">
                {t("battle.retry")}
              </Link>
            )}
            {cooperative && (
              <Link href="/coop" className="rounded-lg bg-neon-yellow px-4 py-2 font-semibold text-night-950">
                {t("battle.retry")}
              </Link>
            )}
            {mode === "online" && (
              <Link href="/online" onClick={closeOnlineSession} className="rounded-lg bg-neon-blue px-4 py-2 font-semibold text-night-950">
                {t("battle.retry")}
              </Link>
            )}
            {mode === "survival" && (
              <Link href="/select?mode=survival" className="rounded-lg bg-neon-blue px-4 py-2 font-semibold text-night-950">
                {t("battle.retry")}
              </Link>
            )}
            <Link
              href="/"
              onClick={mode === "online" ? closeOnlineSession : undefined}
              className="rounded-lg border border-night-600 px-4 py-2"
            >
              {mode === "online" ? t("online.leave") : `${t("menu.options")}: ${t("battle.exit")}`}
            </Link>
          </div>
        ) : isQtePhase && isHumanQte ? (
          <div>
            <p className="mb-3 text-sm text-night-600">{t("battle.qteHint")}</p>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-neon-green">{t("battle.qtePerfectWindow")}: 0–{Math.round(perfectWindow)}ms</span>
              <span className="text-neon-yellow">{t("battle.qteGoodWindow")}: {Math.round(perfectWindow) + 1}–{Math.round(goodWindow)}ms</span>
              <span className="text-neon-red">{t("battle.qteMissWindow")}: {Math.round(goodWindow) + 1}–{Math.round(arrowDuration)}ms</span>
            </div>
            {perfectOnly && <p className="mb-2 text-sm text-neon-yellow">{t("battle.qtePerfectOnly")}</p>}
            {settings.zenMode ? (
              <p className="mb-3 text-sm text-neon-blue">{t("battle.qteZen")}</p>
            ) : (
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-xs text-night-600">
                  <span>{t("battle.qteTimed", { seconds: (arrowTimeLeft / 1000).toFixed(1) })}</span>
                  <span>{t("battle.qteTotalTime", { seconds: Math.ceil(qteTotalTime / 1000) })}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-night-950">
                  <div
                    className={`h-full transition-[width] duration-75 ${arrowTimeLeft < 250 ? "bg-neon-red" : "bg-neon-blue"}`}
                    style={{ width: `${qteTimePercent}%` }}
                  />
                </div>
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-2" aria-label="QTE sequence">
              {sequence.map((direction, index) => (
                <span
                  key={`${direction}-${index}`}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border text-xl ${
                    index < grades.length
                      ? grades[index] === "perfect"
                        ? "border-neon-green text-neon-green"
                        : grades[index] === "good"
                          ? "border-neon-yellow text-neon-yellow"
                          : "border-neon-red text-neon-red"
                      : index === grades.length
                        ? "border-neon-blue bg-neon-blue/10 text-white"
                        : "border-night-600 text-night-600"
                  }`}
                >
                  {ARROWS[direction]}
                </span>
              ))}
            </div>
            <p className="mb-3 text-sm text-night-600" aria-live="polite">
              {t("battle.qteProgress", { done: grades.length, total: sequence.length })}
            </p>
            <div className="grid max-w-sm grid-cols-3 gap-2">
              {(["up", "left", "down", "right"] as Direction[]).map((direction) => (
                <button
                  key={direction}
                  onClick={() => pressDirection(direction)}
                  className={`h-12 rounded-lg border border-night-600 bg-night-900 text-2xl hover:border-neon-blue ${
                    direction === "up" ? "col-start-2" : direction === "left" ? "col-start-1" : direction === "down" ? "col-start-2" : "col-start-3 row-start-2"
                  }`}
                  aria-label={direction}
                >
                  {ARROWS[direction]}
                </button>
              ))}
            </div>
          </div>
        ) : battle.phase === "ATTACK_SELECT" && humanAttacking ? (
          <div>
            <p className="mb-3 text-sm text-night-600">
              {localPvp
                ? t("pvp.playerTurn", { n: attackActorIndex + 1 })
                : mode === "online"
                  ? t("pvp.playerTurn", { n: attackActorIndex + 1 })
                : cooperative && humanAttacking
                  ? t("pvp.playerTurn", { n: battle.teams[0].indexOf(attackActorIndex) + 1 })
                : t("battle.chooseAttack")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {attackActions.map((action, index) => renderActionButton(action, index, false, attackActorIndex))}
            </div>
            {battle.combatants[attackActorIndex].hand.length === 0 && (
              <p className="mt-3 text-sm text-night-600">{t("battle.handEmpty")}</p>
            )}
          </div>
        ) : battle.phase === "DEFENSE_SELECT" && humanDefending ? (
          <div>
            <p className="mb-3 text-sm text-night-600">
              {localPvp
                ? t("pvp.playerTurn", { n: defenseActorIndex + 1 })
                : mode === "online"
                  ? t("pvp.playerTurn", { n: defenseActorIndex + 1 })
                : cooperative && humanDefending
                  ? t("pvp.playerTurn", { n: battle.teams[0].indexOf(defenseActorIndex) + 1 })
                : t("battle.chooseDefense")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {defenseActions.map((action, index) => renderActionButton(action, index, true, defenseActorIndex))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-night-600">
            {mode === "online" && isQtePhase
              ? t("online.opponentQte")
              : mode === "online" && !onlineConnected
                ? t("online.disconnected")
                : mode === "online" ? t("online.waitingForOpponent") : `${phaseLabel}…`}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-night-700 bg-night-800/30 p-4">
        {(localPvp
          ? battle.combatants
          : cooperative
            ? allies
            : mode === "online" ? [battle.combatants[onlineLocalIndex]] : [player]
        ).map((fighter, fighterIndex) => (
          <div key={fighter.characterId} className="mb-3 last:mb-0">
            <h2 className="mb-2 font-display text-lg font-semibold">
              {localPvp || cooperative
                ? t("pvp.player", { n: fighterIndex + 1 })
                : t("battle.hand")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {fighter.hand.map((cardId, index) => {
                const card = getCard(cardId);
                return (
                  <span key={`${cardId}-${index}`} className="rounded border border-night-700 px-2 py-1 text-xs text-night-600">
                    {t(card.nameKey)}
                  </span>
                );
              })}
              {fighter.hand.length === 0 && <span className="text-sm text-night-600">—</span>}
            </div>
            <p className="mt-2 text-xs text-night-600">
              {t("battle.drawPile", { n: fighter.drawPile.length })} · {t("battle.discardPile", { n: fighter.discardPile.length })}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-night-700 bg-night-800/30 p-4">
        <h2 className="mb-2 font-display text-lg font-semibold">{t("battle.combatLog")}</h2>
        <ol className="flex flex-col gap-1 text-sm text-night-600">
          {battle.log.slice(-6).map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
        </ol>
      </section>

      {tutorialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="battle-tutorial-title"
            className="w-full max-w-lg rounded-2xl border border-neon-blue/70 bg-night-900 p-6 shadow-2xl"
          >
            <p className="mb-2 text-xs uppercase tracking-widest text-neon-blue">
              {tutorialStep + 1} / 5
            </p>
            <h2 id="battle-tutorial-title" className="mb-4 font-display text-2xl font-bold">
              {t("app.title")}
            </h2>
            <p className="min-h-20 leading-relaxed text-night-100">
              {t([
                "tutorial.welcome",
                "tutorial.phases",
                "tutorial.qte",
                "tutorial.super",
                "tutorial.statuses",
              ][tutorialStep])}
            </p>
            <div className="mt-6 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={closeTutorial}
                className="rounded-lg border border-night-600 px-3 py-2 text-sm text-night-600 hover:text-white"
              >
                {t("tutorial.skip")}
              </button>
              <div className="flex gap-2">
                {tutorialStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setTutorialStep((step) => step - 1)}
                    className="rounded-lg border border-night-600 px-3 py-2 text-sm"
                  >
                    {t("tutorial.previous")}
                  </button>
                )}
                {tutorialStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setTutorialStep((step) => step + 1)}
                    className="rounded-lg bg-neon-blue px-4 py-2 text-sm font-semibold text-night-950"
                  >
                    {t("tutorial.next")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeTutorial}
                    className="rounded-lg bg-neon-green px-4 py-2 text-sm font-semibold text-night-950"
                  >
                    {t("tutorial.finish")}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">ARROWFALL</main>}>
      <GameContent />
    </Suspense>
  );
}
