
/**
 * A simple IndexedDB wrapper to provide larger storage capacity (up to hundreds of MB or more)
 * compared to the 5MB limit of localStorage.
 */

const DB_NAME = 'StoreLayoutAuditorDB';
const STORE_NAME = 'kvStore';
const DB_VERSION = 1;

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const dbStorage = {
  async getItem<T>(key: string): Promise<T | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async removeItem(key: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clear(): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Helper to migrate data from localStorage to IndexedDB once
   */
  async migrateFromLocalStorage(keys: string[]): Promise<void> {
    try {
      const migrations = keys.map(async (key) => {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            await this.setItem(key, JSON.parse(val));
            // We don't remove from localStorage yet to be safe, 
            // but we could if we wanted to free up its space
          } catch (e) {
            // Fallback for non-JSON data
            await this.setItem(key, val);
          }
        }
      });
      await Promise.all(migrations);
    } catch (err) {
      console.error('Migration failed:', err);
    }
  }
};
