import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as QuestionsController from '../Controllers/questionsController';

const router = Router();
router.get('/', requireAuth(), QuestionsController.list);
router.post('/', requireAuth(['TEACHER', 'ADMIN']), QuestionsController.create);

export default router;
