# SeenSnap Phase 1 API Surface

## Auth and profile

- `GET /health`
- `POST /api/v1/auth/google`
- `GET /api/v1/me`
- `GET /api/v1/me/preferences`

## Titles and streaming

- `GET /api/v1/titles/search?q=`
- `GET /api/v1/titles/{title_id}`
- `GET /api/v1/titles/{title_id}/streaming-options`

## Snips

- `POST /api/v1/snips`
- `GET /api/v1/snips/{snip_id}`
- `POST /api/v1/snips/{snip_id}/match`

## Teams

- `GET /api/v1/teams`
- `POST /api/v1/teams`
- `POST /api/v1/teams/join`
- `GET /api/v1/teams/{team_id}`
- `GET /api/v1/teams/{team_id}/activity`
- `POST /api/v1/teams/{team_id}/activity/{activity_id}/comments`
- `POST /api/v1/teams/{team_id}/activity/{activity_id}/reactions`
- `POST /api/v1/teams/{team_id}/leave`
- `DELETE /api/v1/teams/{team_id}/members/{member_user_id}`

## Feed

- `GET /api/v1/feed/for-you`
- `GET /api/v1/feed/watch-teams`
- `GET /api/v1/feed/discover`
- `POST /api/v1/feed/wall-posts`
- `POST /api/v1/feed/{event_id}/reactions`
- `DELETE /api/v1/feed/{event_id}/reactions/me`
- `POST /api/v1/feed/{event_id}/comments`
- `POST /api/v1/feed/comments/{comment_id}/replies`
- `GET /api/v1/feed/{event_id}/comments`

## Notifications

- `GET /api/v1/notifications`

## Planned next endpoints

- `PUT /api/v1/titles/{title_id}/rating`
- `PUT /api/v1/titles/{title_id}/review`
- `GET /api/v1/me/watchlist`
- `POST /api/v1/me/watchlist/items`
- `DELETE /api/v1/me/watchlist/items/{item_id}`
- `POST /api/v1/shares/instagram`
- `POST /api/v1/titles/{title_id}/affiliate-click`
