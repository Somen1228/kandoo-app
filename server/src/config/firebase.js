import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  return JSON.parse(readFileSync(path, 'utf8'));
}

let firebaseAdmin;
try {
  firebaseAdmin = getApps()[0] || initializeApp({ credential: cert(loadServiceAccount()) });
} catch (error) {
  throw new Error(`Firebase Admin configuration failed: ${error.message}`);
}

export default firebaseAdmin;

