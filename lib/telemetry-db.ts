import { env } from 'cloudflare:workers';

let initialized = false;

export async function telemetryDb() {
  const db = env.DB;
  if (!initialized) {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, player_id TEXT NOT NULL, player_name TEXT NOT NULL, title TEXT NOT NULL, scene TEXT NOT NULL DEFAULT 'WorldScene', status TEXT NOT NULL DEFAULT 'live', started_at TEXT NOT NULL, ended_at TEXT, last_seen_at TEXT NOT NULL, distance_metres REAL NOT NULL DEFAULT 0, steps INTEGER NOT NULL DEFAULT 0, elevation_gain_metres REAL NOT NULL DEFAULT 0, moving_seconds INTEGER NOT NULL DEFAULT 0)`),
      db.prepare(`CREATE TABLE IF NOT EXISTS route_points (activity_id TEXT NOT NULL, sequence INTEGER NOT NULL, timestamp_utc TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, z REAL NOT NULL, pixel_x REAL NOT NULL, pixel_y REAL NOT NULL, distance_metres REAL NOT NULL, steps INTEGER NOT NULL, teleport INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (activity_id, sequence))`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_route_points_activity_sequence ON route_points(activity_id, sequence)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_activities_last_seen ON activities(last_seen_at)`),
    ]);
    initialized = true;
  }
  return db;
}

export function worldToPixel(x: number, z: number) {
  return {
    pixelX: 0.1981857568 * x - 0.2766872644 * z + 175.674881,
    pixelY: -0.7233321071 * x - 0.1128842309 * z + 106.522271,
  };
}
