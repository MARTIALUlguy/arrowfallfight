"use client";

import type { DataConnection, Peer } from "peerjs";
import type { BattleState, ChosenAction, Direction, InputGrade } from "@/types";

export type OnlineMessage =
  | { type: "hello"; characterId: string }
  | { type: "sync-request" }
  | { type: "battle-state"; state: BattleState }
  | { type: "action"; actor: "attack" | "defense"; action: ChosenAction }
  | { type: "qte-start"; key: string; directions: Direction[] }
  | { type: "qte-result"; key: string; grades: InputGrade[] }
  | { type: "leave" };

export interface OnlineSession {
  peer: Peer;
  connection: DataConnection;
  role: "host" | "guest";
  localCharacterId: string;
  remoteCharacterId: string;
}

let activeSession: OnlineSession | null = null;

export function createOnlinePeer(): Promise<Peer> {
  return import("peerjs").then(({ Peer: PeerConstructor }) => {
    const host = process.env.NEXT_PUBLIC_PEER_HOST || "0.peerjs.com";
    const cloudServer = host === "0.peerjs.com";
    const portSetting = process.env.NEXT_PUBLIC_PEER_PORT;
    const parsedPort = portSetting ? Number(portSetting) : cloudServer ? 443 : 9000;
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw new Error("Configuration invalide : NEXT_PUBLIC_PEER_PORT doit être compris entre 1 et 65535.");
    }
    const path = process.env.NEXT_PUBLIC_PEER_PATH || (cloudServer ? "/" : "/peerjs");
    const secure = process.env.NEXT_PUBLIC_PEER_SECURE !== "false";
    const key = process.env.NEXT_PUBLIC_PEER_KEY || "peerjs";
    return new PeerConstructor({
      host,
      port: parsedPort,
      path,
      secure,
      key,
      debug: process.env.NODE_ENV === "development" ? 1 : 0,
    });
  });
}

export function connectToPeer(peer: Peer, roomId: string): DataConnection {
  return peer.connect(roomId, {
    label: "arrowfall-online",
    reliable: true,
    serialization: "json",
  });
}

export function setOnlineSession(session: OnlineSession): void {
  activeSession = session;
}

export function getOnlineSession(): OnlineSession | null {
  return activeSession;
}

export function sendOnlineMessage(message: OnlineMessage): boolean {
  const session = activeSession;
  if (!session || !session.connection.open) return false;
  session.connection.send(message);
  return true;
}

export function closeOnlineSession(): void {
  if (!activeSession) return;
  if (activeSession.connection.open) {
    activeSession.connection.send({ type: "leave" } satisfies OnlineMessage);
  }
  activeSession.connection.close();
  activeSession.peer.destroy();
  activeSession = null;
}

export function isOnlineMessage(value: unknown): value is OnlineMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "hello":
      return typeof message.characterId === "string";
    case "sync-request":
      return true;
    case "battle-state":
      return isBattleState(message.state);
    case "action":
      return (message.actor === "attack" || message.actor === "defense")
        && typeof message.action === "object"
        && message.action !== null
        && "kind" in message.action;
    case "qte-start":
      return typeof message.key === "string"
        && Array.isArray(message.directions)
        && message.directions.every((direction) =>
          direction === "up" || direction === "down" || direction === "left" || direction === "right",
        );
    case "qte-result":
      return typeof message.key === "string"
        && Array.isArray(message.grades)
        && message.grades.every((grade) => grade === "perfect" || grade === "good" || grade === "miss");
    case "leave":
      return true;
    default:
      return false;
  }
}

function isBattleState(value: unknown): value is BattleState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  const combatants = state.combatants;
  const teams = state.teams;
  const history = state.history;
  const phases = ["ATTACK_SELECT", "DEFENSE_SELECT", "ATTACK_QTE", "DEFENSE_QTE", "BATTLE_END"];
  if (
    !phases.includes(String(state.phase))
    || !Array.isArray(combatants)
    || combatants.length !== 2
    || !combatants.every((fighter) => typeof fighter === "object" && fighter !== null
      && typeof (fighter as Record<string, unknown>).characterId === "string"
      && typeof (fighter as Record<string, unknown>).hp === "number"
      && typeof (fighter as Record<string, unknown>).maxHp === "number"
      && Array.isArray((fighter as Record<string, unknown>).hand)
      && Array.isArray((fighter as Record<string, unknown>).statuses))
    || !Array.isArray(teams)
    || teams.length !== 2
    || !teams.every((team) => Array.isArray(team) && team.length === 1
      && (team[0] === 0 || team[0] === 1))
    || teams[0][0] === teams[1][0]
    || !Number.isInteger(state.attackerIndex)
    || !Number.isInteger(state.defenderIndex)
    || (state.attackerIndex !== 0 && state.attackerIndex !== 1)
    || (state.defenderIndex !== 0 && state.defenderIndex !== 1)
    || !Number.isInteger(state.turn)
    || !Array.isArray(state.log)
    || typeof history !== "object"
    || history === null
    || !Array.isArray((history as Record<string, unknown>).attackerActions)
    || !Array.isArray((history as Record<string, unknown>).defenderActions)
  ) {
    return false;
  }
  return true;
}
