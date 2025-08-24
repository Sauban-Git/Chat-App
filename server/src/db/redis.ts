import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

await redisClient.connect();

// Keys
const CONVERSATION_SUBSCRIBERS_PREFIX = "conversation_subscribers:";
const USER_SUBSCRIBERS_PREFIX = "user_subscribers:";
const USER_ONLINE_CLIENTS_PREFIX = "user_online_clients:"; // For tracking online clientIds per user

// Conversation Subscribers
export async function addConversationSubscriber(conversationId: string, clientId: string) {
  await redisClient.sAdd(CONVERSATION_SUBSCRIBERS_PREFIX + conversationId, clientId);
}

export async function removeConversationSubscriber(conversationId: string, clientId: string) {
  await redisClient.sRem(CONVERSATION_SUBSCRIBERS_PREFIX + conversationId, clientId);
}

export async function getConversationSubscribers(conversationId: string): Promise<string[]> {
  return await redisClient.sMembers(CONVERSATION_SUBSCRIBERS_PREFIX + conversationId);
}

// User Subscribers (for conversation lists)
export async function addUserSubscriber(userId: string, clientId: string) {
  await redisClient.sAdd(USER_SUBSCRIBERS_PREFIX + userId, clientId);
}

export async function removeUserSubscriber(userId: string, clientId: string) {
  await redisClient.sRem(USER_SUBSCRIBERS_PREFIX + userId, clientId);
}

export async function getUserSubscribers(userId: string): Promise<string[]> {
  return await redisClient.sMembers(USER_SUBSCRIBERS_PREFIX + userId);
}

// User Online Client IDs (for presence tracking)
export async function addUserOnlineClient(userId: string, clientId: string) {
  await redisClient.sAdd(USER_ONLINE_CLIENTS_PREFIX + userId, clientId);
}

export async function removeUserOnlineClient(userId: string, clientId: string) {
  await redisClient.sRem(USER_ONLINE_CLIENTS_PREFIX + userId, clientId);
}

export async function getUserOnlineClientCount(userId: string): Promise<number> {
  return await redisClient.sCard(USER_ONLINE_CLIENTS_PREFIX + userId);
}

export async function getAllOnlineUsers(): Promise<string[]> {
  const keys = await redisClient.keys(USER_ONLINE_CLIENTS_PREFIX + "*");
  const onlineUsers: string[] = [];
  for (const key of keys) {
    const count = await redisClient.sCard(key);
    if (count > 0) {
      const userId = key.split(":")[1];
      onlineUsers.push(userId!);
    }
  }
  return onlineUsers;
}


export async function quit() {
  await redisClient.quit();
}

export { redisClient };
