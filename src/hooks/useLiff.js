"use client";

import { useState, useEffect } from 'react';

const useLiff = (liffId) => {
    const [liffObject, setLiffObject] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const initializeLiff = async () => {
            // ปิดการใช้งาน Mockup ถาวร ตามที่คุณต้องการ
            // หากต้องการล้างค่าที่ค้างใน localStorage สามารถ uncomment บรรทัดล่างนี้ได้
            // if (typeof window !== 'undefined') window.localStorage.removeItem('LIFF_MOCK');

            if (!liffId) {
                setError("LIFF ID is not provided.");
                setLoading(false);
                return;
            }

            try {
                const liff = (await import('@line/liff')).default;
                await liff.init({ liffId });

                // จัดการ liff.state ที่ค้างอยู่ใน URL (ถ้ามี)
                const params = new URLSearchParams(window.location.search);
                let redirectPath = params.get('liff.state');
                if (redirectPath) {
                    // ... (logic เดิมสำหรับ clean url) ...
                    // ส่วนนี้คงไว้เหมือนเดิมเพื่อให้ redirect ทำงานถูกต้อง
                    try {
                        let decoded = redirectPath;
                        for (let i = 0; i < 3; i++) {
                            const prev = decoded;
                            try { decoded = decodeURIComponent(decoded); } catch (e) { break; }
                            if (decoded === prev) break;
                        }
                        const nestedMatch = decoded.match(/liff\.state=([^&]+)/);
                        if (nestedMatch && nestedMatch[1]) {
                            try { decoded = decodeURIComponent(nestedMatch[1]); } catch (e) { }
                        }
                        decoded = decoded.split('?')[0].trim();
                        let targetPath = decoded;
                        if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

                        const currentPath = window.location.pathname || '/';
                        // Logic การ redirect หน้า confirm
                        if (targetPath.startsWith('/confirm') && currentPath !== targetPath) {
                            window.location.replace(targetPath);
                            return; // หยุดการทำงานเพื่อรอ redirect
                        }
                    } catch (e) {
                        console.warn('Failed to normalize liff.state', e);
                    }
                }

                if (!liff.isLoggedIn()) {
                    // กรณีต้อง Login: สั่ง Login
                    liff.login({
                        scope: 'profile openid chat_message.write'
                    });
                    return;
                }

                // กรณี Login แล้ว: เก็บค่า liff และจบการโหลด
                setLiffObject(liff);
                setLoading(false);

            } catch (err) {
                console.error("LIFF initialization failed", err);
                const detailedError = `การเชื่อมต่อ LINE ไม่สมบูรณ์: ${err.message || 'Unknown error'}`;
                setError(detailedError);
                setLoading(false); // จบการโหลดเมื่อเกิด Error
            }
        };

        initializeLiff();
    }, [liffId]);

    return { liff: liffObject, profile, loading, error };
};

export default useLiff;
