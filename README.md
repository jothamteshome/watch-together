# Watch Together App

A real-time collaborative platform to watch YouTube videos with friends. Create or join a room, share the link, and enjoy synchronized playback — no account required.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Sync Behavior](#sync-behavior)
- [Deployment](#deployment)

---

## Features

- **Room-based Sessions** — Create or join rooms with shareable links; rooms are ephemeral (no database)
- **Synchronized Playback** — Real-time YouTube video sync with latency correction and drift prevention
- **Playlist Management** — Queue multiple videos, manually select tracks, and auto-advance when a video ends
- **Live Chat** — Room chat with system notifications for join, leave, and disconnect events
- **YouTube Metadata** — Displays video title, view count, like count, published date, and full channel info (name, icon, subscriber count)
- **User Avatars** — Auto-generated identicon avatars and usernames assigned on join; no sign-up needed
- **Unread Badges** — Notification badges on the chat and playlist tabs when the panel is minimized
- **Event Versioning** — All state-change events carry an `eventId` to prevent race conditions and out-of-order updates
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

- The server maintains `VideoState` (current time, play/pause, playback rate) and updates a timestamp on every state change
- When a user joins, the server calculates elapsed time since the last update and sends an adjusted `currentTime` so the new user snaps in sync immediately
- All video events (`play`, `pause`, `seek`, `set`) are broadcast to every room member via `video:sync`
- Each event carries an `eventId`; clients discard stale or out-of-order updates
- Latency is tracked per-connection and factored into sync corrections to prevent drift
- Playlist and chat state are similarly versioned and replayed to newly joined users

---

## Deployment

The project uses two GitHub Actions workflows that trigger automatically on pushes to `main`:

- **Frontend** — Builds the Vite app and deploys static assets to an S3 bucket, then invalidates the CloudFront distribution. DNS is managed via Route53.
- **Backend** — Builds a Docker image, pushes it to GitHub Container Registry (`ghcr.io`), and deploys to an EC2 instance using AWS SSM Session Manager. Secrets (port, YouTube API key) are pulled from AWS SSM Parameter Store at deploy time.

Authentication between GitHub Actions and AWS uses OIDC (no long-lived credentials stored in GitHub).
