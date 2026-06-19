# Mobile app setup (PWA & Capacitor)

This project is a static PWA. To turn it into a phone app you have two practical options:

1) Use the PWA directly (installable from the browser)
2) Wrap it with Capacitor for native packaging (Android/iOS) to get reliable background notifications and native haptics

Quick checks before packaging
- Serve the site over HTTPS (or use localhost during development).
- Ensure `manifest.json` icons are present (icon-192.png & icon-512.png in `/icons`).
- Test installation flow: open the site in Chrome on Android and choose "Install app".

PWA option (fast)
1. Serve the folder locally:
```bash
cd "$(pwd)"
python -m http.server 8000
```
2. Open `http://localhost:8000` on your phone (same network) and add to home screen via browser menu.

Capacitor option (recommended for background notifications)
1. Install Node.js and npm if you don't have them.
2. In the project root initialize npm (if not already):
```bash
npm init -y
npm install @capacitor/core @capacitor/cli --save-dev
npx cap init
```
3. Configure `capacitor.config.json` (appId and appName are in repo). Build web assets (none required for static) and copy:
```bash
npx cap copy
```
4. Add Android or iOS platform:
```bash
npx cap add android
npx cap add ios
```
5. Open native project and run on device/emulator:
```bash
npx cap open android
npx cap open ios
```
6. Implement native local notifications / background tasks using Capacitor plugins (Local Notifications, Background Tasks, Haptics).

Notes & next steps I can do for you
- Add missing icons/splash images into `/icons` and wire manifest (I can add placeholder SVGs).
- Add a simple `history.html` and screen that lists `sessions` stored in IndexedDB.
- Integrate Capacitor Local Notifications wiring example in the repo.

Tell me which next step you want me to perform and I'll implement it.
