# Device verification checklist

This checklist helps verify the app on Android and iOS (PWA and Capacitor builds).

Preparations
- Ensure the app is served over HTTPS or use `localhost` for development.
- If using Capacitor, install the native projects and plugins:
  - `npm install @capacitor/core @capacitor/cli @capacitor/local-notifications`
  - `npx cap sync`
  - `npx cap add android` / `npx cap add ios`

Checklist — PWA (browser install)
- [ ] Serve the app and open URL on the device (same network): `python -m http.server 8000`
- [ ] Open site in Chrome (Android) or Safari (iOS).
- [ ] Confirm `manifest.json` icons appear in devtools and the browser offers "Install" or "Add to Home Screen".
- [ ] Install the app to home screen and launch it — app should run in standalone window (no browser UI).
- [ ] Test audio alert: tap "Test Alert" — sound should play (use headphones to verify discreet audio).
- [ ] Test vibration: enable vibration in settings, tap "Test Alert" — device should vibrate.
- [ ] Test notifications: enable notifications and grant permission; confirm notification appears (silent badge) when Test Alert runs.
- [ ] Confirm timeline and Confirm/Snooze/Skip work while app is foregrounded.

Checklist — Capacitor native (recommended for background reliability)
- [ ] Build and run the native project on a device (emulator is optional but device is preferred).
- [ ] Grant notification permission when requested.
- [ ] Start a session with multiple checkpoints.
- [ ] Background the app (press home) before a checkpoint triggers and confirm a native local notification fires at the correct time.
- [ ] When returning to the app, confirm the checkpoint is marked alerted/completed appropriately and no duplicate alert persists.
- [ ] Test Snooze/Skip from the app UI and confirm native notification is cancelled or rescheduled accordingly.
- [ ] Test Confirm: when confirming a checkpoint, the native pending notification for that checkpoint should be removed.

Edge cases & troubleshooting
- If you see duplicate alerts (native + in-page), enable a short log to detect which fired first — we can update the app to suppress the in-page alert when backgrounded.
- iOS background limitations: Safari PWAs and iOS have restricted background behavior; native Capacitor Local Notifications are more reliable for scheduled alerts.
- If notifications don't appear on Android, verify channel configuration in the native project and that `LocalNotifications.requestPermissions()` was called.

Reporting template
- Device model / OS / Browser or Native build
- Steps performed
- Expected vs observed behavior
- Console logs / screenshots if possible

If you want, I can:
- Add an in-app toggle to suppress foreground alerts when native notifications are enabled, or
- Add a debug view that shows scheduled native notifications and their timestamps.
