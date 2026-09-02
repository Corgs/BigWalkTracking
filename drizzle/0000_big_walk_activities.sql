CREATE TABLE IF NOT EXISTS `activities` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL,
  `player_name` text NOT NULL,
  `title` text NOT NULL,
  `scene` text DEFAULT 'WorldScene' NOT NULL,
  `status` text DEFAULT 'live' NOT NULL,
  `started_at` text NOT NULL,
  `ended_at` text,
  `last_seen_at` text NOT NULL,
  `distance_metres` real DEFAULT 0 NOT NULL,
  `steps` integer DEFAULT 0 NOT NULL,
  `elevation_gain_metres` real DEFAULT 0 NOT NULL,
  `moving_seconds` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `route_points` (
  `activity_id` text NOT NULL,
  `sequence` integer NOT NULL,
  `timestamp_utc` text NOT NULL,
  `x` real NOT NULL,
  `y` real NOT NULL,
  `z` real NOT NULL,
  `pixel_x` real NOT NULL,
  `pixel_y` real NOT NULL,
  `distance_metres` real NOT NULL,
  `steps` integer NOT NULL,
  `teleport` integer DEFAULT false NOT NULL,
  PRIMARY KEY(`activity_id`, `sequence`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_route_points_activity_sequence` ON `route_points` (`activity_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_activities_last_seen` ON `activities` (`last_seen_at`);
