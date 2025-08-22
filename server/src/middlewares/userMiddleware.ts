// middleware/fakeAuth.ts
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/types.js";

export function fakeAuth(req: Request, res: Response, next: NextFunction) {
  (req as AuthenticatedRequest).userId = "some-hardcoded-user-id"; 
  next();
}
