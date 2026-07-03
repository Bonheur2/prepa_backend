import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as SubjectsController from '../Controllers/subjectsController';

const router = Router();
router.get('/', requireAuth(), SubjectsController.list);
router.post('/', requireAuth(['TEACHER', 'ADMIN']), SubjectsController.create);

export default router;
