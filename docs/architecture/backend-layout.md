# Backend Layout

- `api/`: route registration and HTTP boundary logic
- `services/`: auth and platform-facing service helpers
- `repositories/`: Mongo adapters and auth repository setup
- `models/`: Pydantic request and response schemas
- `core/`: startup lifecycle, admin bootstrap, social action modules, workflow runtime, and shared helpers

Design rule: routes validate and delegate; domain actions and workflows make decisions; repositories talk to MongoDB.

Current rule: route manifests declare the varying HTTP surface while generic route-building stays minimal and explicit.

Actor/runtime direction:

- workflow definitions describe intent and ordering
- actors execute one capability each
- policies decide permissions and business guards
- repositories remain pure IO adapters

See `docs/architecture/actor-runtime.md`.
