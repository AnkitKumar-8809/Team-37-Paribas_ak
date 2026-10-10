import { Router } from 'express';

import {
  getRejections,
  getPendingRejections,
  resolveRejection,
} from '../controllers/resolutionController';

const router = Router();

router.get('/', getRejections);

router.get(
  '/pending',
  getPendingRejections
);

router.post(
  '/:id/resolve',
  resolveRejection
);

export default router;