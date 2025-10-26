"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [notifSettings, setNotifSettings] = useState(null);

  useEffect(() => {
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


  return (
    <div className="p-2 max-w-2xl">
  <h1 className="text-2xl font-bold mb-4">การตั้งค่า</h1>

      <div className="bg-white p-6 rounded-md shadow space-y-4">
        {/* ...removed LIFF Mock Mode toggle... */}
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
                  <span className="text-sm">เมื่อส่งรถ</span>
                  <input type="checkbox" checked={!!notifSettings.admin?.vehicle_sent} onChange={e => setNotifSettings(s => ({...s, admin: {...s.admin, vehicle_sent: e.target.checked}}))} />
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
                  <span className="text-sm">เมื่อส่งรถ</span>
                  <input type="checkbox" checked={!!notifSettings.employee?.vehicle_sent} onChange={e => setNotifSettings(s => ({...s, employee: {...s.employee, vehicle_sent: e.target.checked}}))} />
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
