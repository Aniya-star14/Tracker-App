import { db } from './db.js';
import { initPresetEditor } from './presetEditor.js';
import * as nativeNotifier from './nativeNotifier.js';

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

let session = null;
let presetEditor = null;
let sessionState = null; // { durations, index, timerId, statuses, paused, snooze }
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
  const ul = $('presets'); ul.innerHTML='';
  try{
    const presets = await db.getPresets();
    presets.forEach(p=>{
      const li = document.createElement('li');
      const name = document.createElement('div'); name.textContent = p.name;
      const pick = document.createElement('button'); pick.textContent='Select';
      const del = document.createElement('button'); del.textContent='Delete';
      pick.addEventListener('click', ()=>{ setCurrentPreset(p); log(`Preset selected: ${p.name}`); });
      del.addEventListener('click', async ()=>{ await db.deletePreset(p.id); await renderPresets(); });
      li.appendChild(name); li.appendChild(pick); li.appendChild(del);
      ul.appendChild(li);
    });
  }catch(e){ console.warn('renderPresets failed', e); }
}

// direct indexedDB access removed; use `db` helpers in src/db.js

async function triggerAlert(cp){
  log(`Alert: ${cp.label}`);
  // determine effective channels: per-checkpoint overrides global settings when provided
  const ch = cp.channels || {};
  const useAudio = (typeof ch.audio === 'boolean') ? ch.audio : settings.audio;
  const useNotification = (typeof ch.notification === 'boolean') ? ch.notification : settings.notification;
  const useVibration = (typeof ch.vibration === 'boolean') ? ch.vibration : settings.vibration;
  const useVisual = (typeof ch.visual === 'boolean') ? ch.visual : settings.visual;

  // Try to resume audio context if it's suspended (may fail without user gesture)
  try{
    if (audioCtx && audioCtx.state === 'suspended'){
      await audioCtx.resume();
    }
  }catch(e){
    console.warn('Audio resume blocked or failed', e);
  }

  // Visual
  if (useVisual){
    const next = $('next'); next.textContent = `Next: ${cp.label}`;
    next.classList.add('pulse');
    setTimeout(()=>next.classList.remove('pulse'),400);
  }

  // Vibration
  if (useVibration && navigator.vibrate) navigator.vibrate([30]);

  // Audio beep via WebAudio (headphones / sound)
  if (useAudio){
    try{
      initAudio();
      // Only play if audio context is running; resume above may fail if not a user gesture.
      if (audioCtx && audioCtx.state !== 'suspended'){
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
      } else {
        console.debug('AudioContext suspended; skipping audio alert');
      }
    }catch(e){ console.warn('Audio alert failed', e); }
  }

  // Notification
  if (useNotification && window.Notification && Notification.permission === 'granted'){
    new Notification(cp.label, { silent: true, badge: '/icons/icon-192.png' });
  }

  // Record checkpoint time if session
  if (session){
    session.actualCheckpoints.push({ id: cp.id, label: cp.label, t: Date.now() });
    db.saveSession(session);
  }
}

// Deprecated helpers removed: sequential scheduling uses `sessionState` timeouts.

function log(msg){
  const ul = $('log'); const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${msg}`; ul.prepend(li);
}

function startSession(){
  // initialize session object
  session = { presetId: defaultPreset.id, startTime: Date.now(), actualCheckpoints: [] };
  db.savePreset(defaultPreset);
  db.saveSession(session);
  // build durations between checkpoints
  const cps = defaultPreset.checkpoints || [];
  const durations = [];
  for(let i=0;i<cps.length;i++){
    if (i===0) durations.push(cps[0].offset || 0);
    else durations.push((cps[i].offset - cps[i-1].offset) || 0);
  }
  sessionState = { durations, index:0, timerId:null, statuses: cps.map(()=> 'pending'), paused:false, snooze:0 };
  renderTimeline();
  updateSessionControls();
  scheduleNextCheckpoint();
  // schedule native local notifications (for background reliability)
  try{ if (nativeNotifier && nativeNotifier.isAvailable && nativeNotifier.isAvailable()){ nativeNotifier.scheduleSessionNotifications(session.startTime, defaultPreset.checkpoints); } }catch(e){}
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
  // clear sequential timer
  if (sessionState){ if (sessionState.timerId) clearTimeout(sessionState.timerId); sessionState=null; }
  try{ if (nativeNotifier && nativeNotifier.cancelAllNotifications) nativeNotifier.cancelAllNotifications(); }catch(e){}
  clearInterval(window._sessionTimer);
  $('start').disabled = false; $('stop').disabled = true;
  // reset control buttons
  $('confirm-cp').disabled = true;
  $('snooze-cp').disabled = true;
  $('skip-cp').disabled = true;
  $('pause-session').disabled = true;
  if (session){ session.endTime = Date.now(); db.saveSession(session); log('Session stopped'); session=null; }
}

function scheduleNextCheckpoint(){
  if (!sessionState) return;
  const idx = sessionState.index;
  if (idx >= sessionState.durations.length) { log('All checkpoints completed'); return; }
  const delay = (sessionState.durations[idx] + (sessionState.snooze || 0));
  // clear any existing
  if (sessionState.timerId) clearTimeout(sessionState.timerId);
  sessionState.snooze = 0;
  // diagnostic log: record when this checkpoint is scheduled to fire
  const scheduledAt = Date.now() + (delay*1000);
  log(`Scheduling checkpoint ${idx} (${defaultPreset.checkpoints[idx]?.label || '—'}) in ${delay}s (at ${new Date(scheduledAt).toLocaleTimeString()})`);
  sessionState.timerId = setTimeout(()=>onCheckpoint(idx), delay*1000);
  updateNextDisplay(idx);
}

function onCheckpoint(idx){
  if (!sessionState) return;
  sessionState.statuses[idx] = 'alerted';
  log(`onCheckpoint fired for ${idx} (${defaultPreset.checkpoints[idx]?.label || '—'}) at ${new Date().toLocaleTimeString()}`);
  sessionState.timerId = null;
  renderTimeline();
  const cp = defaultPreset.checkpoints[idx];
  triggerAlert(cp);
  // enable confirm/snooze/skip
  updateSessionControls();
  // if no confirm required, auto-complete and move to next
  const requiresConfirm = cp.requiresConfirm || false;
  if (!requiresConfirm){
    sessionState.statuses[idx] = 'completed';
    sessionState.index = idx + 1;
    renderTimeline();
    // schedule next after tiny gap
    sessionState.timerId = setTimeout(()=>{ scheduleNextCheckpoint(); }, 200);
  }
}

function updateNextDisplay(idx){
  const nextEl = $('next');
  const cp = defaultPreset.checkpoints[idx];
  if (cp) nextEl.textContent = `Next: ${cp.label} (${formatTime(sessionState.durations[idx])})`;
  else nextEl.textContent = 'Next: —';
}

function renderTimeline(){
  const ul = $('session-timeline'); ul.innerHTML = '';
  const cps = defaultPreset.checkpoints || [];
  cps.forEach((cp, i)=>{
    const li = document.createElement('li');
    const label = document.createElement('div'); label.textContent = `${formatTime(cp.offset)} — ${cp.label}`;
    const status = document.createElement('div'); status.className = 'cp-status ' + (sessionState? sessionState.statuses[i] : 'pending');
    status.textContent = sessionState? sessionState.statuses[i] : 'pending';
    li.appendChild(label); li.appendChild(status);
    ul.appendChild(li);
  });
}

function updateSessionControls(){
  const confirmBtn = $('confirm-cp');
  const snoozeBtn = $('snooze-cp');
  const skipBtn = $('skip-cp');
  const pauseBtn = $('pause-session');
  if (!sessionState){ confirmBtn.disabled = true; snoozeBtn.disabled = true; skipBtn.disabled = true; pauseBtn.disabled = true; return; }
  const idx = sessionState.index;
  const status = sessionState.statuses[idx];
  // enable controls if current checkpoint is alerted
  const active = (status === 'alerted');
  confirmBtn.disabled = !active;
  snoozeBtn.disabled = !active;
  skipBtn.disabled = !active;
  pauseBtn.disabled = false;
  // attach handlers
  confirmBtn.onclick = ()=>{
    // mark confirmed and advance
    const cp = defaultPreset.checkpoints[idx];
    sessionState.statuses[idx] = 'confirmed'; renderTimeline();
    // cancel native notification for this checkpoint
    try{ if (nativeNotifier && nativeNotifier.cancelNotificationForCheckpoint) nativeNotifier.cancelNotificationForCheckpoint(cp); }catch(e){}
    sessionState.index = idx + 1; db.saveSession(session);
    scheduleNextCheckpoint();
  };
  snoozeBtn.onclick = ()=>{
    // add 10s snooze and reschedule next checkpoint
    const cp = defaultPreset.checkpoints[idx];
    sessionState.statuses[idx] = 'snoozed'; renderTimeline();
    sessionState.snooze = 10; // seconds
    try{ if (nativeNotifier && nativeNotifier.snoozeNotification) nativeNotifier.snoozeNotification(cp, 10); }catch(e){}
    scheduleNextCheckpoint();
  };
  skipBtn.onclick = ()=>{
    const cp = defaultPreset.checkpoints[idx];
    sessionState.statuses[idx] = 'skipped'; renderTimeline();
    try{ if (nativeNotifier && nativeNotifier.cancelNotificationForCheckpoint) nativeNotifier.cancelNotificationForCheckpoint(cp); }catch(e){}
    sessionState.index = idx + 1; db.saveSession(session);
    scheduleNextCheckpoint();
  };
  pauseBtn.onclick = ()=>{
    if (!sessionState.paused){
      // pause
      sessionState.paused = true; if (sessionState.timerId) clearTimeout(sessionState.timerId); sessionState.timerId = null; pauseBtn.textContent = 'Resume'; log('Session paused');
    } else {
      sessionState.paused = false; pauseBtn.textContent = 'Pause'; log('Session resumed'); scheduleNextCheckpoint();
    }
  };
}

async function ensureNotifications(){
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
}

function init(){
  renderPreset(defaultPreset);
  $('start').addEventListener('click', startSession);
  $('enable-alerts').addEventListener('click', enableAlerts);
  $('stop').addEventListener('click', stopSession);
  $('test-alert').addEventListener('click', ()=>triggerAlert({label:'Test Alert'}));
  $('clear-log').addEventListener('click', ()=>{ $('log').innerHTML=''; });
  ensureNotifications();

  // initialize native notifier (if running in Capacitor)
  try{ nativeNotifier.initNative().then(av=>{ if (av) console.log('Native notifications available'); }); }catch(e){}

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
  const newBtn = $('new-preset');
  if (newBtn) newBtn.addEventListener('click', ()=>{
    const p = { id: `preset-${Date.now()}`, name: 'New Preset', totalSeconds: 10*60, checkpoints: [] };
    presetEditor.openWith(p);
  });

  // Edit selected preset (opens editor with current defaultPreset)
  const editBtn = $('edit-preset');
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
  const volSlider = $('volume-slider');
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
      // if enabling notifications, ensure permission
      if (key === 'notification' && settings.notification){
        await ensureNotifications();
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

async function enableAlerts(){
  try{
    // resume audio context with user gesture
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
  }catch(e){ console.warn('enableAlerts audio resume failed', e); }
  try{ await ensureNotifications(); }catch(e){}
  try{ if (navigator.vibrate) navigator.vibrate([40]); }catch(e){}
  log('Alerts enabled (audio/notification/vibration request sent)');
}

window.addEventListener('load', init);
