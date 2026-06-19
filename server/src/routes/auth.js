import { Router } from 'express';
import authenticate from '../middleware/auth.js';

const router = Router();

router.post('/session', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      uid: req.user.firebase_uid,
      email: req.user.email,
      phone: req.user.phone,
      displayName: req.user.display_name,
      photoUrl: req.user.photo_url,
      authProvider: req.user.auth_provider,
    },
  });
});

router.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      uid: req.user.firebase_uid,
      email: req.user.email,
      phone: req.user.phone,
      displayName: req.user.display_name,
      photoUrl: req.user.photo_url,
      authProvider: req.user.auth_provider,
    },
  });
});

export default router;

