import { db } from './db.js';
import { initPresetEditor } from './presetEditor.js';

const defaultPreset = {
  id: 'quick-cut',
  name: 'Quick Cut — 20m',
  totalSeconds: 20 * 60,
  checkpoints: [
    { id: 'c1', label: 'Start / Consult', offset: 0 },
    { id: 'c2', label: 'Sides', offset: 5 * 60 },
    { id: 'c3', label: 'Top', offset: 12 * 60 },
    { id: 'c4', label: 'Blend/Finish', offset: 17 * 60 }
  ]
};

let timers = [];
let session = null;
let presetEditor = null;
const SETTINGS_KEY = 'barber-coach-settings';
let settings = {
  audio: true,
  notification: false,
  vibration: true,
  visual: true
};
// audio engine
let audioCtx = null;
let masterGain = null;
let analyser = null;
let meterData = null;
let meterRaf = null;

function initAudio(){
  if (audioCtx) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    masterGain.gain.value = (settings.volume || 0.5);
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
    meterData = new Uint8Array(analyser.fftSize);
    startMeter();
  }catch(e){ console.warn('Audio init failed', e); }
}

function startMeter(){
  const levelEl = document.querySelector('#volume-meter .level');
  if (!analyser || !levelEl) return;
  function frame(){
    analyser.getByteTimeDomainData(meterData);
    // compute RMS
    let sum = 0;
    for(let i=0;i<meterData.length;i++){ const v = (meterData[i]-128)/128; sum += v*v; }
    const rms = Math.sqrt(sum/meterData.length);
    const pct = Math.min(1, rms*1.8);
    levelEl.style.height = `${Math.round(pct*100)}%`;
    meterRaf = requestAnimationFrame(frame);
  }
  if (!meterRaf) frame();
}

function stopMeter(){ if (meterRaf){ cancelAnimationFrame(meterRaf); meterRaf = null; } }

function $(id){return document.getElementById(id)}

function formatTime(s){
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = (s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}

function renderPreset(p){
  $('preset-name').textContent = p.name;
  const ul = $('checkpoints'); ul.innerHTML = '';
  p.checkpoints.forEach(cp => {
    const li = document.createElement('li');
    li.textContent = `${formatTime(cp.offset)} — ${cp.label}`;
    ul.appendChild(li);
  });
}

function setCurrentPreset(p){
  defaultPreset.id = p.id || defaultPreset.id;
  defaultPreset.name = p.name;
  defaultPreset.totalSeconds = p.totalSeconds;
  defaultPreset.checkpoints = p.checkpoints;
  renderPreset(defaultPreset);
}

async function renderPresets(){
  const ul = document.getElementById('presets'); ul.innerHTML='';
  try{
    const presets = await db.getPresets();
    presets.forEach(p=>{
      const li = document.createElement('li');
      const name = document.createElement('div'); name.textContent = p.name;
      const pick = document.createElement('button'); pick.textContent='Select';
      const del = document.createElement('button'); del.textContent='Delete';
      pick.addEventListener('click', ()=>{ setCurrentPreset(p); log(`Preset selected: ${p.name}`); });
      del.addEventListener('click', async ()=>{ await db.init(); const tx = (await openDB()).transaction('presets','readwrite'); tx.objectStore('presets').delete(p.id); tx.oncomplete = ()=>{ renderPresets(); }; });
      li.appendChild(name); li.appendChild(pick); li.appendChild(del);
      ul.appendChild(li);
    });
  }catch(e){ console.warn('renderPresets failed', e); }
}

// helper to open IDB directly for deletion fallback
function openDB(){ return new Promise((resolve,reject)=>{ const r=indexedDB.open('barber-coach-db'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }

async function triggerAlert(cp){
  log(`Alert: ${cp.label}`);
  // Visual
  if (settings.visual){
    const next = $('next'); next.textContent = `Next: ${cp.label}`;
    next.classList.add('pulse');
    setTimeout(()=>next.classList.remove('pulse'),400);
  }

  // Vibration
  if (settings.vibration && navigator.vibrate) navigator.vibrate([30]);

  // Audio beep via WebAudio (headphones / sound)
  if (settings.audio){
    try{
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const lg = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      // envelope
      const now = audioCtx.currentTime;
      lg.gain.setValueAtTime(1, now);
      lg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      o.connect(lg); lg.connect(masterGain);
      o.start();
      setTimeout(()=>{ try{ o.stop(); o.disconnect(); lg.disconnect(); }catch(e){} },140);
    }catch(e){/* ignore */}
  }

  // Notification
  if (settings.notification && window.Notification && Notification.permission === 'granted'){
    new Notification(cp.label, { silent: true, badge: '/icons/icon-192.png' });
  }

  // Record checkpoint time if session
  if (session){
    session.actualCheckpoints.push({ id: cp.id, label: cp.label, t: Date.now() });
    db.saveSession(session);
  }
}

function schedulePreset(p){
  clearTimers();
  const start = Date.now();
  p.checkpoints.forEach(cp=>{
    const delay = Math.max(0, cp.offset*1000);
    const id = setTimeout(()=>triggerAlert(cp), delay);
    timers.push(id);
  });
}

function clearTimers(){ timers.forEach(t=>clearTimeout(t)); timers=[]; }

function log(msg){
  const ul = $('log'); const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${msg}`; ul.prepend(li);
}

function startSession(){
  session = { presetId: defaultPreset.id, startTime: Date.now(), actualCheckpoints: [] };
  db.savePreset(defaultPreset);
  db.saveSession(session);
  schedulePreset(defaultPreset);
  $('start').disabled = true; $('stop').disabled = false;
  log('Session started');
  // start timer UI
  const start = Date.now();
  let elapsed = 0;
  window._sessionTimer = setInterval(()=>{
    elapsed = Math.floor((Date.now()-start)/1000);
    $('timer').textContent = formatTime(elapsed);
  }, 500);
}

function stopSession(){
  clearTimers(); clearInterval(window._sessionTimer);
  $('start').disabled = false; $('stop').disabled = true;
  if (session){ session.endTime = Date.now(); db.saveSession(session); log('Session stopped'); session=null; }
}

async function ensureNotifications(){
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
}

function init(){
  renderPreset(defaultPreset);
  $('start').addEventListener('click', startSession);
  $('stop').addEventListener('click', stopSession);
  $('test-alert').addEventListener('click', ()=>triggerAlert({label:'Test Alert'}));
  document.getElementById('clear-log').addEventListener('click', ()=>{ document.getElementById('log').innerHTML=''; });
  ensureNotifications();

  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }

  // Initialize DB
  db.init();

  // ensure default preset exists
  (async ()=>{
    const presets = await db.getPresets();
    if (!presets || presets.length === 0){ await db.savePreset(defaultPreset); }
    await renderPresets();
  })();

  // New preset button
  const newBtn = document.getElementById('new-preset');
  if (newBtn) newBtn.addEventListener('click', ()=>{
    const p = { id: `preset-${Date.now()}`, name: 'New Preset', totalSeconds: 10*60, checkpoints: [] };
    presetEditor.openWith(p);
  });

  // Edit selected preset (opens editor with current defaultPreset)
  const editBtn = document.getElementById('edit-preset');
  if (editBtn) editBtn.addEventListener('click', ()=>{ presetEditor.openWith(defaultPreset); });

  // Load settings from localStorage
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = Object.assign(settings, JSON.parse(raw));
  }catch(e){}

  // ensure volume default
  if (typeof settings.volume !== 'number') settings.volume = 0.5;
  // init audio engine (does not auto-play)
  initAudio();

  // wire volume slider
  const volSlider = document.getElementById('volume-slider');
  if (volSlider){
    volSlider.value = Math.round((settings.volume||0.5)*100);
    volSlider.addEventListener('input', (e)=>{
      const v = Number(e.target.value)/100;
      settings.volume = v; localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      if (masterGain) masterGain.gain.value = v;
    });
  }

  // wire up settings buttons
  document.querySelectorAll('.alert-btn').forEach(btn=>{
    const key = btn.dataset.key;
    const update = ()=>{
      if (settings[key]) btn.classList.add('active'); else btn.classList.remove('active');
    };
    update();
    btn.addEventListener('click', async ()=>{
      settings[key] = !settings[key];
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      // if enabling notifications, request permission
      if (key === 'notification' && settings.notification && window.Notification && Notification.permission === 'default'){
        await Notification.requestPermission();
      }
      update();
    });
  });

  // Init preset editor module
  presetEditor = initPresetEditor(defaultPreset, {
    onSave: async (p)=>{ await db.savePreset(p); await renderPresets(); setCurrentPreset(p); log('Preset saved'); },
    onTest: (cp)=>{ triggerAlert(cp); }
  });
}

window.addEventListener('load', init);
