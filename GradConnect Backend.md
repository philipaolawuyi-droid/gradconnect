# GradConnect Backend

This is a small standalone Node.js/Express API for the single-file `index.html` frontend.

## Run locally

```bash
cd gradconnect-backend
npm install
npm start
```

The API starts at `http://localhost:4000` and serves the frontend automatically from `../gradconnect-frontend` when that folder exists.

Open:

```text
http://localhost:4000
```

The backend creates `data.json` automatically on first start. It stores demo users, connections, posts, conversations, messages, and events in that file.

## API authentication for this demo

The backend uses the `x-user-id` request header to identify the current demo user. If the header is not supplied, user `1` is used.

Example:

```bash
curl http://localhost:4000/api/me \
  -H "x-user-id: 1"
```

This is intentionally simple for a school demonstration. It is not a replacement for Google OAuth, password authentication, signed sessions, or production access control.

## Main endpoints

- `GET /api/health`
- `GET /api/me`
- `GET /api/alumni?q=search`
- `POST /api/connections/:targetUserId`
- `POST /api/connections/:requestId/accept`
- `GET /api/connections`
- `GET /api/posts`
- `POST /api/posts`
- `POST /api/posts/:id/like`
- `POST /api/posts/:id/comments`
- `GET /api/conversations`
- `GET /api/conversations/:otherUserId`
- `POST /api/conversations/:otherUserId/messages`
- `GET /api/events`
- `POST /api/events`
- `POST /api/events/:id/rsvp`

## Connecting the frontend

The supplied single-file frontend currently uses browser `localStorage`, so it works immediately without a server. To use this backend instead, replace its local data functions with `fetch` calls to `http://localhost:4000/api` and include the current user header:

```js
fetch("http://localhost:4000/api/alumni", {
  headers: { "x-user-id": "1" }
});
```

For a real deployment, add real authentication, use a hosted database, validate all ownership rules, and store secrets in environment variables.
