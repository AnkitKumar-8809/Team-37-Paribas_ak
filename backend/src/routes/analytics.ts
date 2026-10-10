import { Router, Request, Response } from 'express';

const router = Router();

router.get('/throughput', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      metrics: [
        { time: '10:00', rowsPerSec: 1200 },
        { time: '10:15', rowsPerSec: 1450 },
        { time: '10:30', rowsPerSec: 1380 },
        { time: '10:45', rowsPerSec: 1600 }
      ]
    }
  });
});

export default router;
