"use client";

import { useEffect, useState } from 'react';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import useLiff from './useLiff';

export default function useLiffAuth() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsLink, setNeedsLink] = useState(false);
  const [linkProfile, setLinkProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // เพิ่ม state สำหรับเก็บ userProfile
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
        if (body.needsLink) {
          // server reports there's no matching app user — surface profile
          setNeedsLink(true);
          setLinkProfile(body.profile || null);
          setLoading(false);
          return;
        }
        const { customToken, userProfile: receivedProfile } = body;

        // เก็บ userProfile ที่ได้จาก API
        if (receivedProfile) {
          setUserProfile(receivedProfile);
        }

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

  // helper: link by phone -> POST /api/auth/line/link
  const linkByPhone = async (phone) => {
    setLoading(true);
    setError(null);
    try {
      if (!linkProfile?.lineId) throw new Error('no_profile');
      const resp = await fetch('/api/auth/line/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId: linkProfile.lineId, phone }),
      });
      const body = await resp.json();
      if (!resp.ok) {
        throw new Error(body?.error || 'link_failed');
      }
      const { customToken, userProfile: receivedProfile } = body;

      // เก็บ userProfile ที่ได้จาก link API
      if (receivedProfile) {
        setUserProfile(receivedProfile);
      }

      const auth = getAuth();
      await signInWithCustomToken(auth, customToken);
      setNeedsLink(false);
      setLinkProfile(null);
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('linkByPhone error', err);
      setError(err?.message || 'link-error');
      setLoading(false);
      return { success: false, error: err?.message };
    }
  };

  return { loading, error, needsLink, linkProfile, linkByPhone, userProfile };
}
