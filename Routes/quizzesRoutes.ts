import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as QuizzesController from '../Controllers/quizzesController';

const router = Router();
router.get('/', requireAuth(), QuizzesController.list);
router.post('/', requireAuth(['TEACHER', 'ADMIN']), QuizzesController.create);
router.post('/adaptive', requireAuth(['STUDENT']), QuizzesController.generateAdaptive);

export default router;
