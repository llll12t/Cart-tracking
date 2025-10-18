"use client";

import { useEffect, useState } from 'react';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import useLiff from './useLiff';

export default function useLiffAuth() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { liff, profile, loading: liffLoading, error: liffError } = useLiff(process.env.NEXT_PUBLIC_LIFF_ID);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        if (liffLoading) return; // wait for liff to init
        if (liffError) {
          setError(liffError);
          setLoading(false);
          return;
        }

        if (!liff) {
          setError('LIFF not available');
          setLoading(false);
          return;
        }

        // get access token (mock or real)
        const accessToken = typeof liff.getAccessToken === 'function' ? liff.getAccessToken() : null;
        if (!accessToken) {
          setError('no access token');
          setLoading(false);
          return;
        }

        // exchange with backend for Firebase custom token (use fetch to avoid axios dependency)
        const resp = await fetch('/api/auth/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });
        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`auth exchange failed: ${resp.status} ${errBody}`);
        }
        const body = await resp.json();
        const { customToken } = body;
        const auth = getAuth();
        await signInWithCustomToken(auth, customToken);
        if (!mounted) return;
        setLoading(false);
      } catch (err) {
        console.error('useLiffAuth error', err);
        setError(err?.message || 'liff-error');
        setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [liff, liffLoading, liffError]);

  return { loading, error };
}
