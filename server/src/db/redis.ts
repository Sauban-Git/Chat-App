import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

await redisClient.connect();

// Key prefixes
const CONVERSATION_SUBSCRIBERS_PREFIX = "conversation_subscribers:";
const USER_SUBSCRIBERS_PREFIX = "user_subscribers:";
const USER_ONLINE_CLIENTS_PREFIX = "user_online_clients:"; // For tracking online clientIds per user

// ----------------------
// Conversation Subscribers
// ----------------------
export async function addConversationSubscriber(
  conversationId: string,
  clientId: string
) {
  await redisClient.sAdd(
    CONVERSATION_SUBSCRIBERS_PREFIX + conversationId,
    clientId
  );
}

export async function removeConversationSubscriber(
  conversationId: string,
  clientId: string
) {
  await redisClient.sRem(
    CONVERSATION_SUBSCRIBERS_PREFIX + conversationId,
    clientId
  );
}

export async function getConversationSubscribers(
  conversationId: string
): Promise<string[]> {
  return await redisClient.sMembers(
    CONVERSATION_SUBSCRIBERS_PREFIX + conversationId
  );
}

// ----------------------
// User Subscribers (for conversation lists)
// ----------------------
export async function addUserSubscriber(userId: string, clientId: string) {
  await redisClient.sAdd(USER_SUBSCRIBERS_PREFIX + userId, clientId);
}

export async function removeUserSubscriber(userId: string, clientId: string) {
  await redisClient.sRem(USER_SUBSCRIBERS_PREFIX + userId, clientId);
}

export async function getUserSubscribers(userId: string): Promise<string[]> {
  return await redisClient.sMembers(USER_SUBSCRIBERS_PREFIX + userId);
}

// ----------------------
// User Online Client IDs (for presence tracking)
// ----------------------
export async function addUserOnlineClient(userId: string, clientId: string) {
  const key = USER_ONLINE_CLIENTS_PREFIX + userId;
  await redisClient.sAdd(key, clientId);
  // Auto-expire after 5 minutes unless refreshed
  await redisClient.expire(key, 60 * 5);
}

export async function removeUserOnlineClient(userId: string, clientId: string) {
  await redisClient.sRem(USER_ONLINE_CLIENTS_PREFIX + userId, clientId);
}

export async function getUserOnlineClientCount(
  userId: string
): Promise<number> {
  return await redisClient.sCard(USER_ONLINE_CLIENTS_PREFIX + userId);
}

// ----------------------
// Get all online users (safe SCAN instead of KEYS)
// ----------------------
// ----------------------
// Get all online users (safe SCAN instead of KEYS)
// ----------------------
export async function getAllOnlineUsers(): Promise<string[]> {
  const onlineUsers: string[] = [];

  for await (const rawKey of redisClient.scanIterator({
    MATCH: USER_ONLINE_CLIENTS_PREFIX + "*",
  })) {
    const key = String(rawKey); // ✅ safest way
    const count = await redisClient.sCard(key);
    if (count > 0) {
      const userId = key.split(":")[1];
      if (userId) onlineUsers.push(userId);
    }
  }

  return onlineUsers;
}

// ----------------------
// Cleanup / Quit
// ----------------------
export async function quit() {
  await redisClient.quit();
}

export { redisClient };
