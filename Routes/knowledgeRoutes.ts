import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import { uploadPdf } from '../Middleware/uploadPdf';
import * as KnowledgeController from '../Controllers/knowledgeController';

const router = Router();
router.get('/documents', requireAuth(), KnowledgeController.list);
router.post('/documents', requireAuth(['TEACHER', 'ADMIN']), KnowledgeController.create);
router.post(
  '/documents/upload',
  requireAuth(['TEACHER', 'ADMIN']),
  uploadPdf,
  KnowledgeController.createFromUpload
);

export default router;
