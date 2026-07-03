import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as AiTutorController from '../Controllers/aiTutorController';

const router = Router();
router.post('/tutor', requireAuth(['STUDENT']), AiTutorController.ask);

export default router;
