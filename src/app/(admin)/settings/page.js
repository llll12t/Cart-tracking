"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [liffMock, setLiffMock] = useState(false);
  const [notifSettings, setNotifSettings] = useState(null);

  useEffect(() => {
    // load current notification settings
    async function load() {
      try {
        const res = await fetch('/api/notifications/settings');
        const data = await res.json();
        setNotifSettings(data.roles || null);
      } catch (err) {
        console.error('load notif settings', err);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const val = typeof window !== 'undefined' ? window.localStorage.getItem('LIFF_MOCK') : null;
    setLiffMock(val === '1' || val === 'true');
  }, []);

  const onToggle = (e) => {
    const next = e.target.checked;
    setLiffMock(next);
    try {
      if (next) window.localStorage.setItem('LIFF_MOCK', '1');
      else window.localStorage.removeItem('LIFF_MOCK');
    } catch (err) {
      console.error('localStorage error', err);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
  <Link href="/users" className="text-indigo-600 hover:text-indigo-800 mb-6 inline-block">&larr; ย้อนกลับ</Link>
  <h1 className="text-2xl font-bold mb-4">การตั้งค่า</h1>

      <div className="bg-white p-6 rounded-md shadow space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">โหมดจำลอง LIFF</div>
            <div className="text-sm text-gray-500">เมื่อเปิดใช้งาน แอปจะใช้โปรไฟล์ LIFF และโทเค็นจำลองสำหรับการพัฒนา/ทดสอบ</div>
          </div>
          <div>
            <label className="inline-flex items-center">
              <input type="checkbox" checked={liffMock} onChange={onToggle} className="form-checkbox h-5 w-5" />
            </label>
          </div>
        </div>

        <div>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded">รีโหลดเพื่อใช้การตั้งค่า</button>
        </div>
        <div>
          <h2 className="font-medium mb-3">การแจ้งเตือน (LINE)</h2>
          {!notifSettings ? (
            <div className="text-sm text-gray-500">กำลังโหลดการตั้งค่า...</div>
          ) : (
            <div className="space-y-4">
              {/* Admin toggles */}
              <div className="p-3 border rounded">
                <div className="font-semibold">ผู้ดูแลระบบ</div>
                <label className="flex items-center justify-between mt-2">
                  <span className="text-sm">เมื่อมีการจอง</span>
                  <input type="checkbox" checked={!!notifSettings.admin?.booking_created} onChange={e => setNotifSettings(s => ({...s, admin: {...s.admin, booking_created: e.target.checked}}))} />
                </label>
                <label className="flex items-center justify-between mt-2">
                  <span className="text-sm">คืนรถ</span>
                  <input type="checkbox" checked={!!notifSettings.admin?.vehicle_returned} onChange={e => setNotifSettings(s => ({...s, admin: {...s.admin, vehicle_returned: e.target.checked}}))} />
                </label>
              </div>

              {/* Driver toggles */}
              <div className="p-3 border rounded">
                <div className="font-semibold">คนขับ</div>
                <label className="flex items-center justify-between mt-2">
                  <span className="text-sm">เมื่อมีการจอง</span>
                  <input type="checkbox" checked={!!notifSettings.driver?.booking_created} onChange={e => setNotifSettings(s => ({...s, driver: {...s.driver, booking_created: e.target.checked}}))} />
                </label>
                <label className="flex items-center justify-between mt-2">
                  <span className="text-sm">อนุมัติรถแล้ว</span>
                  <input type="checkbox" checked={!!notifSettings.driver?.booking_approved} onChange={e => setNotifSettings(s => ({...s, driver: {...s.driver, booking_approved: e.target.checked}}))} />
                </label>
                <label className="flex items-center justify-between mt-2">
                  <span className="text-sm">เมื่อส่งรถ</span>
                  <input type="checkbox" checked={!!notifSettings.driver?.vehicle_sent} onChange={e => setNotifSettings(s => ({...s, driver: {...s.driver, vehicle_sent: e.target.checked}}))} />
                </label>
              </div>

              {/* Employee toggles */}
              <div className="p-3 border rounded">
                <div className="font-semibold">พนักงาน</div>
                <label className="flex items-center justify-between mt-2">
                  <span className="text-sm">เมื่อมีการจอง</span>
                  <input type="checkbox" checked={!!notifSettings.employee?.booking_created} onChange={e => setNotifSettings(s => ({...s, employee: {...s.employee, booking_created: e.target.checked}}))} />
                </label>
                <label className="flex items-center justify-between mt-2">
                  <span className="text-sm">คืนรถ</span>
                  <input type="checkbox" checked={!!notifSettings.employee?.vehicle_returned} onChange={e => setNotifSettings(s => ({...s, employee: {...s.employee, vehicle_returned: e.target.checked}}))} />
                </label>
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={async () => {
                  try {
                    await fetch('/api/notifications/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ roles: notifSettings }) });
                    alert('บันทึกการตั้งค่าเรียบร้อย');
                  } catch (err) { console.error(err); alert('ไม่สามารถบันทึกได้'); }
                }} className="px-4 py-2 bg-teal-600 text-white rounded">บันทึกการแจ้งเตือน</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
