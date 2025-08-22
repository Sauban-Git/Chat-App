import { Router, type Request, type Response } from "express";

const router = Router()

router.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Hello! Are you there?"
    })
})

export {router as messageRouter}