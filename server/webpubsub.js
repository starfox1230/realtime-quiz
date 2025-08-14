import pkg from "@azure/web-pubsub-socket.io";
const { WebPubSubSocketIOAdapter } = pkg;

export function attachWebPubSub(io, connStr, hub = "quizhub") {
  io.adapter(new WebPubSubSocketIOAdapter(connStr, { hub }));
}


export async function attachWebPubSubAdapter(io) {
  const connectionString = process.env.WEB_PUBSUB_CONNECTION_STRING;
  if (!connectionString) {
    console.warn("WEB_PUBSUB_CONNECTION_STRING not set; using default Socket.IO adapter");
    return;
  }
  try {
    const adapter = new WebPubSubSocketIOAdapter(connectionString, { hub: "quiz" });
    io.adapter(adapter);
  } catch (err) {
    console.error("Failed to attach Web PubSub adapter", err);
    throw err;
  }
}
