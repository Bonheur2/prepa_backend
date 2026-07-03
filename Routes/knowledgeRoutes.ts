import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as KnowledgeController from '../Controllers/knowledgeController';

const router = Router();
router.get('/documents', requireAuth(), KnowledgeController.list);
router.post('/documents', requireAuth(['TEACHER', 'ADMIN']), KnowledgeController.create);

export default router;
