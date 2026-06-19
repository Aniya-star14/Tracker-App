const DB_NAME = 'barber-coach-db';
const DB_VERSION = 1;
let _db = null;

function open(){
  return new Promise((resolve, reject)=>{
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if (!db.objectStoreNames.contains('presets')) db.createObjectStore('presets',{keyPath:'id'});
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions',{keyPath:'startTime'});
    };
    r.onsuccess = ()=>{ _db = r.result; resolve(_db); };
    r.onerror = ()=>reject(r.error);
  });
}

export const db = {
  async init(){ if (!_db) await open(); },
  async savePreset(p){ await this.init(); const tx=_db.transaction('presets','readwrite'); tx.objectStore('presets').put(p); },
  async deletePreset(id){ await this.init(); const tx=_db.transaction('presets','readwrite'); tx.objectStore('presets').delete(id); },
  async getPresets(){ await this.init(); return new Promise(r=>{ const tx=_db.transaction('presets'); const a=[]; tx.objectStore('presets').openCursor().onsuccess = (e)=>{ const cur = e.target.result; if (!cur) return r(a); a.push(cur.value); cur.continue(); }; }); },
  async saveSession(s){ await this.init(); const tx=_db.transaction('sessions','readwrite'); tx.objectStore('sessions').put(s); },
  async getSessions(){ await this.init(); return new Promise(r=>{ const tx=_db.transaction('sessions'); const a=[]; tx.objectStore('sessions').openCursor().onsuccess = (e)=>{ const cur = e.target.result; if (!cur) return r(a); a.push(cur.value); cur.continue(); }; }); }
};
