import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { fakeAuth } from "../middlewares/userMiddleware.js";
import type { AuthenticatedRequest } from "../types/types.js";

const router = Router();

router.use(fakeAuth);

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
    if (messages.length === 0) {
      return res
        .status(403)
        .json({ error: "Access denied or no messages found" });
    }

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

export { router as conversationsRouter };
