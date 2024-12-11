# Niji Radio

Niji Radio is a web application that allows multiple users to synchronize and play music together. It utilizes Cloudflare Workers and its Durable Objects to achieve real-time synchronization.

## Key Features

- Synchronized music playback across multiple users
- Dynamic playlist management (add, delete, clear)
- Real-time synchronization using WebSockets
- Music playback control in the browser
- Display of remaining time and time until the next track

## Tech Stack

- **Runtime**: Cloudflare Workers
- **State Management**: Durable Objects
- **Framework**: Hono
- **Development Tool**: Wrangler

## System Architecture

### Backend (MusicSyncObject)

MusicSyncObject provides the following functionalities:

- Dynamic playlist management
  - Adding new tracks
  - Automatic removal of played tracks
  - Complete clearing of the playlist
- Synchronization of playback state
- WebSocket connection management
- Automation of track switching

### Frontend

- Simple HTML/JavaScript implementation
- Synchronization via WebSocket connection
- Music playback using the browser's Audio API
- Real-time display of remaining time and time until the next track

## API Specification

### HTTP Endpoints

#### GET /

- Description: Provides the main web interface
- Response: HTML

#### POST /api/setPlaylist

- Description: Sets the playlist
- Behavior: Replaces the existing playlist with a new one
- Request body:

```json
[
  {
    "url": "URL of the music file",
    "duration": Duration in milliseconds
  }
]
```

#### POST /api/addToPlaylist

- Description: Adds tracks to the playlist
- Behavior: Appends new tracks to the existing playlist
- Request body:

```json
[
  {
    "url": "URL of the music file",
    "duration": Duration in milliseconds
  }
]
```

#### POST /api/clearPlaylist

- Description: Completely clears the playlist
- Behavior: Removes all tracks and stops playback
- Request body: None

#### GET /api/getPlaylist

- Description: Retrieves the current playlist
- Response: Playlist information (JSON)

### WebSocket Communication

#### Messages from Server to Client

1. Synchronization message

```json
{
  "type": "sync",
  "elapsedTime": Elapsed time in milliseconds,
  "trackUrl": "URL of the currently playing track",
  "duration": Track length in milliseconds
}
```

2. Track change message

```json
{
  "type": "changeTrack",
  "trackUrl": "URL of the new track",
  "duration": Track length in milliseconds
}
```

## Setup and Execution

### Development Environment Setup

```bash
# Install dependencies
npm install
```

### Local Development

```bash
# Start the development server
npm run dev
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Technical Details

### Playlist Management Mechanism

1. Adding new tracks
    -   Add new tracks with `POST /api/addToPlaylist`
    -   Appends to the end of the existing playlist
    -   Starts playback immediately if the playlist is empty

2. Setting the playlist
    -   Set a new playlist with `POST /api/setPlaylist`
    -   Replaces the existing playlist with the new one
    -   Immediately starts playing the first track of the new playlist

3. Management of played tracks
    -   Automatically removes tracks from the playlist when they finish playing
    -   Automatically starts playing the next track
    -   Stops playback if the playlist becomes empty

4. Clearing the playlist
    -   Completely clears the playlist with `POST /api/clearPlaylist`
    -   Also stops the currently playing track
    -   Notifies all clients to stop playback

### Synchronization Mechanism

1. Client establishes a WebSocket connection
2. Server sends the current playback state (track URL, elapsed time, track length)
3. Client adjusts the playback position based on the received information
4. When a track ends, it automatically switches to the next track and notifies all clients
5. Displays the remaining time and time until the next track in real time

### Use of Durable Objects

-   Playlist persistence
-   Playback state management
-   WebSocket connection management
-   Track switching scheduling
