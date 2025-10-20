// src/hooks/useLiff.js

"use client";

import { useState, useEffect } from 'react';

const MOCK_PROFILE = {
    userId: 'U8d286780c70cf7d60a0ff5704dcf2319',
    displayName: 'คุณ ทดสอบ',
    pictureUrl: 'https://lh5.googleusercontent.com/d/10mcLZP15XqebnVb1IaODQLhZ93EWT7h7'
};

const useLiff = (liffId) => {
    const [liffObject, setLiffObject] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const initializeLiff = async () => {
            // Check LIFF_MOCK in localStorage เท่านั้น
            let isMock = false;
            try {
                if (typeof window !== 'undefined') {
                    const mockFlag = window.localStorage.getItem('LIFF_MOCK');
                    isMock = mockFlag === '1' || mockFlag === 'true';
                }
            } catch (e) {}
            if (isMock || process.env.NODE_ENV === 'development') {
                console.warn("LIFF mock mode is active.");
                // Mock LIFF object with all necessary functions for development
                const mockLiff = {
                    isInClient: () => true,
                    isLoggedIn: () => true,
                    getIDToken: () => 'MOCK_ID_TOKEN',
                    closeWindow: () => {
                        console.log('Mock: LIFF window closed');
                        window.history.back();
                    },
                    sendMessages: async (messages) => {
                        console.log('Mock: Messages sent:', messages);
                        return Promise.resolve();
                    },
                    scanCodeV2: async () => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                resolve({ value: 'mock-appointment-id-12345' });
                            }, 1000);
                        });
                    }
                };
                setLiffObject(mockLiff);
                setProfile(MOCK_PROFILE);
                setLoading(false);
                return;
            }

            if (!liffId) {
                setError("LIFF ID is not provided.");
                setLoading(false);
                return;
            }
            try {
                const liff = (await import('@line/liff')).default;
                await liff.init({ liffId });

                const params = new URLSearchParams(window.location.search);
                let redirectPath = params.get('liff.state');

                // Normalize redirectPath: handle nested or double-encoded values like
                // %3Fliff.state%3D%252Fconfirm%252F<id>
                if (redirectPath) {
                    try {
                        // decode repeatedly up to 3 times to handle double-encoding
                        let decoded = redirectPath;
                        for (let i = 0; i < 3; i++) {
                            const prev = decoded;
                            try { decoded = decodeURIComponent(decoded); } catch (e) { break; }
                            if (decoded === prev) break;
                        }

                        // If decoded contains nested liff.state=, extract its value
                        const nestedMatch = decoded.match(/liff\.state=([^&]+)/);
                        if (nestedMatch && nestedMatch[1]) {
                            try { decoded = decodeURIComponent(nestedMatch[1]); } catch (e) {}
                        }

                        // Trim whitespace and strip query string if present
                        decoded = decoded.split('?')[0].trim();

                        // Normalize: if it's an id-like token (no slashes), assume it's a booking id and build /confirm/<id>
                        let targetPath = decoded;
                        if (!targetPath.startsWith('/')) {
                            targetPath = '/' + targetPath;
                        }

                        const currentPath = window.location.pathname || '/';

                        // If the decoded path is just '/confirm' (no id) and we're already on /confirm, do nothing
                        if (targetPath === '/confirm' && currentPath === '/confirm') {
                            // remove liff.state from query to clean URL without navigation
                            const sp = new URLSearchParams(window.location.search);
                            sp.delete('liff.state');
                            const qs = sp.toString();
                            const newUrl = window.location.pathname + (qs ? `?${qs}` : '');
                            window.history.replaceState(null, '', newUrl);
                            return;
                        }

                        // If the target looks like '/<id>' (single segment) or '/confirm/<id>' then navigate to /confirm/<id>
                        const segments = targetPath.split('/').filter(Boolean);
                        if (segments.length === 1) {
                            // single segment, assume booking id
                            targetPath = `/confirm/${segments[0]}`;
                        } else if (segments.length >= 2 && segments[0] !== 'confirm') {
                            // multi-segment but not starting with confirm: don't redirect to external path
                            // guard: only allow /confirm/... to navigate
                            console.warn('liff.state contains path outside /confirm, ignoring:', targetPath);
                            return;
                        }

                        // Prevent open redirect: only navigate to internal /confirm paths
                        if (!targetPath.startsWith('/confirm')) return;

                        // If already at target, just clean query
                        if (currentPath === targetPath) {
                            const sp2 = new URLSearchParams(window.location.search);
                            sp2.delete('liff.state');
                            const qs2 = sp2.toString();
                            const newUrl2 = window.location.pathname + (qs2 ? `?${qs2}` : '');
                            window.history.replaceState(null, '', newUrl2);
                            return;
                        }

                        // Finally navigate to the target path
                        window.location.replace(targetPath);
                        return;
                    } catch (e) {
                        console.warn('Failed to normalize liff.state', e);
                    }
                }

                if (!liff.isLoggedIn()) {
                    liff.login({ 
                        redirectUri: window.location.href,
                        scope: 'profile openid chat_message.write'
                    });
                    return;
                }

                const userProfile = await liff.getProfile();
                setProfile(userProfile);
                setLiffObject(liff);

            } catch (err) {
                console.error("LIFF initialization failed", err);
                
                // Set a more user-friendly error message
                let userError = 'การเชื่อมต่อ LINE ไม่สมบูรณ์';
                if (err.message && err.message.includes('permission')) {
                    userError = 'สิทธิ์การเข้าถึง LINE ไม่เพียงพอ กรุณาอนุญาตสิทธิ์ในการส่งข้อความ';
                } else if (err.message && err.message.includes('scope')) {
                    userError = 'การตั้งค่า LIFF ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ';
                }
                
                setError(userError);
                
                // Provide mock data only if LIFF_MOCK is set
                if (isMock) {
                    console.warn('Setting up fallback mock data for LIFF_MOCK');
                    setLiffObject({
                        isInClient: () => false,
                        closeWindow: () => window.history.back(),
                        sendMessages: async () => console.log('Mock: Messages sent (fallback)')
                    });
                    setProfile(MOCK_PROFILE);
                }
            } finally {
                setLoading(false);
            }
        };

        initializeLiff();
    }, [liffId]);

    return { liff: liffObject, profile, loading, error };
};

export default useLiff;
