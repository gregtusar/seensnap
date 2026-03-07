variable "project_id" {
  description = "GCP project ID for SeenSnap."
  type        = string
}

variable "project_name" {
  description = "Human-readable project name."
  type        = string
  default     = "seensnap"
}

variable "region" {
  description = "Primary GCP region."
  type        = string
  default     = "us-central1"
}

variable "upload_bucket_name" {
  description = "Bucket name for snip images and avatars."
  type        = string
}

variable "db_instance_name" {
  description = "Cloud SQL instance name."
  type        = string
  default     = "seensnap-pg-dev"
}

variable "db_name" {
  description = "Application database name."
  type        = string
  default     = "seensnap"
}

variable "db_user_name" {
  description = "Application database username."
  type        = string
  default     = "seensnap_app"
}

variable "db_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-custom-1-3840"
}
