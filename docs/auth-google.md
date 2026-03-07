# Google Auth Implementation Notes

## Chosen flow

- Expo app requests a Google ID token
- mobile client posts that ID token to `POST /api/v1/auth/google`
- backend verifies the token with Google's public keys
- backend upserts a local user plus auth identity
- backend returns a SeenSnap bearer token for API access

## Why this shape

- Keeps the mobile app simple
- Avoids trusting client-supplied profile data
- Gives us one consistent app session format before Apple auth is added
- Works with the existing GCP project without requiring Firebase Auth on day one

## Environment variables

Backend:

- `GOOGLE_OAUTH_CLIENT_ID`
- `APP_AUTH_SECRET`
- `APP_AUTH_AUDIENCE`

Mobile:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

## Remaining work after credentials exist

- create platform OAuth client IDs in the `seensnap` project
- add token refresh and session restore UX refinement
- protect all authenticated endpoints with the bearer token dependency
- add Apple auth using the same local session issuance path

