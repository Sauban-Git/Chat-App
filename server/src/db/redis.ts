import { createClient } from "redis";

const pubClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});
const subClient = pubClient.duplicate();

pubClient.on("error", (err) => console.error("Redis Pub Error:", err));
subClient.on("error", (err) => console.error("Redis Sub Error:", err));

(async () => {
  try {
    await pubClient.connect();
    await subClient.connect();
    console.log("Redis clients connected");
  } catch (err) {
    console.error("Redis connection failed:", err);
    process.exit(1); // Exit or handle retries as needed
  }
})();

export const RedisPubSub = {
  async publish(channel: string, message: any) {
    try {
      await pubClient.publish(channel, JSON.stringify(message));
    } catch (err) {
      console.error(`Publish error on channel ${channel}:`, err);
    }
  },

  async subscribe(channel: string, callback: (message: any) => void) {
    try {
      await subClient.subscribe(channel, (msg: string) => {
        try {
          const data = JSON.parse(msg);
          callback(data);
        } catch (err) {
          console.error(`Failed to parse message on channel ${channel}:`, err);
        }
      });
    } catch (err) {
      console.error(`Subscribe error on channel ${channel}:`, err);
    }
  },

  async unsubscribe(channel: string) {
    try {
      await subClient.unsubscribe(channel);
    } catch (err) {
      console.error(`Unsubscribe error on channel ${channel}:`, err);
    }
  },
};

export async function disconnectRedis() {
  try {
    await pubClient.quit();
    await subClient.quit();
    console.log("Redis clients disconnected");
  } catch (err) {
    console.error("Error during Redis disconnect:", err);
  }
}
