# Watch Together App

A real-time collaborative platform to watch YouTube videos with friends. Create or join a room, share the link, and enjoy synchronized playback — no account required.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Sync Behavior](#sync-behavior)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Features

- **Room-based Sessions** — Create or join rooms with shareable links; rooms are ephemeral (no database)
- **Synchronized Playback** — Real-time YouTube video sync with drift correction; late joiners land at the room's current time
- **Playlist Management** — Queue multiple videos (the same video can be queued more than once), select any entry, and auto-advance when a video ends; each entry shows who added it
- **Live Chat** — Room chat with join, leave, and disconnect notices; late joiners see the last 200 messages
- **YouTube Metadata** — Displays video title, view count, like count, published date, and full channel info (name, icon, subscriber count)
- **User Profiles** — A random name and identicon avatar are generated once per browser and kept between visits; rename yourself from the profile menu, no sign-up needed
- **Online Users** — See who is in the room; two tabs of the same user count once
- **Unread Badges** — A badge on the chat button counts messages from others while the chat is closed
- **Event Versioning** — Video and playlist state carry an `eventId` version, so stale or conflicting updates are dropped
- **Room Cleanup** — Inactive empty rooms are automatically purged after one hour

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS 4, React Router 7 |
| **Backend** | Node.js, Express 4, TypeScript, Socket.IO 4 |
| **Real-time** | WebSockets via Socket.IO |
| **Video** | YouTube IFrame Player API, YouTube Data API v3 |
| **Containerization** | Docker (multi-stage Node 24 build) |
| **CI/CD** | GitHub Actions |
| **Hosting** | AWS EC2 (backend), CloudFront + S3 (frontend), Route53 (DNS), GitHub Container Registry |

---

## Installation

### Prerequisites

- Node.js >= 22.x (required for Vite 7+)
- npm >= 10.x
- A [YouTube Data API v3](https://console.cloud.google.com/) key (for video metadata)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend (npm)

```bash
cd backend
npm install
npm run dev
```

### Backend (Docker)

```bash
cd backend
docker compose up --build
```

---

## Configuration

Create `.env` files in each directory before starting.

### Frontend — `frontend/.env`

```env
VITE_APP_BACKEND_URL=http://localhost:4000
```

### Backend — `backend/.env`

```env
BACKEND_PORT=4000
YOUTUBE_API_KEY=your_youtube_data_api_v3_key
```

---

## Usage

1. Open the frontend in a browser: `http://localhost:5173` (or your deployed URL)
2. Click **Create Room** to start a new session, or **Join Room** to enter an existing room ID
3. Share the room link with friends
4. Paste a YouTube URL into the search bar to load a video
5. Add more videos to the playlist to queue them up
6. Playback, seeks, and pauses are synchronized across all participants in real time

---

## Sync Behavior

The server owns each room's state: the video (`VideoState`), the playlist (items with server-assigned ids and who added them), the last 200 chat messages, and who is online. Clients send what their user does and apply what the server sends back.

- **Joining** — The client sends its stored profile with `room:join` and gets one `room:sync` snapshot of the users, chat, playlist, and video. The video's time is projected forward to the moment of the join. A paused room's video is cued instead of played.
- **The server starts videos** — Adding to an empty or finished playlist, selecting an entry, or reaching the end of a video makes the server load that item and broadcast `video:sync`. Clients never start videos themselves, so a join or a repeated URL can't restart anyone's playback.
- **`eventId` is a version** — Clients drop broadcasts older than the state they already have. When two members act on the same state at once (one plays, one pauses), the server applies the first and drops the other.
- **Video ends are keyed by item** — Every member's player reports the end with the id of the item that ended. The server acts on the first report and ignores the rest, so the playlist advances exactly once.
- **A finished playlist stays on its last video** — Clicking that entry does nothing. Restart it with the scrubber, or add a video, which starts right away.

Who sends each kind of event:

| Kind of event | Sent by | Examples |
|---|---|---|
| User intent | The client of the user who acted | play, pause, seek, playback rate, select, add |
| Consequences the server can work out | Nobody: the server applies them | which video plays after a select, an add, or an end |
| Facts only players can observe | Every client, keyed by what happened | a video ended (`itemId`) |
| Applying server state | Nobody | loading a video from `video:sync` or the join snapshot sends nothing back |

---

## Testing

| Suite | Runs against | Command | Location |
|---|---|---|---|
| Backend | The real Express and Socket.IO server, with real socket clients | `npm test` in `backend/` | `backend/tests/` |
| Frontend | Managers and components in jsdom, with a fake socket and YouTube player | `npm test` in `frontend/` | `frontend/tests/` |
| End-to-end | The real backend and a production build in Chromium, with a fake YouTube player | `npm run test:e2e` in `frontend/` | `frontend/e2e/` |

- Run `npx playwright install chromium` once before the first end-to-end run.
- `npm run test:coverage` and `npm run test:mutation` (Stryker) work in both packages. Each fails below the thresholds set in `vitest.config.ts` and `stryker.config.json`.
- A known bug is recorded as a test that asserts the intended behaviour, marked `it.fails` (`test.fail()` in end-to-end tests), with a `Known bug:` comment or a `BUG` title saying what's wrong. When a fix makes it pass, remove the marker.
- CI runs both unit suites and the frontend build on every pull request. Run lint, end-to-end, and mutation tests locally.

---

## Deployment

The project uses two GitHub Actions workflows that trigger automatically on pushes to `main`:

- **Frontend** — Builds the Vite app and deploys static assets to an S3 bucket, then invalidates the CloudFront distribution. DNS is managed via Route53.
- **Backend** — Builds a Docker image, pushes it to GitHub Container Registry (`ghcr.io`), and deploys to an EC2 instance using AWS SSM Session Manager. Secrets (port, YouTube API key) are pulled from AWS SSM Parameter Store at deploy time.

Authentication between GitHub Actions and AWS uses OIDC (no long-lived credentials stored in GitHub).
