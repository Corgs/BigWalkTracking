# Big Walk Club

A Strava-style activity dashboard for **Big Walk**. The companion BepInEx mod records a player's route, distance, estimated steps, moving time, and elevation gain. This website plots that activity live over a calibrated copy of the in-game map.

## Features

- Live route line and current player position
- Individual activity IDs and player names
- Distance, estimated steps, moving time, and elevation gain
- Shareable activity summary
- D1-backed activity and route storage
- Calibrated conversion from game-world coordinates to map pixels

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. With no activity query, the site displays a sample activity.

## Telemetry API

The mod sends JSON telemetry to:

```text
POST /api/telemetry
```

An activity is displayed at:

```text
/?activity=ACTIVITY_ID
```

The BepInEx plugin's `TelemetryEndpoint` should be set to the deployed site's `/api/telemetry` URL. A private deployment also needs machine authentication; a public deployment can receive telemetry directly.

## Build

```bash
npm run build
```

The project uses Vinext, React, Cloudflare Workers, D1, and Drizzle ORM. The initial D1 migration is in `drizzle/`.

## Companion mod

The mod source and compiled DLL are maintained alongside this web project. Step count is estimated from travelled distance using a configurable stride length (0.75 metres by default).
