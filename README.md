# SeenSnap

Monorepo for the SeenSnap Phase 1 MVP.

## Structure

- `apps/api`: FastAPI backend with SQLAlchemy, Alembic, and PostgreSQL
- `apps/mobile`: Expo + React Native mobile app shell
- `infra/terraform`: GCP infrastructure baseline and reproducibility notes
- `docs`: project documentation
- `Original Pitch Materials`: source product materials

## Local development

### Backend

1. Create a Python 3.12 virtual environment.
2. Install dependencies with `pip install -e apps/api[dev]`.
3. Copy `apps/api/.env.example` to `apps/api/.env`.
4. Set `DATABASE_URL`.
5. Run migrations with `alembic upgrade head` from `apps/api`.
6. Start the API with `uvicorn app.main:app --reload`.

### Mobile

1. Install dependencies with `npm install` from `apps/mobile`.
2. Start Expo with `npm run dev`.

## Pending cloud setup

The following stay local/stubbed until GCP/Firebase project details are available:

- Google Cloud Storage bucket wiring
- Firebase project configuration
- Apple and Google OAuth credentials
- Production environment configuration

Cloud SQL is now live in GCP:

- Instance: `seensnap-pg-dev`
- Database: `seensnap`
- Secrets: `seensnap-db-password`, `seensnap-database-url`, `tmdb-api-token`

See [`infra/terraform/README.md`](#/Users/gregorytusar/Documents/Playground/infra/terraform/README.md) for the reproducible infrastructure record.

## Current auth direction

Milestone 2 starts with Google auth:

- Expo obtains a Google ID token
- backend verifies the token
- backend upserts a local user and returns a SeenSnap bearer token

See [`docs/auth-google.md`](#/Users/gregorytusar/Documents/Playground/docs/auth-google.md) and [`infra/terraform`](#/Users/gregorytusar/Documents/Playground/infra/terraform).
