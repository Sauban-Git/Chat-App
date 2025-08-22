import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

router.post("/register", async (req: Request, res: Response) => {
  const { name, email } = req.body;
  if (!name || !email)
    return res.status(400).json({
      error: "Invalid name and email. Please try again!",
    });
  try {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (user)
      return res.status(403).json({
        error: "This email is already in use. Try login with this email.",
      });
    else {
      const user = await prisma.user.create({
        data: {
          name,
          email,
        },
      });
      return res.status(200).json({
        user,
      });
    }
  } catch (error) {
    console.error("Error while prisma user: ", error);
    return res.status(500).json({
      error: "There was an error while registring this user.",
    });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({
      error: "Invalid name and email. Please try again!",
    });
  try {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user)
      return res.status(403).json({
        error: "User not found!",
      });
    return res.status(200).json({
        user
    })
  } catch (error) {
    console.error("Error while prisma user: ", error);
    return res.status(500).json({
      error: "There was an error while login.",
    });
  }
});

export { router as authRouter };
