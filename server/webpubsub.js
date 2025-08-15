// server/webpubsub.js (ESM)

import { useAzureSocketIO } from "@azure/web-pubsub-socket.io";

/**
 * Try to attach Azure Web PubSub for Socket.IO.
 * If no connection string is set or anything fails, we log and keep going
 * with the default in-memory Socket.IO transport.
 */
export async function attachWebPubSubAdapter(io, hub = "quiz") {
  const connectionString = process.env.WEB_PUBSUB_CONNECTION_STRING;
  if (!connectionString) {
    console.warn(
      "WEB_PUBSUB_CONNECTION_STRING not set; continuing with default Socket.IO."
    );
    return;
  }

  try {
    await useAzureSocketIO(io, {
      hub,
      connectionString,
      // optional: set to true to see detailed SDK logs in console
      // logging: true,
    });
    console.log("Azure Web PubSub for Socket.IO attached (hub:", hub, ").");
  } catch (err) {
    console.error("Failed to attach Azure Web PubSub adapter:", err);
    console.warn("Continuing with default in-memory Socket.IO adapter.");
  }
}
