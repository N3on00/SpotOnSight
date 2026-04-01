# Contributing Architecture

## Rule

Add new behavior by editing the declared side first.

- add backend routes in route spec files and endpoint modules
- add frontend actors through actor specs and catalogs
- add frontend screens through screen definition objects
- add service-backed actions through action spec maps
- add state writes through `src/state/appMutations.js`

Do not add hidden registration, import-time wiring, or generic framework layers that require future contributors to edit engine code for feature work.

## Backend

- DTOs live in `backend/models/schemas.py`
- route manifests live in `backend/api/routes/*_specs.py`
- endpoint factories live in `backend/api/routes/*_endpoints.py`
- generic route engine lives in `backend/api/route_registry.py`
- domain behavior lives in `backend/core/social/*_actions.py` and workflow helpers
- repositories own Mongo access

When adding a new social endpoint:

1. add the request/response DTO if needed
2. add a direct endpoint factory in `backend/api/routes/social_endpoints.py`
3. add an `EndpointSpec` entry in `backend/api/routes/social_specs.py`
4. keep business rules in domain action/workflow modules, not in the route layer

## Frontend

- actor specs live in `frontend/src/actors/index.js`
- generic actor engine lives in `frontend/src/actors/createActorRegistry.js`
- screen definitions live in `frontend/src/registrations/*.js`
- generic screen engine lives in `frontend/src/core/uiRegistryBuilder.js`
- action specs live in `frontend/src/actions/index.js`
- shared state mutations live in `frontend/src/state/appMutations.js`

When adding a new frontend feature:

1. add service ids/action ids/ui ids to the actor spec side
2. add or extend action specs instead of hardcoding orchestration in components
3. add a screen definition object instead of imperative registration chains
4. route state changes through mutation helpers

## Avoid

- controller layers
- generic CRUD/meta-frameworks for app behavior
- global mutable registries
- import-time registration side effects
- direct database access outside repositories
- feature-specific state writes scattered across UI helpers/components
