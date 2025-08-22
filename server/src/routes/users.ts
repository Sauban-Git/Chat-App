import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import type { AuthenticatedRequest } from "../types/types.js";
import { userAuth } from "../middlewares/userMiddleware.js";

const router = Router();

router.get("/", userAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
      },
      select: {
        id: true,
        name: true,
        email: true,
        conversations1: {
          where: {
            user2Id: userId,
          },
          include: {
            messages: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        conversations2: {
          where: {
            user1Id: userId,
          },
          include: {
            messages: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = users.map((user) => {
      const conversation =
        user.conversations1[0] || user.conversations2[0] || null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        conversation: conversation
          ? {
              id: conversation.id,
              lastMessage: conversation.messages[0] || null,
            }
          : null,
      };
    });

    return res.status(200).json({
      users: result,
    });
  } catch (error) {
    console.log("Error while fetching users list: ", error);
    return res.status(500).json({
      error: "Error while users list",
    });
  }
});

export { router as usersRouter };
