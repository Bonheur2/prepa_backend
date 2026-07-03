import { Router } from 'express';
import { requireAuth } from '../Middleware/requireAuth';
import * as AuthController from '../Controllers/authController';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', requireAuth(), AuthController.logout);
router.post('/request-password-reset', AuthController.requestPasswordReset);
router.post('/reset-password', AuthController.resetPassword);

export default router;
