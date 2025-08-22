import { Router, type Request, type Response } from "express";

const router = Router();

router.post("/register", async(req: Request, res: Response) => {
    // 
})
router.post("/login", async(req: Request, res: Response) => {
    // 
})

export {router as authRouter}