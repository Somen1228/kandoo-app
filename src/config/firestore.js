import { getFirestore } from 'firebase/firestore';
import app, { firebaseConfigured } from './firebase';

export const db = (app && firebaseConfigured) ? getFirestore(app) : null;
