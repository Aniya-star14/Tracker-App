export function initPresetEditor(defaultPreset, callbacks){
  const el = id=>document.getElementById(id);
  const editor = el('preset-editor');
  const nameInput = el('editor-name');
  const totalMin = el('editor-total-min');
  const list = el('editor-checkpoints');
  const newLabel = el('new-label');
  const newMin = el('new-min');
  const newSec = el('new-sec');

  // helper: convert checkpoints with offsets into durations
  function offsetsToDurations(checkpoints, totalSeconds){
    const out = [];
    let prev = 0;
    for(const cp of (checkpoints||[])){
      const offset = cp.offset || 0;
      const dur = Math.max(0, offset - prev);
      out.push({ id: cp.id, label: cp.label, duration: dur, channels: cp.channels || {}, requiresConfirm: !!cp.requiresConfirm });
      prev = offset;
    }
    // if there is a trailing duration (totalSeconds - last offset) and no extra cp, ignore
    return out;
  }

  // working model stores per-checkpoint durations (seconds) for editing
  let working = {
    id: defaultPreset.id,
    name: defaultPreset.name,
    totalSeconds: defaultPreset.totalSeconds,
    checkpoints: offsetsToDurations(defaultPreset.checkpoints, defaultPreset.totalSeconds)
  };

  function render(){
    nameInput.value = working.name || '';
    totalMin.value = Math.ceil((working.totalSeconds||0)/60) || 20;
    list.innerHTML = '';
    working.checkpoints.forEach((cp, idx)=>{
      const li = document.createElement('li');
      li.className = 'cp-row';
      const left = document.createElement('div');
      left.className = 'cp-left';
      left.textContent = `${Math.floor(cp.duration/60)}:${String(cp.duration%60).padStart(2,'0')} — ${cp.label}`;
      const controls = document.createElement('div');
      controls.className = 'cp-controls';
      const up = document.createElement('button'); up.textContent='↑';
      const down = document.createElement('button'); down.textContent='↓';
      const edit = document.createElement('button'); edit.textContent='Edit';
      const test = document.createElement('button'); test.textContent='test';
      const del = document.createElement('button'); del.textContent='✕';

      up.addEventListener('click', ()=>{ if(idx>0){ working.checkpoints.splice(idx-1,0,working.checkpoints.splice(idx,1)[0]); render(); } });
      down.addEventListener('click', ()=>{ if(idx<working.checkpoints.length-1){ working.checkpoints.splice(idx+1,0,working.checkpoints.splice(idx,1)[0]); render(); } });
      del.addEventListener('click', ()=>{ working.checkpoints.splice(idx,1); render(); });
      test.addEventListener('click', ()=>{ if(callbacks && callbacks.onTest) callbacks.onTest(cp); });

      // Inline edit handler
      edit.addEventListener('click', ()=>{
        // replace li content with edit form
        li.innerHTML = '';
        const labelInput = document.createElement('input'); labelInput.value = cp.label;
        const minInput = document.createElement('input'); minInput.type = 'number'; minInput.min = 0; minInput.value = Math.floor((cp.duration||0)/60);
        const secInput = document.createElement('input'); secInput.type = 'number'; secInput.min = 0; secInput.max = 59; secInput.value = (cp.duration||0)%60;
        const chkAudio = document.createElement('input'); chkAudio.type='checkbox'; chkAudio.checked = !!(cp.channels && cp.channels.audio);
        const lblAudio = document.createElement('label'); lblAudio.textContent='Audio'; lblAudio.prepend(chkAudio);
        const chkNotify = document.createElement('input'); chkNotify.type='checkbox'; chkNotify.checked = !!(cp.channels && cp.channels.notification);
        const lblNotify = document.createElement('label'); lblNotify.textContent='Notify'; lblNotify.prepend(chkNotify);
        const chkVibe = document.createElement('input'); chkVibe.type='checkbox'; chkVibe.checked = !!(cp.channels && cp.channels.vibration);
        const lblVibe = document.createElement('label'); lblVibe.textContent='Vibe'; lblVibe.prepend(chkVibe);
        const chkVisual = document.createElement('input'); chkVisual.type='checkbox'; chkVisual.checked = !!(cp.channels && cp.channels.visual);
        const lblVisual = document.createElement('label'); lblVisual.textContent='Visual'; lblVisual.prepend(chkVisual);
        const chkConfirm = document.createElement('input'); chkConfirm.type='checkbox'; chkConfirm.checked = !!cp.requiresConfirm;
        const lblConfirm = document.createElement('label'); lblConfirm.textContent='Requires confirm'; lblConfirm.prepend(chkConfirm);
        const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save';
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel';

        saveBtn.addEventListener('click', ()=>{
          const label = labelInput.value.trim() || cp.label;
          const m = parseInt(minInput.value||0,10);
          const s = parseInt(secInput.value||0,10);
          working.checkpoints[idx].label = label;
          working.checkpoints[idx].duration = (m*60) + (s||0);
          working.checkpoints[idx].channels = { audio: !!chkAudio.checked, notification: !!chkNotify.checked, vibration: !!chkVibe.checked, visual: !!chkVisual.checked };
          working.checkpoints[idx].requiresConfirm = !!chkConfirm.checked;
          render();
        });

        cancelBtn.addEventListener('click', ()=>{ render(); });

        const form = document.createElement('div');
        form.style.display = 'flex'; form.style.gap = '0.5rem'; form.style.alignItems = 'center';
        form.appendChild(labelInput);
        form.appendChild(minInput);
        form.appendChild(secInput);
        form.appendChild(lblAudio);
        form.appendChild(lblNotify);
        form.appendChild(lblVibe);
        form.appendChild(lblVisual);
        form.appendChild(lblConfirm);
        form.appendChild(saveBtn);
        form.appendChild(cancelBtn);
        li.appendChild(form);
      });

      controls.appendChild(up); controls.appendChild(down); controls.appendChild(edit); controls.appendChild(test); controls.appendChild(del);
      li.appendChild(left); li.appendChild(controls);
      list.appendChild(li);
    });
  }

  el('edit-preset').addEventListener('click', ()=>{
    // rebuild working from defaultPreset
    working = {
      id: defaultPreset.id,
      name: defaultPreset.name,
      totalSeconds: defaultPreset.totalSeconds,
      checkpoints: offsetsToDurations(defaultPreset.checkpoints, defaultPreset.totalSeconds)
    };
    editor.classList.remove('hidden'); render();
  });

  el('cancel-preset').addEventListener('click', ()=>{ editor.classList.add('hidden'); });

  el('add-cp').addEventListener('click', ()=>{
    const label = newLabel.value.trim();
    const m = parseInt(newMin.value||0,10);
    const s = parseInt(newSec.value||0,10);
    if(!label) return;
    const duration = (m*60)+(s||0);
    working.checkpoints.push({ id: `cp-${Date.now()}`, label, duration, channels: { audio:true, notification:false, vibration:true, visual:true }, requiresConfirm: false });
    newLabel.value=''; newMin.value=''; newSec.value=''; render();
  });

  el('save-preset').addEventListener('click', ()=>{
    working.name = nameInput.value || 'Preset';
    working.totalSeconds = (parseInt(totalMin.value||20,10)||20)*60;
    // convert durations into offsets (cumulative)
    let cum = 0;
    const cpWithOffsets = working.checkpoints.map(cp=>{
      const offset = cum;
      const out = { id: cp.id, label: cp.label, offset, channels: cp.channels || {}, requiresConfirm: !!cp.requiresConfirm };
      cum += (cp.duration||0);
      return out;
    });
    // ensure totalSeconds at least sum
    if (working.totalSeconds < cum) working.totalSeconds = cum;
    const presetOut = { id: working.id || `preset-${Date.now()}`, name: working.name, totalSeconds: working.totalSeconds, checkpoints: cpWithOffsets };
    editor.classList.add('hidden');
    if(callbacks && callbacks.onSave) callbacks.onSave(presetOut);
  });

  // expose methods to programmatically open/close the editor with a preset
  return {
    openWith(p){ working = {
      id: p.id,
      name: p.name,
      totalSeconds: p.totalSeconds,
      checkpoints: offsetsToDurations(p.checkpoints, p.totalSeconds)
    }; editor.classList.remove('hidden'); render(); },
    close(){ editor.classList.add('hidden'); }
  };
}
