import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as TopicsController from '../Controllers/topicsController';

const router = Router();
router.get('/', requireAuth(), TopicsController.list);
router.post('/', requireAuth(['TEACHER', 'ADMIN']), TopicsController.create);

export default router;
