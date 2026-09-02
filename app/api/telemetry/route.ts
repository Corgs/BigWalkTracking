import { telemetryDb, worldToPixel } from '@/lib/telemetry-db';

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const activityId = String(body.activityId ?? '');
  const sequence = Number(body.sequence);
  const x = Number(body.x); const y = Number(body.y); const z = Number(body.z);
  if (!activityId || !Number.isFinite(sequence) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return Response.json({ error: 'Invalid telemetry point' }, { status: 400 });
  const db = await telemetryDb();
  const now = String(body.timestampUtc ?? new Date().toISOString());
  const startedAt = String(body.startedAt ?? now);
  const playerId = String(body.playerId ?? 'anonymous');
  const playerName = String(body.playerName ?? 'Walker').slice(0, 40);
  const title = String(body.title ?? 'A Big Walk').slice(0, 100);
  const scene = String(body.scene ?? 'WorldScene').slice(0, 60);
  const distance = Math.max(0, Number(body.walkingDistanceMetres ?? 0));
  const steps = Math.max(0, Math.floor(Number(body.steps ?? 0)));
  const movingSeconds = Math.max(0, Math.floor(Number(body.movingSeconds ?? 0)));
  const elevation = Math.max(0, Number(body.elevationGainMetres ?? 0));
  const ended = Boolean(body.ended);
  const { pixelX, pixelY } = worldToPixel(x, z);
  await db.batch([
    db.prepare(`INSERT INTO activities (id,player_id,player_name,title,scene,status,started_at,ended_at,last_seen_at,distance_metres,steps,elevation_gain_metres,moving_seconds) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET player_name=excluded.player_name,title=excluded.title,scene=excluded.scene,status=excluded.status,ended_at=excluded.ended_at,last_seen_at=excluded.last_seen_at,distance_metres=excluded.distance_metres,steps=excluded.steps,elevation_gain_metres=excluded.elevation_gain_metres,moving_seconds=excluded.moving_seconds`).bind(activityId, playerId, playerName, title, scene, ended ? 'complete' : 'live', startedAt, ended ? now : null, now, distance, steps, elevation, movingSeconds),
    db.prepare(`INSERT OR IGNORE INTO route_points (activity_id,sequence,timestamp_utc,x,y,z,pixel_x,pixel_y,distance_metres,steps,teleport) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(activityId, sequence, now, x, y, z, pixelX, pixelY, distance, steps, body.teleport ? 1 : 0),
  ]);
  return Response.json({ ok: true, activityId, pixelX, pixelY });
}
