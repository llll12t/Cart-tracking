import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

if (!admin.apps.length) {
  try {
    // prefer provided credentials via GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'serviceAccountKey.json');
    let credential;
    if (fs.existsSync(keyPath)) {
      const raw = fs.readFileSync(keyPath, 'utf8');
      const parsed = JSON.parse(raw);
      credential = admin.credential.cert(parsed);
    } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      });
    } else {
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({ credential });
  } catch (err) {
    // fallback to default init
    try { admin.initializeApp(); } catch (e) { console.error('firebase-admin init failed', e); }
  }
}

export default admin;
