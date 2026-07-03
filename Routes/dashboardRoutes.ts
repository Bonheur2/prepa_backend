import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as DashboardController from '../Controllers/dashboardController';

const router = Router();
router.get('/students', requireAuth(['TEACHER', 'ADMIN']), DashboardController.listStudents);
router.get('/students/:id', requireAuth(['TEACHER', 'ADMIN']), DashboardController.getStudent);
router.get('/gaps', requireAuth(['TEACHER', 'ADMIN']), DashboardController.listGaps);

export default router;
