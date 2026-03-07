# Terraform Baseline

This directory captures the GCP infrastructure required for SeenSnap so the environment can be recreated from scratch later.

## Project

- GCP project name: `seensnap`
- Terraform uses `project_id` as an input because the display name and actual project ID may differ.

## What is managed here now

- Required Google APIs
- A GCS bucket for user uploads
- A Cloud SQL PostgreSQL instance
- The application database object
- A runtime service account for backend workloads
- Secret Manager placeholders for app configuration

## What will be added as the app grows

- The application database user as a managed or rotation-aware resource
- Cloud Run services for API and worker processes
- Artifact Registry for backend containers
- Firebase resources and messaging credentials
- Monitoring, alerting, and log retention

## Important note about Google OAuth

The Google OAuth consent screen and some OAuth client setup steps are not fully reliable to manage end-to-end with Terraform alone. We still document them here so they are reproducible:

1. Enable the OAuth consent screen for the `seensnap` project.
2. Create platform-specific OAuth client IDs for:
   - iOS
   - Android
   - Web or Expo development callback flow
3. Store the resulting client IDs in Secret Manager and in local environment config.

If a future provider/resource becomes stable enough to manage OAuth clients directly in Terraform, add it here and remove the manual step.

## Usage

1. Copy `terraform.tfvars.example` to `terraform.tfvars`.
2. Fill in the real `project_id`, region, and bucket names.
3. Run `terraform init`.
4. Run `terraform plan`.
5. Run `terraform apply`.

## Live resources created on 2026-03-07

The following resources were created directly with `gcloud` and are now mirrored in Terraform configuration:

- Cloud SQL instance: `seensnap-pg-dev`
- Cloud SQL database: `seensnap`
- Secret Manager secret: `seensnap-db-password`
- Secret Manager secret: `seensnap-database-url`
- Secret Manager secret: `tmdb-api-token`

Current Cloud SQL settings:

- Engine: `POSTGRES_16`
- Region: `us-central1`
- Edition: `ENTERPRISE`
- Tier: `db-custom-1-3840`
- Disk: `10GB SSD`
- Availability: `ZONAL`
- Backups: enabled at `03:00`
- Public IPv4: enabled
- Connection name: `seensnap:us-central1:seensnap-pg-dev`

The application DB user `seensnap_app` was also created directly with `gcloud`. Terraform does not manage that user yet because the password was generated live and stored in Secret Manager; keep that documented until we choose a password generation/rotation strategy.

The TMDB bearer token is stored in Secret Manager under `tmdb-api-token`. The secret container is mirrored in Terraform, but the secret value itself remains a manual secret version, which is the correct pattern.
