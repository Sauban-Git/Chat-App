import { createClient } from "redis";

// ----------------------------
// Redis Clients
// ----------------------------
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

await redisClient.connect();

// A separate client for subscriptions (important!)
const redisSubscriber = redisClient.duplicate();
await redisSubscriber.connect();

// ----------------------------
// Prefixes & Keys
// ----------------------------
const CONVERSATION_SUBSCRIBERS_PREFIX = "conversation_subscribers:";
const USER_SUBSCRIBERS_PREFIX = "user_subscribers:";
const TYPING_CHANNEL_PREFIX = "typing:";
const PRESENCE_CHANNEL = "presence";

function getConversationKey(conversationId: string): string {
  return `${CONVERSATION_SUBSCRIBERS_PREFIX}${conversationId}`;
}

function getUserKey(userId: string): string {
  return `${USER_SUBSCRIBERS_PREFIX}${userId}`;
}

// ----------------------------
// Conversation Subscribers
// ----------------------------
export async function addConversationSubscriber(conversationId: string, clientId: string) {
  await redisClient.sAdd(getConversationKey(conversationId), clientId);
}

export async function removeConversationSubscriber(conversationId: string, clientId: string) {
  await redisClient.sRem(getConversationKey(conversationId), clientId);
}

export async function getConversationSubscribers(conversationId: string): Promise<string[]> {
  return await redisClient.sMembers(getConversationKey(conversationId));
}

// ----------------------------
// User Subscribers
// ----------------------------
export async function addUserSubscriber(userId: string, clientId: string) {
  const key = getUserKey(userId);
  await redisClient.sAdd(key, clientId);
  await redisClient.expire(key, 3600); // 1 hour
}

export async function removeUserSubscriber(userId: string, clientId: string) {
  await redisClient.sRem(getUserKey(userId), clientId);
}

export async function getUserSubscribers(userId: string): Promise<string[]> {
  return await redisClient.sMembers(getUserKey(userId));
}

// ----------------------------
// Typing Pub/Sub
// ----------------------------
export async function publishTypingStatus(conversationId: string, userId: string, isTyping: boolean) {
  const channel = `${TYPING_CHANNEL_PREFIX}${conversationId}`;
  const payload = JSON.stringify({ userId, isTyping });
  await redisClient.publish(channel, payload);
}

/**
 * Subscribe to typing events for a conversation.
 * Returns an async unsubscribe function.
 */
export async function subscribeToTyping(
  conversationId: string,
  handler: (data: { userId: string; isTyping: boolean }) => void
): Promise<() => Promise<void>> {
  const channel = `${TYPING_CHANNEL_PREFIX}${conversationId}`;
  await redisSubscriber.subscribe(channel, (message) => {
    try {
      const data = JSON.parse(message);
      handler(data);
    } catch (err) {
      console.error("Error parsing typing status message:", err);
    }
  });

  // Return unsubscribe function
  return async () => {
    try {
      await redisSubscriber.unsubscribe(channel);
      console.log(`Unsubscribed from Redis typing channel: ${channel}`);
    } catch (err) {
      console.error(`Failed to unsubscribe from ${channel}:`, err);
    }
  };
}

// ----------------------------
// Presence Pub/Sub
// ----------------------------
export async function publishPresence(userId: string, status: "online" | "offline") {
  const payload = JSON.stringify({ userId, status });
  await redisClient.publish(PRESENCE_CHANNEL, payload);
}

/**
 * Subscribe to presence events.
 * Returns an async unsubscribe function.
 */
export async function subscribeToPresence(
  handler: (data: { userId: string; status: "online" | "offline" }) => void
): Promise<() => Promise<void>> {
  await redisSubscriber.subscribe(PRESENCE_CHANNEL, (message) => {
    try {
      const data = JSON.parse(message);
      handler(data);
    } catch (err) {
      console.error("Error parsing presence message:", err);
    }
  });

  return async () => {
    try {
      await redisSubscriber.unsubscribe(PRESENCE_CHANNEL);
      console.log(`Unsubscribed from Redis presence channel: ${PRESENCE_CHANNEL}`);
    } catch (err) {
      console.error(`Failed to unsubscribe from ${PRESENCE_CHANNEL}:`, err);
    }
  };
}

// ----------------------------
// Cleanup
// ----------------------------
export async function quit() {
  await redisClient.quit();
  await redisSubscriber.quit();
}

export { redisClient, redisSubscriber };
