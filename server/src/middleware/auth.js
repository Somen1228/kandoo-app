import { getAuth } from 'firebase-admin/auth';
import firebaseAdmin from '../config/firebase.js';
import User from '../models/User.js';

function providerName(decodedToken) {
  const provider = decodedToken.firebase?.sign_in_provider;
  if (provider === 'google.com') return 'google';
  if (provider === 'phone') return 'phone';
  return 'email';
}

export default async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const decoded = await getAuth(firebaseAdmin).verifyIdToken(authHeader.slice(7));
    const [user] = await User.findOrCreate({
      where: { firebase_uid: decoded.uid },
      defaults: {
        firebase_uid: decoded.uid,
        email: decoded.email || null,
        phone: decoded.phone_number || null,
        display_name: decoded.name || decoded.email || decoded.phone_number || 'Kandoo user',
        photo_url: decoded.picture || null,
        auth_provider: providerName(decoded),
      },
    });

    await user.update({
      email: decoded.email || user.email,
      phone: decoded.phone_number || user.phone,
      display_name: decoded.name || user.display_name,
      photo_url: decoded.picture || user.photo_url,
      auth_provider: providerName(decoded),
    });

    req.user = user;
    req.firebaseUser = decoded;
    return next();
  } catch (error) {
    console.warn('Authentication rejected:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
