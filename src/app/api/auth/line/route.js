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
    // initialize without explicit creds - relies on environment (not ideal)
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
    const accessToken = body?.accessToken;
    if (!accessToken) return new Response(JSON.stringify({ error: 'no_access_token' }), { status: 400 });
    // In development or when explicitly mocked, accept a mock access token
    const useMock = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_LIFF_MOCK === '1' || process.env.NEXT_PUBLIC_LIFF_MOCK === 'true';
    let userId, displayName, pictureUrl;
    if (useMock && accessToken && accessToken.startsWith('MOCK')) {
      // provide a deterministic mock profile
      userId = 'U_TEST_1234567890ABCDEF';
      displayName = 'LIFF Mock User';
      pictureUrl = 'https://lh5.googleusercontent.com/d/10mcLZP15XqebnVb1IaODQLhZ93EWT7h7';
    } else {
      // verify token by calling LINE profile endpoint
      const profileRes = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!profileRes.ok) {
        const txt = await profileRes.text();
        console.error('LINE profile verify failed', profileRes.status, txt);
        return new Response(JSON.stringify({ error: 'line_verify_failed' }), { status: 401 });
      }
      const profile = await profileRes.json();
      userId = profile.userId;
      displayName = profile.displayName;
      pictureUrl = profile.pictureUrl;
    }

    const db = admin.firestore();

    // try to find an existing app user that already has this lineId
    try {
      const usersRef = db.collection('users');
      const qSnap = await usersRef.where('lineId', '==', userId).limit(1).get();
      if (!qSnap.empty) {
        const matched = qSnap.docs[0];
        const matchedUid = matched.id;
        const customToken = await admin.auth().createCustomToken(matchedUid, { provider: 'line', lineId: userId });
        return new Response(JSON.stringify({ customToken, linked: true, uid: matchedUid }), { status: 200 });
      }
    } catch (e) {
      console.error('Error querying users by lineId', e);
      // continue to return needsLink below
    }

    // no matching app user found — do NOT create a new user automatically.
    // Return a response indicating linking is required and include minimal profile info
    return new Response(JSON.stringify({ needsLink: true, profile: { lineId: userId, displayName, pictureUrl } }), { status: 200 });
  } catch (err) {
    console.error('API /api/auth/line error', err);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 });
  }
}
