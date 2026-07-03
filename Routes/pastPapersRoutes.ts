import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as PastPapersController from '../Controllers/pastPapersController';

const router = Router();
router.get('/', requireAuth(), PastPapersController.list);
router.post('/', requireAuth(['TEACHER', 'ADMIN']), PastPapersController.create);

export default router;
