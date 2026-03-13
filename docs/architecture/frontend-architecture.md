# Frontend Architecture

- `src/views/`: route-level screen entry points
- `src/components/`: reusable UI modules grouped by feature
- `src/router/`: route declarations and navigation helpers
- `src/stores/`: persisted application state
- `src/services/`: API, platform, and workflow services
- `src/controllers/`: orchestration between UI and services

The frontend remains the single product client for browser and Capacitor builds.
