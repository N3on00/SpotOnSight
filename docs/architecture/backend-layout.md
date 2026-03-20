# Backend Layout

- `api/`: route registration and HTTP boundary logic
- `services/`: feature workflows for auth, spots, follows, support, comments, and meetups
- `repositories/`: Mongo adapters and auth repository setup
- `models/`: Pydantic request and response schemas
- `core/`: startup lifecycle, registry wiring, admin bootstrap, and shared social helpers

Design rule: routes validate and delegate; services make decisions; repositories talk to MongoDB.

Target rule: feature workflows should keep shrinking into a generic actor runtime where:

- workflow definitions describe intent and ordering
- actors execute one capability each
- policies decide permissions and business guards
- repositories remain pure IO adapters

See `docs/architecture/actor-runtime.md`.
