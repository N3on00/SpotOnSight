# Frontend Architecture

- `src/views/`: route-level screen entry points
- `src/components/`: reusable UI modules grouped by feature
- `src/router/`: route declarations and navigation helpers
- `src/stores/`: persisted application state
- `src/services/`: API, platform, and runtime-facing services
- `src/actions/`: orchestration layer that owns app-state mutation
- `src/actors/`: actor manifests that declare services, actions, UI bindings, and runtime bindings
- `src/core/uiRegistryBuilder.js`: instance-scoped UI registry builder owned by actor manifests

The frontend remains the single product client for browser and Capacitor builds.

The frontend composition model is now actor-driven:

- screens declare intent
- actions orchestrate application flows
- services provide reusable capabilities
- actor manifests keep bindings centralized

See `docs/architecture/actor-runtime.md` for the broader reusable-actor orchestration model.
