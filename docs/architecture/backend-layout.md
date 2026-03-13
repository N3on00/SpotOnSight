# Backend Layout

- `api/`: route registration and HTTP boundary logic
- `services/`: feature workflows for auth, spots, follows, support, comments, and meetups
- `repositories/`: Mongo adapters and auth repository setup
- `models/`: Pydantic request and response schemas
- `core/`: startup lifecycle, registry wiring, admin bootstrap, and shared social helpers

Design rule: routes validate and delegate; services make decisions; repositories talk to MongoDB.
