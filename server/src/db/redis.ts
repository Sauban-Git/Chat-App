import { createClient, type RedisClientType } from "redis";

const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

await redisClient.connect();

// ----------------------
// Key prefixes
// ----------------------
const CONVERSATION_SUBSCRIBERS_PREFIX = "conversation_subscribers:";
const USER_SUBSCRIBERS_PREFIX = "user_subscribers:";
const USER_STATUS_HASH = "user_statuses"; // hash for online/offline
const USER_LASTSEEN_PREFIX = "user_lastseen:"; // timestamp

// ----------------------
// Conversation Subscribers
// ----------------------
export async function addConversationSubscriber(
  conversationId: string,
  clientId: string
): Promise<void> {
  await redisClient.sAdd(CONVERSATION_SUBSCRIBERS_PREFIX + conversationId, clientId);
}

export async function removeConversationSubscriber(
  conversationId: string,
  clientId: string
): Promise<void> {
  await redisClient.sRem(CONVERSATION_SUBSCRIBERS_PREFIX + conversationId, clientId);
}

export async function getConversationSubscribers(conversationId: string): Promise<string[]> {
  return await redisClient.sMembers(CONVERSATION_SUBSCRIBERS_PREFIX + conversationId);
}

// ----------------------
// User Subscribers (for conversation lists)
// ----------------------
export async function addUserSubscriber(userId: string, clientId: string): Promise<void> {
  await redisClient.sAdd(USER_SUBSCRIBERS_PREFIX + userId, clientId);
}

export async function removeUserSubscriber(userId: string, clientId: string): Promise<void> {
  await redisClient.sRem(USER_SUBSCRIBERS_PREFIX + userId, clientId);
}

export async function getUserSubscribers(userId: string): Promise<string[]> {
  return await redisClient.sMembers(USER_SUBSCRIBERS_PREFIX + userId);
}

// ----------------------
// User Online Status (hash-based)
// ----------------------
export async function markUserOnline(userId: string): Promise<void> {
  await redisClient.hSet(USER_STATUS_HASH, userId, "online");
  await redisClient.set(USER_LASTSEEN_PREFIX + userId, Date.now().toString());
}

export async function markUserOffline(userId: string): Promise<void> {
  await redisClient.hSet(USER_STATUS_HASH, userId, "offline");
  await redisClient.set(USER_LASTSEEN_PREFIX + userId, Date.now().toString());
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const status = await redisClient.hGet(USER_STATUS_HASH, userId);
  return status === "online";
}

// Returns array of online userIds
export async function getAllOnlineUsers(): Promise<string[]> {
  const allStatuses = await redisClient.hGetAll(USER_STATUS_HASH);
  console.log("all statuses: ",allStatuses)
  return Object.entries(allStatuses)
    .filter(([_, status]) => status === "online")
    .map(([userId]) => userId);
}

// ----------------------
// Cleanup / Quit
// ----------------------
export async function quit(): Promise<void> {
  await redisClient.quit();
}

export { redisClient };
