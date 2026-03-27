# Actor Refactor Map

This map turns the actor-runtime target into a concrete migration path for the current codebase.

## Current To Target Mapping

- `backend/core/social/actions.py`
  - current: feature-heavy service monolith
  - target: policy functions, builders, projectors, and workflow definitions
- `backend/models/schemas.py`
  - current: DTOs plus route registration and feature wrappers
  - target: DTOs only, with workflow registration moved elsewhere
- `backend/api/routes/social.py`
  - current: route composition
  - target: intent entrypoint that resolves workflow definitions and executes runtime plans
- `frontend/src/controllers/`
  - current: orchestration layer between UI and services
  - target: intent dispatch layer that can mirror backend workflow naming
- `frontend/src/core/screenRegistry.js`
  - current: screen composition registry
  - target: screen intent registry backed by reusable capability providers

## Migration Order

1. Introduce the generic runtime and actor contract without changing route boundaries.
2. Move one vertical at a time behind workflow definitions.
3. Extract shared policies, builders, and projectors from feature services.
4. Remove legacy feature wrappers after workflows are stable.
5. Align frontend intents with backend workflow names where it improves traceability.

## First Vertical: Spots

The first extraction should prove the model on a workflow that has creation, update, deletion, visibility, and projection concerns.

- workflow definitions now live in `backend/core/social/spot_workflows.py`
- favorite relation workflow definitions now live in `backend/core/social/favorite_workflows.py`
- generic runtime primitives now live in `backend/core/workflows.py`
- `SocialActions` delegates spot orchestration through the workflow executor instead of directly embedding the full script
- `SocialActions` delegates favorite relation orchestration through a workflow executor instead of embedding relation scripts inline

## What Still Needs To Move

- follow, block, support, moderation, comment, and meetup flows
- route registration out of `backend/models/schemas.py`
- explicit policy modules per bounded concern
- workflow versioning and audit metadata
- outbox support for emitted domain facts

## Success Criteria

- adding a business flow mostly means writing workflow data, not another service monolith
- generic actors remain capability-scoped and do not fork by feature
- policies and projections are independently testable
- routes remain thin and stable while workflows evolve behind them
