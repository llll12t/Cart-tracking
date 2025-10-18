import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

// load service account from project root serviceAccountKey.json if present
let serviceAccount = null;
try {
  const p = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(p)) {
    serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
} catch (e) {
  console.error('Failed to read serviceAccountKey.json', e);
}

if (!admin.apps.length) {
  if (!serviceAccount) {
    admin.initializeApp();
  } else {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { lineId, phone } = body || {};
    if (!lineId || !phone) return new Response(JSON.stringify({ error: 'missing_params' }), { status: 400 });

    const db = admin.firestore();
    // find a user by phone (exact match)
    const usersRef = db.collection('users');
    const qSnap = await usersRef.where('phone', '==', phone).limit(1).get();
    if (qSnap.empty) {
      return new Response(JSON.stringify({ error: 'no_user_with_phone' }), { status: 404 });
    }
    const userDoc = qSnap.docs[0];
    const uid = userDoc.id;

    // update user's lineId
    await usersRef.doc(uid).set({ lineId }, { merge: true });

    // mint custom token for that uid
    const customToken = await admin.auth().createCustomToken(uid, { provider: 'line', lineId });

    return new Response(JSON.stringify({ customToken, linked: true, uid }), { status: 200 });
  } catch (err) {
    console.error('/api/auth/line/link error', err);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 });
  }
}
