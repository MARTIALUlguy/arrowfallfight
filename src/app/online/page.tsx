"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CHARACTERS } from "@/data/characters";
import { useI18n } from "@/systems/i18n";
import {
  closeOnlineSession,
  connectToPeer,
  createOnlinePeer,
  isOnlineMessage,
  setOnlineSession,
} from "@/systems/online-session";
import type { DataConnection, Peer } from "peerjs";

type LobbyState = "idle" | "starting" | "waiting" | "connecting" | "error";

const ONLINE_CHARACTERS = CHARACTERS.filter((character) => character.id !== "vorn");

function isCharacterId(value: string): boolean {
  return ONLINE_CHARACTERS.some((character) => character.id === value);
}

export default function OnlinePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [role, setRole] = useState<"host" | "guest">("host");
  const [characterId, setCharacterId] = useState("kael");
  const [roomInput, setRoomInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [state, setState] = useState<LobbyState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const routedRef = useRef(false);

  const resetAttempt = () => {
    closeOnlineSession();
    connectionRef.current?.close();
    peerRef.current?.destroy();
    connectionRef.current = null;
    peerRef.current = null;
    routedRef.current = false;
    setRoomId("");
    setError(null);
    setState("idle");
  };

  const showConnectionError = (message: string) => {
    if (routedRef.current) return;
    routedRef.current = true;
    setError(message);
    setState("error");
    connectionRef.current?.close();
    peerRef.current?.destroy();
    connectionRef.current = null;
    peerRef.current = null;
  };

  const enterGame = (
    peer: Peer,
    connection: DataConnection,
    remoteCharacterId: string,
    activeRoomId: string,
  ) => {
    if (routedRef.current) return;
    if (!isCharacterId(remoteCharacterId)) {
      showConnectionError(t("online.invalidOpponent"));
      return;
    }
    routedRef.current = true;
    setOnlineSession({
      peer,
      connection,
      role,
      localCharacterId: characterId,
      remoteCharacterId,
    });
    router.push(
      `/game?mode=online&role=${role}&character=${characterId}&opponent=${remoteCharacterId}&room=${encodeURIComponent(activeRoomId)}`,
    );
  };

  const startHost = async () => {
    resetAttempt();
    setState("starting");
    try {
      const peer = await createOnlinePeer();
      peerRef.current = peer;
      peer.on("open", (id) => {
        setRoomId(id);
        setState("waiting");
      });
      peer.on("connection", (connection) => {
        if (connectionRef.current || routedRef.current) {
          connection.close();
          return;
        }
        connectionRef.current = connection;
        connection.on("open", () => setState("connecting"));
        connection.on("data", (payload) => {
          if (!isOnlineMessage(payload) || payload.type !== "hello") return;
          connection.send({ type: "hello", characterId } satisfies Parameters<typeof connection.send>[0]);
          enterGame(peer, connection, payload.characterId, peer.id);
        });
        connection.on("error", (connectionError) => {
          showConnectionError(connectionError.message || t("online.connectionFailed"));
        });
        connection.on("close", () => {
          if (!routedRef.current) showConnectionError(t("online.connectionClosed"));
        });
      });
      peer.on("error", (peerError) => {
        showConnectionError(peerError.message || t("online.serverUnavailable"));
      });
      peer.on("disconnected", () => {
        if (!routedRef.current) showConnectionError(t("online.serverUnavailable"));
      });
    } catch (startError) {
      showConnectionError(startError instanceof Error ? startError.message : t("online.serverUnavailable"));
    }
  };

  const joinRoom = async () => {
    const normalizedRoomId = roomInput.trim();
    if (!/^[a-zA-Z0-9_-]{3,100}$/.test(normalizedRoomId)) {
      setError(t("online.invalidRoom"));
      setState("error");
      return;
    }
    resetAttempt();
    setRoomId(normalizedRoomId);
    setState("starting");
    try {
      const peer = await createOnlinePeer();
      peerRef.current = peer;
      peer.on("open", () => {
        setState("connecting");
        const connection = connectToPeer(peer, normalizedRoomId);
        connectionRef.current = connection;
        connection.on("open", () => {
          connection.send({ type: "hello", characterId } satisfies Parameters<typeof connection.send>[0]);
        });
        connection.on("data", (payload) => {
          if (!isOnlineMessage(payload) || payload.type !== "hello") return;
          enterGame(peer, connection, payload.characterId, normalizedRoomId);
        });
        connection.on("error", (connectionError) => {
          showConnectionError(connectionError.message || t("online.connectionFailed"));
        });
        connection.on("close", () => {
          if (!routedRef.current) showConnectionError(t("online.connectionClosed"));
        });
      });
      peer.on("error", (peerError) => {
        showConnectionError(peerError.message || t("online.serverUnavailable"));
      });
      peer.on("disconnected", () => {
        if (!routedRef.current) showConnectionError(t("online.serverUnavailable"));
      });
    } catch (joinError) {
      showConnectionError(joinError instanceof Error ? joinError.message : t("online.serverUnavailable"));
    }
  };

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(t("online.copyFailed"));
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="neon-title font-display text-3xl font-bold tracking-widest">
          {t("online.title")}
        </h1>
        <Link href="/" onClick={resetAttempt} className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>
      <p className="text-sm text-night-600">{t("online.subtitle")}</p>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-night-700 bg-night-800/60 p-2">
        {(["host", "guest"] as const).map((nextRole) => (
          <button
            key={nextRole}
            type="button"
            disabled={state === "starting" || state === "waiting" || state === "connecting"}
            onClick={() => {
              setRole(nextRole);
              setError(null);
              setState("idle");
            }}
            aria-pressed={role === nextRole}
            className={`rounded-lg px-3 py-2 font-semibold ${role === nextRole ? "bg-neon-blue text-night-950" : "text-night-600"}`}
          >
            {t(`online.${nextRole}`)}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-2 rounded-xl border border-night-700 bg-night-800/60 p-4">
        <span className="font-display text-lg">{t("online.yourCharacter")}</span>
        <select
          value={characterId}
          onChange={(event) => setCharacterId(event.target.value)}
          disabled={state === "starting" || state === "waiting" || state === "connecting"}
          className="rounded-lg border border-night-600 bg-night-900 px-3 py-2"
        >
          {ONLINE_CHARACTERS.map((character) => (
            <option key={character.id} value={character.id}>{t(character.nameKey)}</option>
          ))}
        </select>
      </label>

      {role === "host" ? (
        <section className="flex flex-col gap-3 rounded-xl border border-night-700 bg-night-800/60 p-5">
          <h2 className="font-display text-xl font-semibold">{t("online.createRoom")}</h2>
          <p className="text-sm text-night-600">{t("online.hostDescription")}</p>
          {roomId && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-night-950 p-3 text-neon-blue">{roomId}</code>
              <button
                type="button"
                onClick={() => void copyRoom()}
                className="rounded-lg border border-night-600 px-3 py-2 text-sm hover:border-neon-blue"
              >
                {copied ? t("online.copied") : t("online.copy")}
              </button>
            </div>
          )}
          {state !== "waiting" && state !== "connecting" && (
            <button
              type="button"
              onClick={() => void startHost()}
              className="rounded-lg bg-neon-blue px-5 py-3 font-display text-lg font-semibold text-night-950"
            >
              {state === "starting" ? t("online.connecting") : t("online.create")}
            </button>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-night-700 bg-night-800/60 p-5">
          <h2 className="font-display text-xl font-semibold">{t("online.joinRoom")}</h2>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-night-600">{t("online.roomCode")}</span>
            <input
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              disabled={state === "starting" || state === "connecting"}
              autoComplete="off"
              spellCheck={false}
              className="rounded-lg border border-night-600 bg-night-900 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => void joinRoom()}
            disabled={state === "starting" || state === "connecting"}
            className="rounded-lg bg-neon-blue px-5 py-3 font-display text-lg font-semibold text-night-950 disabled:opacity-50"
          >
            {state === "starting" || state === "connecting" ? t("online.connecting") : t("online.join")}
          </button>
        </section>
      )}

      {state === "waiting" && <p role="status" className="text-sm text-neon-green">{t("online.waiting")}</p>}
      {state === "connecting" && <p role="status" className="text-sm text-neon-blue">{t("online.connecting")}</p>}
      {error && <p role="alert" className="rounded-lg border border-neon-red/50 p-3 text-sm text-neon-red">{error}</p>}

      <p className="text-xs text-night-600">{t("online.disclaimer")}</p>
    </main>
  );
}
