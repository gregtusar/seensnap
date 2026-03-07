output "upload_bucket_name" {
  value = google_storage_bucket.uploads.name
}

output "api_runtime_service_account_email" {
  value = google_service_account.api_runtime.email
}

output "db_instance_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "db_instance_public_ip" {
  value = google_sql_database_instance.postgres.public_ip_address
}
