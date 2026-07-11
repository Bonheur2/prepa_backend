import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import { uploadPdf } from '../Middleware/uploadPdf';
import * as PastPapersController from '../Controllers/pastPapersController';

const router = Router();
router.get('/', requireAuth(), PastPapersController.list);
router.post('/', requireAuth(['TEACHER', 'ADMIN']), PastPapersController.create);
router.post('/upload', requireAuth(['TEACHER', 'ADMIN']), uploadPdf, PastPapersController.createFromUpload);

export default router;
