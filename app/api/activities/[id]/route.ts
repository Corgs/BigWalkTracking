import { telemetryDb } from '@/lib/telemetry-db';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await telemetryDb();
  const activity = await db.prepare('SELECT * FROM activities WHERE id = ?').bind(id).first();
  if (!activity) return Response.json({ error: 'Activity not found' }, { status: 404 });
  const points = await db.prepare('SELECT sequence,timestamp_utc,x,y,z,pixel_x,pixel_y,distance_metres,steps,teleport FROM route_points WHERE activity_id = ? ORDER BY sequence ASC LIMIT 6000').bind(id).all();
  return Response.json({ activity, points: points.results }, { headers: { 'Cache-Control': 'no-store' } });
}
