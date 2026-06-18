# Barber Coach — Prototype

This is a small prototype of an offline-first PWA that provides discreet timed alerts for haircuts (audio, vibration, visual).

Quick start:

Serve the folder with a simple static server (service workers require HTTPS or localhost):

```bash
# Python 3
python -m http.server 8000

# then open http://localhost:8000 in a mobile browser
```

Features in this prototype:
- PWA manifest and basic service worker caching
- Preset model and default 'Quick Cut' preset
- Alerts engine: WebAudio beep, Vibration API, Web Notifications (silent)
- IndexedDB storage for presets and sessions


 Push helper
 - There's a small helper script `push-to-github.sh` in the project root to push the code to a new GitHub repo. Edit the `GITHUB_USER` and `REPO_NAME` variables at the top, make it executable, then run:

 ```bash
 chmod +x push-to-github.sh
 ./push-to-github.sh
 ```

 This will create a commit and push to `https://github.com/YOUR_GITHUB_USERNAME/REPO_NAME` (the repo must already exist on GitHub, or use the GitHub CLI method described earlier to create and push in one step).

How to get this on your phone

- Install as a PWA (recommended quick path):
	- Serve the project on a local network or host it (HTTPS required for many features).
	- Open the site from Safari (iOS) or Chrome (Android).
	- Use the browser menu → "Add to Home Screen" (iOS) or "Install" (Android) to add the PWA.
	- Launching from the home screen runs the app in standalone mode and it will use the device's audio/vibration/notifications per settings.

- Native wrapper (Capacitor) — for reliable background notifications and native scheduling:
	- Install Node.js and npm.
	- From the project root (you may create a separate folder for the wrapper):

```bash
# install Capacitor globally (if needed)
npm install -g @capacitor/cli

# init a Capacitor project in the web build folder
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init barber-coach com.example.barbercoach

# copy the built web files (the folder with index.html) into the Capacitor web dir (default: www)
# then add platforms and build
npx cap add android
npx cap add ios
npx cap open ios   # opens Xcode
npx cap open android  # opens Android Studio
```

	- Use native plugins (Local Notifications, Background Task, Haptics) to schedule reliable local alerts when the app is backgrounded.
	- Note: building native packages requires Xcode (macOS) for iOS and Android Studio for Android.

Security & offline
- The PWA works offline via the service worker and stores presets/sessions locally in IndexedDB. Native wrappers can optionally add secure storage or cloud sync.
