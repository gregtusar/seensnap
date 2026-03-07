# SeenSnap Phase 1 Architecture

## Runtime shape

- Expo React Native client for iOS and Android
- FastAPI backend serving a REST API
- PostgreSQL as system of record
- TMDB as the only metadata provider in Phase 1
- GCS for user-generated images
- Firebase Cloud Messaging for push notifications

## MVP constraints

- US-only market at launch
- Apple and Google login only
- Invite links/codes only for teams
- Manual search plus assisted image match
- No ads, subscriptions, chat, or web app in Phase 1

## Provider boundaries

- `ContentMetadataProvider`: TMDB-backed title search and details
- `ContentMatchProvider`: best-effort image-assisted matching with manual fallback
- `StreamingLinkProvider`: TMDB streaming availability only
- `NotificationProvider`: FCM-backed push delivery

