from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SeenSnap API"
    environment: str = "local"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/seensnap"
    tmdb_api_key: str = ""
    tmdb_base_url: str = "https://api.themoviedb.org/3"
    gcp_project_id: str = ""
    gcs_bucket_name: str = ""
    firebase_project_id: str = ""
    apple_bundle_id: str = ""
    google_oauth_client_id: str = ""
    app_auth_secret: str = "replace-me"
    app_auth_audience: str = "seensnap-mobile"
    uploads_dir: str = "uploads"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
