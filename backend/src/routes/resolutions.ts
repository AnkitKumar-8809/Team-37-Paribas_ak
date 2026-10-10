import { Router } from 'express';
import { getPendingRejections, resolveRejection } from '../controllers/resolutionController';

const router = Router();

router.get('/pending', getPendingRejections);
router.post('/:id/resolve', resolveRejection);

export default router;
