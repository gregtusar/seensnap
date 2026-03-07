locals {
  required_apis = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "uploads" {
  name                        = var.upload_bucket_name
  location                    = var.region
  project                     = var.project_id
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

resource "google_service_account" "api_runtime" {
  account_id   = "seensnap-api"
  display_name = "SeenSnap API Runtime"
  project      = var.project_id
}

resource "google_sql_database_instance" "postgres" {
  name                = var.db_instance_name
  project             = var.project_id
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true

  settings {
    tier              = var.db_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10
    disk_autoresize   = true

    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }

    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ALLOW_UNENCRYPTED_AND_ENCRYPTED"
    }
  }
}

resource "google_sql_database" "app" {
  name     = var.db_name
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
}

resource "google_secret_manager_secret" "google_oauth_client_id" {
  secret_id = "google-oauth-client-id"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "google_ios_client_id" {
  secret_id = "google-ios-client-id"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "google_android_client_id" {
  secret_id = "google-android-client-id"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "app_auth_secret" {
  secret_id = "app-auth-secret"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "seensnap-db-password"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "seensnap-database-url"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "tmdb_api_token" {
  secret_id = "tmdb-api-token"
  project   = var.project_id

  replication {
    auto {}
  }
}
