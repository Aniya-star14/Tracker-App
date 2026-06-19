# Data model — Barber Coach

This document outlines the primary data structures used by the app and next steps to implement them.

## Preset (stored in `presets` object store)
- `id` (string): unique id
- `name` (string)
- `totalSeconds` (number)
- `checkpoints` (array of checkpoint objects)

Checkpoint object:
- `id` (string)
- `label` (string)
- `offset` (number): seconds from session start
- `channels` (object): { audio?: boolean, notification?: boolean, vibration?: boolean, visual?: boolean }
- `requiresConfirm` (boolean)

Example:
```
{
  id: 'preset-1',
  name: 'Quick Cut',
  totalSeconds: 1200,
  checkpoints: [ { id:'c1', label:'Start', offset:0, channels:{audio:true}, requiresConfirm:true }, ... ]
}
```

## Session (stored in `sessions` object store)
- `id` (string) — can be startTime or uuid
- `presetId` (string)
- `startTime` (number)
- `endTime` (number | null)
- `actualCheckpoints` (array): [{ id, label, t, status }]
- `statuses` (object) optional snapshot of per-checkpoint statuses

Example:
```
{
  id: 168,...,
  presetId: 'preset-1',
  startTime: 168..., endTime: null,
  actualCheckpoints:[ { id:'c1', label:'Start', t:168..., status:'confirmed' }, ... ]
}
```

## Metrics / Reports
- Derivable from `sessions`: durations per checkpoint, on-time/late counts, average times, per-client history.

## Next implementation steps
1. Add `sessions` object store migration (if needed) and ensure `db.saveSession` stores `statuses` and `actualCheckpoints` snapshots.
2. Implement Preset import/export (JSON) UI and file download/upload handlers.
3. Add a compact preset card in `[index.html]` showing per-checkpoint badges (channels / require-confirm) for quick scan.
4. Add history screen that queries `sessions` and computes simple metrics (total sessions, avg duration, missed checkpoints).

Feel free to tell me which of the next steps you'd like started first; I'll implement it and update the TODOs as I go.
