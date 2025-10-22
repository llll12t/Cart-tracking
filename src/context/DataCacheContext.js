"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';

const DataCacheContext = createContext(null);
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes default

function storageKey(name) { return `dataCache:${name}`; }

async function fetchCollection(name) {
  const snap = await getDocs(query(collection(db, name)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function DataCacheProvider({ children }) {
  const [vehicles, setVehicles] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [maintenances, setMaintenances] = useState(null);
  const [fuelLogs, setFuelLogs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const now = Date.now();

      const loadOrCache = async (name, setter) => {
        try {
          const key = storageKey(name);
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.ts && (now - parsed.ts) < CACHE_TTL) {
              setter(parsed.data);
              return;
            }
          }
          const data = await fetchCollection(name);
          localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
          setter(data);
        } catch (e) {
          console.error('DataCache load error', name, e);
        }
      };

      await Promise.all([
        loadOrCache('vehicles', setVehicles),
        loadOrCache('bookings', setBookings),
        loadOrCache('maintenances', setMaintenances),
        loadOrCache('fuel_logs', setFuelLogs)
      ]);

      if (mounted) setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const refresh = async (collectionName) => {
    const key = storageKey(collectionName);
    try {
      const data = await fetchCollection(collectionName);
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
      // update state
      if (collectionName === 'vehicles') setVehicles(data);
      if (collectionName === 'bookings') setBookings(data);
      if (collectionName === 'maintenances') setMaintenances(data);
      if (collectionName === 'fuel_logs') setFuelLogs(data);
    } catch (e) { console.error('refresh error', e); }
  };

  return (
    <DataCacheContext.Provider value={{ vehicles, bookings, maintenances, fuelLogs, loading, refresh }}>
      {children}
    </DataCacheContext.Provider>
  );
}

export const useDataCache = () => useContext(DataCacheContext);

export default DataCacheContext;
