"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [notifSettings, setNotifSettings] = useState(null);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [newType, setNewType] = useState('');
  const [savingTypes, setSavingTypes] = useState(false);
  const [usageLimits, setUsageLimits] = useState({ storageMB: 512, firestoreDocs: 10000 });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/notifications/settings');
        const data = await res.json();
        setNotifSettings(data.roles || null);
        setVehicleTypes(data.vehicleTypes || ['รถ SUV', 'รถเก๋ง', 'รถกระบะ', 'รถตู้', 'รถบรรทุก', 'มอเตอร์ไซค์', 'อื่นๆ']);
        setUsageLimits(data.usageLimits || { storageMB: 512, firestoreDocs: 10000 });
      } catch (err) {
        console.error('load notif settings', err);
      }
    }
    load();
  }, []);



  // usage limits are saved together with notification/settings; no separate save handler needed.


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 py-8 flex justify-center items-start">
      <div className="w-full container px-2 md:px-0">
        <div className="bg-white/90 p-8 rounded border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* left column: Notifications */}
            <div className="md:col-span-2">
              <div className="pt-0 md:pt-0">
                <h2 className="font-semibold text-lg text-blue-700 mb-4 flex items-center gap-2">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="#2563eb" d="M12 2a7 7 0 0 0-7 7v3.28c0 .44-.15.87-.43 1.22l-1.1 1.38A2 2 0 0 0 5 18h14a2 2 0 0 0 1.53-3.12l-1.1-1.38a1.98 1.98 0 0 1-.43-1.22V9a7 7 0 0 0-7-7Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z"/></svg>
                  การแจ้งเตือน (LINE)
                </h2>
                {!notifSettings ? (
                  <div className="text-sm text-gray-500">กำลังโหลดการตั้งค่า...</div>
                ) : (
                  <div className="space-y-6">
                    {/* Admin toggles */}
                    <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/40">
                      <div className="font-semibold text-blue-800 mb-2">ผู้ดูแลระบบ</div>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อมีการจอง</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.admin?.booking_created} onChange={e => setNotifSettings(s => ({...s, admin: {...s.admin, booking_created: e.target.checked}}))} />
                        </label>
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อยืมรถ</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.admin?.vehicle_borrowed} onChange={e => setNotifSettings(s => ({...s, admin: {...s.admin, vehicle_borrowed: e.target.checked}}))} />
                        </label>
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อคืนรถ</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.admin?.vehicle_returned} onChange={e => setNotifSettings(s => ({...s, admin: {...s.admin, vehicle_returned: e.target.checked}}))} />
                        </label>
                      </div>
                    </div>

                    {/* Driver toggles */}
                    <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/40">
                      <div className="font-semibold text-blue-800 mb-2">คนขับ</div>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อมีการจอง</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.driver?.booking_created} onChange={e => setNotifSettings(s => ({...s, driver: {...s.driver, booking_created: e.target.checked}}))} />
                        </label>
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อยืมรถ</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.driver?.vehicle_borrowed} onChange={e => setNotifSettings(s => ({...s, driver: {...s.driver, vehicle_borrowed: e.target.checked}}))} />
                        </label>
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อคืนรถ</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.driver?.vehicle_returned} onChange={e => setNotifSettings(s => ({...s, driver: {...s.driver, vehicle_returned: e.target.checked}}))} />
                        </label>
                      </div>
                    </div>

                    {/* Employee toggles */}
                    <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/40">
                      <div className="font-semibold text-blue-800 mb-2">พนักงาน</div>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อมีการจอง</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.employee?.booking_created} onChange={e => setNotifSettings(s => ({...s, employee: {...s.employee, booking_created: e.target.checked}}))} />
                        </label>
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อยืมรถ</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.employee?.vehicle_borrowed} onChange={e => setNotifSettings(s => ({...s, employee: {...s.employee, vehicle_borrowed: e.target.checked}}))} />
                        </label>
                        <label className="flex items-center justify-between">
                          <span className="text-sm">เมื่อคืนรถ</span>
                          <input type="checkbox" className="accent-blue-600 w-5 h-5" checked={!!notifSettings.employee?.vehicle_returned} onChange={e => setNotifSettings(s => ({...s, employee: {...s.employee, vehicle_returned: e.target.checked}}))} />
                        </label>
                      </div>
                    </div>

                    {/* Show message if all toggles are off */}
                    {[
                      notifSettings.admin?.booking_created,
                      notifSettings.admin?.vehicle_borrowed,
                      notifSettings.admin?.vehicle_returned,
                      notifSettings.driver?.booking_created,
                      notifSettings.driver?.vehicle_borrowed,
                      notifSettings.driver?.vehicle_returned,
                      notifSettings.employee?.booking_created,
                      notifSettings.employee?.vehicle_borrowed,
                      notifSettings.employee?.vehicle_returned
                    ].every(v => !v) && (
                      <div className="text-center text-sm text-red-500 font-medium">คุณไม่ได้เปิดการแจ้งเตือนใด ๆ</div>
                    )}

                    <div className="flex gap-3 justify-end mt-6">
                      <button onClick={async () => {
                        try {
                          await fetch('/api/notifications/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ roles: notifSettings, vehicleTypes, usageLimits }) });
                          alert('บันทึกการตั้งค่าเรียบร้อย');
                        } catch (err) { console.error(err); alert('ไม่สามารถบันทึกได้'); }
                      }} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition">บันทึกการแจ้งเตือน</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* right column: Vehicle Types */}
            <aside className="md:col-span-1">
              <div className="p-6 border border-blue-100 rounded bg-gradient-to-br from-blue-50 to-white  ">
                <h2 className="font-semibold text-lg text-blue-700 mb-4 flex items-center gap-2">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill="#2563eb" d="M3 13.5V11a2 2 0 0 1 2-2h1.28a2 2 0 0 0 1.42-.59l1.7-1.7A2 2 0 0 1 11.83 6h.34a2 2 0 0 1 1.42.59l1.7 1.7a2 2 0 0 0 1.42.59H19a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2h-1.28a2 2 0 0 0-1.42.59l-1.7 1.7a2 2 0 0 1-1.42.59h-.34a2 2 0 0 1-1.42-.59l-1.7-1.7a2 2 0 0 0-1.42-.59H5a2 2 0 0 1-2-2Z"/></svg>
                  ประเภทรถ
                </h2>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {vehicleTypes.map((type, idx) => (
                      <div key={idx} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 border border-blue-300 rounded-full shadow-sm">
                        <span className="text-sm text-blue-900 font-medium">{type}</span>
                        {vehicleTypes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setVehicleTypes(vehicleTypes.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 text-lg font-bold px-1"
                            title="ลบประเภทรถนี้"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newType.trim()) {
                          e.preventDefault();
                          if (!vehicleTypes.includes(newType.trim())) {
                            setVehicleTypes([...vehicleTypes, newType.trim()]);
                            setNewType('');
                          }
                        }
                      }}
                      placeholder="เพิ่มประเภทรถใหม่"
                      className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newType.trim() && !vehicleTypes.includes(newType.trim())) {
                          setVehicleTypes([...vehicleTypes, newType.trim()]);
                          setNewType('');
                        }
                      }}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition text-sm"
                    >
                      เพิ่ม
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        setSavingTypes(true);
                        try {
                          await fetch('/api/notifications/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ roles: notifSettings, vehicleTypes, usageLimits })
                          });
                          alert('บันทึกประเภทรถเรียบร้อย');
                        } catch (err) {
                          console.error(err);
                          alert('ไม่สามารถบันทึกได้');
                        } finally {
                          setSavingTypes(false);
                        }
                      }}
                      disabled={savingTypes}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                    >
                      {savingTypes ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
