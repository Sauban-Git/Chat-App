import { Router, type Request, type Response } from "express";

const router = Router();

router.get("/:id/messages", async(req: Request, res: Response) => {
    // 
})

export {router as conversationsRouter}