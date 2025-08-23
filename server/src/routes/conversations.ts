import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { userAuth } from "../middlewares/userMiddleware.js";
import type { AuthenticatedRequest } from "../types/types.js";

const router = Router();

router.use(userAuth);

router.get("/:id/messages", async (req: Request, res: Response) => {
  const id = req.params.id;
  const userId = (req as AuthenticatedRequest).userId;

  if (!id)
    return res.status(400).json({
      error: "This conversation is not available",
    });

  try {
    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        conversation: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return res.status(200).json({
      messages,
    });
  } catch (error) {
    console.error("Error oiccured while getting messages: ", error);
    return res.status(500).json({
      error: "There was an issue in getting messages. Please try again.",
    });
  }
});

router.post("/start", async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { to } = req.body;
  if (!to)
    return res.status(400).json({
      error: "Error initializing conversation",
    });
  try {
    const [user1Id, user2Id] = [userId, to].sort(); // ensures consistent ordering

    const conversation = await prisma.conversation.upsert({
      where: {
        user1Id_user2Id: {
          user1Id,
          user2Id,
        },
      },
      update: {},
      create: {
        user1Id,
        user2Id,
      },
    });
    return res.status(200).json({
      conversation,
    });
  } catch (error) {
    console.error("Error: ", error);
    return res.status(500).json({
      error: "Error while initializing conversation",
    });
  }
});

export { router as conversationsRouter };
