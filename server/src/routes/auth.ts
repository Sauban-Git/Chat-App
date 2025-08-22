import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import jwt from "jsonwebtoken";
import { COOKIE_NAME, JWT_EXPIRES_IN, JWT_SECRET } from "../config/jwt.js";

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

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      res.cookie(COOKIE_NAME, token, {
        httpOnly: process.env.HTTP_ONLY === "true",
        sameSite: process.env.SAME_SITE as
          | "lax"
          | "strict"
          | "none"
          | undefined,
        secure: process.env.SECURE === "true",
        maxAge: 1000 * 60 * 60 * 1, // 1 hr
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

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: process.env.HTTP_ONLY === "true",
      sameSite: process.env.SAME_SITE as "lax" | "strict" | "none" | undefined,
      secure: process.env.SECURE === "true",
      maxAge: 1000 * 60 * 60 * 1, // 1 hr
    });

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Error while prisma user: ", error);
    return res.status(500).json({
      error: "There was an error while login.",
    });
  }
});

export { router as authRouter };
