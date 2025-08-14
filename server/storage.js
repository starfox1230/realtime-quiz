import { BlobServiceClient } from "@azure/storage-blob";

const memoryStore = new Map();
let containerClient;

if (process.env.BLOB_CONNECTION_STRING) {
  try {
    const blobService = BlobServiceClient.fromConnectionString(process.env.BLOB_CONNECTION_STRING);
    containerClient = blobService.getContainerClient("quizzes");
    await containerClient.createIfNotExists();
  } catch (err) {
    console.error("Failed to initialize Azure Blob Storage, falling back to in-memory store", err);
    containerClient = undefined;
  }
}

export async function saveQuizJson(sessionId, quiz) {
  if (containerClient) {
    const data = JSON.stringify(quiz);
    const blockClient = containerClient.getBlockBlobClient(`${sessionId}.json`);
    await blockClient.upload(data, Buffer.byteLength(data), {
      blobHTTPHeaders: { blobContentType: "application/json" }
    });
  } else {
    memoryStore.set(sessionId, quiz);
  }
}

export async function getQuizJson(sessionId) {
  if (containerClient) {
    const blockClient = containerClient.getBlockBlobClient(`${sessionId}.json`);
    const exists = await blockClient.exists();
    if (!exists) return null;
    const buffer = await blockClient.downloadToBuffer();
    return JSON.parse(buffer.toString());
  } else {
    return memoryStore.get(sessionId) || null;
  }
}
