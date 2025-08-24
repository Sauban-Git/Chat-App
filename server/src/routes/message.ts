import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { userAuth } from "../middlewares/userMiddleware.js";
import type { AuthenticatedRequest } from "../types/types.js";
import { getConversationSubscribers } from "../db/redis.js";

const router = Router();

router.use(userAuth);

router.post("/", async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { conversationId, text, deliveredAt, readAt } = req.body;
  if (!conversationId || !text)
    return res.status(400).json({
      error: "Please send text and conversationId",
    });
  try {
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        text,
        deliveredAt: deliveredAt ?? null,
        readAt: readAt ?? null,
      },
    });
    return res.status(200).json({
      message,
    });
  } catch (error) {
    console.error("Error creating message: ", error);
    return res.status(500).json({
      error: "Error sending message",
    });
  }
});

router.put("/deliver", async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const io = req.app.get("io"); // get io instance from app context

  try {
    // Get all conversations this user is a part of
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { id: true },
    });

    const conversationIds = conversations.map((c) => c.id);

    // Update messages that are undelivered from others
    const updateResult = await prisma.message.updateMany({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        deliveredAt: null,
      },
      data: {
        deliveredAt: new Date(),
      },
    });

    const sockets = await io.fetchSockets();

    for (const convId of conversationIds) {
      const clientIds = await getConversationSubscribers(convId);

      for (const cid of clientIds) {
        const socket = sockets.find((s: any) => s.id === cid);

        if (socket && socket.data.userId !== userId) {
          socket.emit("message:delivered", {
            conversationId: convId,
            deliveredAt: new Date().toISOString(),
          });
        }
      }
    }

    return res.status(200).json({ status: "Successful" });
  } catch (error) {
    console.error("Error: ", error);
    return res.status(500).json({
      error: "Error updating status",
    });
  }
});

router.put("/read", async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { conversationId } = req.body;
  const io = req.app.get("io");

  if (!conversationId)
    return res.status(400).json({
      error: "Please send conversationId",
    });

  try {
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    const clientIds = await getConversationSubscribers(conversationId);
    const sockets = await io.fetchSockets();

    for (const cid of clientIds) {
      const socket = sockets.find((s: any) => s.id === cid);

      if (socket && socket.data.userId !== userId) {
        socket.emit("message:read", {
          conversationId,
          readAt: new Date().toISOString(),
        });
      }
    }

    return res.status(200).json({
      status: "Successful",
    });
  } catch (error) {
    console.error("Error: ", error);
    return res.status(500).json({
      error: "Error updating status",
    });
  }
});

export { router as messageRouter };
