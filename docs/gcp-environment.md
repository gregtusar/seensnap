# GCP Environment Notes

## Project

- Project ID: `seensnap`
- Primary region: `us-central1`

## Cloud SQL

Created on 2026-03-07:

- Instance: `seensnap-pg-dev`
- Engine: `POSTGRES_16`
- Edition: `ENTERPRISE`
- Tier: `db-custom-1-3840`
- Disk: `10GB SSD`
- Availability: `ZONAL`
- Public IP enabled
- Connection name: `seensnap:us-central1:seensnap-pg-dev`

Database objects created:

- Database: `seensnap`
- User: `seensnap_app`

Secret Manager entries created:

- `seensnap-db-password`
- `seensnap-database-url`
- `tmdb-api-token`

## APIs enabled

- `sqladmin.googleapis.com`
- `secretmanager.googleapis.com`
- `run.googleapis.com`
- `cloudbuild.googleapis.com`
- `artifactregistry.googleapis.com`
- `iam.googleapis.com`
- `compute.googleapis.com`

## Important follow-ups

- Create a proper Google OAuth setup for Expo development and native apps
- Decide whether Cloud SQL should stay on public IP or move to private networking before production
- Add Cloud Run, Artifact Registry, and service-to-database IAM wiring
- Decide how DB user/password rotation should be managed
- Pull TMDB credentials from Secret Manager at runtime instead of local env for deployed API workloads

