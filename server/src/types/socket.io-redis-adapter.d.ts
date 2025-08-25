declare module "@socket.io/redis-adapter" {
  import { Adapter } from "socket.io-adapter";
  import { RedisClientType } from "ioredis";

  export function createAdapter(pubClient: any, subClient: any): Adapter;
}
