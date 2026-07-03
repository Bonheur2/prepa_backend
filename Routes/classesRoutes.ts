import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as ClassesController from '../Controllers/classesController';

const router = Router();
router.get('/', requireAuth(), ClassesController.list);
router.post('/', requireAuth(['TEACHER', 'ADMIN']), ClassesController.create);
router.post('/join', requireAuth(['STUDENT']), ClassesController.join);

export default router;
