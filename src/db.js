/**
 * IndexedDB database — stores only PDF metadata (name + page).
 * No binary data, so it's fast and reliable.
 */

const DB_NAME = 'ChessPDFReader';
const DB_VERSION = 1;
const STORE = 'sessions';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'pdfName' });
    };
  });
}

/** Save (or update) the last page for a given PDF name. */
export async function saveSession(pdfName, pageNumber) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ pdfName, pageNumber, savedAt: Date.now() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Load the last saved page for a given PDF name. Returns null if not found. */
export async function loadSession(pdfName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(pdfName);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
