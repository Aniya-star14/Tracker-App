// Native notifier wrapper using Capacitor Local Notifications.
// Falls back to no-op on web if Capacitor or plugin isn't installed.

let available = false;
let LocalNotifications = null;
let Capacitor = null;

function hashId(str){
  let h = 0; for(let i=0;i<str.length;i++){ h = ((h<<5)-h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

export async function initNative(){
  try{
    // dynamic imports so web usage doesn't fail when plugin not installed
    const core = await import('@capacitor/core');
    const ln = await import('@capacitor/local-notifications');
    Capacitor = core.Capacitor || (window.Capacitor);
    LocalNotifications = ln.LocalNotifications || ln.LocalNotification || (window.Capacitor && window.Capacitor.LocalNotifications);
    available = !!(Capacitor && LocalNotifications && (Capacitor.getPlatform ? Capacitor.getPlatform() !== 'web' : (Capacitor.isNativePlatform && Capacitor.isNativePlatform())));
    if (available){
      try{ await LocalNotifications.requestPermissions(); }catch(e){}
    }
  }catch(e){ available = false; }
  return available;
}

export function isAvailable(){ return available; }

export async function scheduleSessionNotifications(startTimeMillis, checkpoints){
  if (!available) return;
  try{
    const notes = (checkpoints||[]).map(cp=>({
      id: hashId(cp.id || cp.label),
      title: cp.label || 'Checkpoint',
      body: '',
      schedule: { at: new Date(startTimeMillis + (cp.offset||0)*1000) }
    }));
    await LocalNotifications.schedule({ notifications: notes });
  }catch(e){ console.warn('Native schedule failed', e); }
}

export async function cancelAllNotifications(){
  if (!available) return;
  try{ await LocalNotifications.cancel({ notifications: [] }); }catch(e){ try{ await LocalNotifications.cancelAll(); }catch(e2){} }
}

export async function cancelNotificationForCheckpoint(cp){
  if (!available) return;
  try{ const id = hashId(cp.id || cp.label); await LocalNotifications.cancel({ notifications: [{ id }] }); }catch(e){ }
}

export async function snoozeNotification(cp, seconds){
  if (!available) return;
  try{
    const id = hashId(cp.id || cp.label);
    // cancel existing and reschedule
    await LocalNotifications.cancel({ notifications: [{ id }] });
    const at = new Date(Date.now() + (seconds||10)*1000);
    await LocalNotifications.schedule({ notifications: [{ id, title: cp.label, body:'', schedule: { at } }] });
  }catch(e){ console.warn('Native snooze failed', e); }
}
