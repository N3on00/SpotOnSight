# Actor Refactor Map

This map turns the actor-runtime target into a concrete migration path for the current codebase.

## Current To Target Mapping

- `backend/core/social/actions.py`
  - current: shared facade over focused domain action modules and workflows
  - target: continue shrinking helper surface as more domain policies/projectors become explicit
- `backend/models/schemas.py`
  - current: DTOs plus endpoint factories
  - target: DTOs and endpoint factories remain explicit until a separate endpoint-factory module is worth the split
- `backend/api/routes/social.py`
  - current: route registry entrypoint backed by explicit manifest data
  - target: keep the route registry generic while only route data varies
- `frontend/src/actions/`
  - current: orchestration layer between UI and services
  - target: keep action names aligned with actor/runtime intent where useful
- `frontend/src/core/uiRegistryBuilder.js`
  - current: instance-scoped UI registry builder
  - target: keep the builder generic while screen bindings vary through actor manifests

## Migration Order

1. Introduce the generic runtime and actor contract without changing route boundaries.
2. Move one vertical at a time behind workflow definitions.
3. Extract shared policies, builders, and projectors from feature services.
4. Remove obsolete wrappers after workflows are stable.
5. Align frontend intents with backend workflow names where it improves traceability.

## First Vertical: Spots

The first extraction should prove the model on a workflow that has creation, update, deletion, visibility, and projection concerns.

- workflow definitions now live in `backend/core/social/spot_workflows.py`
- favorite relation workflow definitions now live in `backend/core/social/favorite_workflows.py`
- generic runtime primitives now live in `backend/core/workflows.py`
- `SocialActions` delegates spot orchestration through the workflow executor instead of directly embedding the full script
- `SocialActions` delegates favorite relation orchestration through a workflow executor instead of embedding relation scripts inline

## What Still Needs To Move

- explicit policy modules per bounded concern where helper surfaces are still broad
- workflow versioning and audit metadata
- outbox support for emitted domain facts

## Success Criteria

- adding a business flow mostly means writing workflow data, not another service monolith
- generic actors remain capability-scoped and do not fork by feature
- policies and projections are independently testable
- routes remain thin and stable while workflows evolve behind them
