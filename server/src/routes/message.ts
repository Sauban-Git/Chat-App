import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { userAuth } from "../middlewares/userMiddleware.js";
import type { AuthenticatedRequest } from "../types/types.js";

const router = Router();

router.use(userAuth);

router.post("/", async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { conversationId, text } = req.body;
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

  try {
    await prisma.message.updateMany({
      where: {
        NOT: {
          senderId: userId,
        },
        conversation: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      },
      data: {
        deliveredAt: new Date(),
      },
    });
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

router.put("/read", async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { conversationId } = req.body;
  if (!conversationId)
    return res.status(400).json({
      error: "Please send conversationId",
    });
  try {
    await prisma.message.updateMany({
      where: {
        conversationId,
        NOT: {
          senderId: userId,
        },
      },
      data: {
        readAt: new Date(),
      },
    });
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
