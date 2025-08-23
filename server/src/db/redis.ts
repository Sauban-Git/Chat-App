import { createClient } from "redis";

const publisher = createClient();
const subscriber = createClient();

await publisher.connect();
await subscriber.connect();

publisher.on("error", (err) => console.error("Redis Publisher Error:", err));
subscriber.on("error", (err) => console.error("Redis Subscriber Error:", err));

type MessageHandler = (channel: string, message: string) => void;

// Track handlers and subscriber counts per channel
const handlers = new Map<string, MessageHandler>();
const subscriberCounts = new Map<string, number>();

/**
 * Publishes a message to a Redis channel.
 */
export const publishToChannel = async (channel: string, payload: unknown) => {
  const message = JSON.stringify(payload);
  await publisher.publish(channel, message);
};

/**
 * Subscribes to a Redis channel.
 * Reference counts subscribers, subscribes only on first subscriber.
 */
export const subscribeToChannel = async (
  channel: string,
  handler: MessageHandler
) => {
  // Increase subscriber count
  const currentCount = subscriberCounts.get(channel) ?? 0;
  subscriberCounts.set(channel, currentCount + 1);

  // If already subscribed, just update handler and return
  if (handlers.has(channel)) return;

  handlers.set(channel, handler);

  await subscriber.subscribe(channel, (message) => {
    const h = handlers.get(channel);
    if (h) h(channel, message);
  });
};

/**
 * Unsubscribes from a Redis channel.
 * Decrements subscriber count, unsubscribes only when count hits zero.
 */
export const unsubscribeFromChannel = async (channel: string) => {
  const currentCount = subscriberCounts.get(channel);
  if (!currentCount) return; // no subscribers for this channel

  if (currentCount === 1) {
    // Last subscriber: remove handler and unsubscribe
    handlers.delete(channel);
    subscriberCounts.delete(channel);
    await subscriber.unsubscribe(channel);
  } else {
    // Decrement count
    subscriberCounts.set(channel, currentCount - 1);
  }
};

/**
 * Publishes a presence update to Redis.
 */
export const publishPresence = async (
  userId: string,
  status: "online" | "offline"
) => {
  const channel = `presence:${userId}`;
  const payload = { userId, status };
  await publishToChannel(channel, payload);
};

/**
 * Publishes a typing status to Redis.
 */
export const publishTypingStatus = async (
  conversationId: string,
  userId: string,
  isTyping: boolean
) => {
  const channel = `conversation:${conversationId}:typing`;
  const payload = { userId, isTyping };
  await publishToChannel(channel, payload);
};

export {
  publisher,
  subscriber,
};
