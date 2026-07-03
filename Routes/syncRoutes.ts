import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as SyncController from '../Controllers/syncController';

const router = Router();
router.get('/pull', requireAuth(), SyncController.pull);
router.post('/push', requireAuth(['STUDENT']), SyncController.push);

export default router;
