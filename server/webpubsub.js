// server/webpubsub.js
// Works with both "factory function" and "class" styles of the adapter.

function isClass(fn) {
  return typeof fn === "function" && /^class\s/.test(Function.prototype.toString.call(fn));
}

export async function attachWebPubSubAdapter(io) {
  const connectionString = process.env.WEB_PUBSUB_CONNECTION_STRING;
  if (!connectionString) {
    console.warn("WEB_PUBSUB_CONNECTION_STRING not set; using default Socket.IO adapter");
    return;
  }

  try {
    const mod = await import("@azure/web-pubsub-socket.io");

    // Try the common export names in order of likelihood
    const candidate =
      mod.WebPubSubSocketIOAdapter ||
      mod.WebPubSubAdapter ||
      mod.createAdapter ||
      mod.default;

    if (!candidate) {
      throw new Error(
        "Could not find an adapter export in @azure/web-pubsub-socket.io " +
        "(looked for WebPubSubSocketIOAdapter/WebPubSubAdapter/createAdapter/default)."
      );
    }

    const opts = { hub: process.env.WEB_PUBSUB_HUB || "quiz" };
    const adapter = isClass(candidate)
      ? new candidate(connectionString, opts)  // class-style export
      : candidate(connectionString, opts);     // factory-style export

    io.adapter(adapter);
    console.log("Azure Web PubSub adapter attached.");
  } catch (err) {
    console.error("Failed to attach Web PubSub adapter", err);
    console.warn("Continuing with default in-memory Socket.IO adapter.");
    // Fall back silently so the site still boots
  }
}
