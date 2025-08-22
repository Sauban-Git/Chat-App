// middleware/fakeAuth.ts
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/types.js";
import { COOKIE_NAME, JWT_SECRET } from "../config/jwt.js";
import jwt from "jsonwebtoken";

export function userAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token)
    return res.status(400).json({
      error: "Authentication token missing or invalid",
    });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const authReq = req as AuthenticatedRequest;
    authReq.userId = decoded.userId;
    next()
  } catch (error) {
    console.error("Error while decoding: ", error);
    return res.status(401).json({
        error: "Invalid or expired token"
    })
  }
}
