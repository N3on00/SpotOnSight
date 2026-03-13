# Mobile Wrapper Setup

SpotOnSight uses Capacitor to package the Vue frontend for Android and iOS.

- Active Capacitor CLI config: `frontend/capacitor.config.json`
- Native shells: `mobile/capacitor/android/` and `mobile/capacitor/ios/`
- Shared web bundle source: `frontend/dist/`

Typical workflow:

```bash
cd frontend
npm run build:mobile:web
npm run mobile:sync
```
