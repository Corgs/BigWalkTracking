import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  playerName: text('player_name').notNull(),
  title: text('title').notNull(),
  scene: text('scene').notNull().default('WorldScene'),
  status: text('status').notNull().default('live'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  lastSeenAt: text('last_seen_at').notNull(),
  distanceMetres: real('distance_metres').notNull().default(0),
  steps: integer('steps').notNull().default(0),
  elevationGainMetres: real('elevation_gain_metres').notNull().default(0),
  movingSeconds: integer('moving_seconds').notNull().default(0),
});

export const routePoints = sqliteTable('route_points', {
  activityId: text('activity_id').notNull(),
  sequence: integer('sequence').notNull(),
  timestampUtc: text('timestamp_utc').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  pixelX: real('pixel_x').notNull(),
  pixelY: real('pixel_y').notNull(),
  distanceMetres: real('distance_metres').notNull(),
  steps: integer('steps').notNull(),
  teleport: integer('teleport', { mode: 'boolean' }).notNull().default(false),
}, (table) => [primaryKey({ columns: [table.activityId, table.sequence] })]);
