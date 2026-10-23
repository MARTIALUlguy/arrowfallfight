import { PeerServer } from "peer";

const port = Number(process.env.PORT ?? 9000);
const path = process.env.PEER_PATH ?? "/peerjs";
const key = process.env.PEER_KEY ?? "peerjs";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535.");
}

let httpServer;
const peerServer = PeerServer({
  port,
  path,
  key,
  proxied: process.env.PEER_PROXIED === "true",
  allow_discovery: false,
}, (server) => {
  httpServer = server;
});

peerServer.on("connection", (client) => {
  console.info(`Peer connected: ${client.getId()}`);
});

peerServer.on("disconnect", (client) => {
  console.info(`Peer disconnected: ${client.getId()}`);
});

console.info(`ARROWFALL signaling server listening on port ${port}${path}`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (httpServer) {
      httpServer.close(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });
}
