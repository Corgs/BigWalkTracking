# Big Walk Telemetry

A local BepInEx 6 IL2CPP plugin that records movement routes and save-progress snapshots for the Big Walk map website.

## Output

Each session creates `route-<session>.ndjson` and `progress-<session>.ndjson` in:

`%USERPROFILE%\AppData\LocalLow\House House\Big Walk\BigWalkTelemetry`

Routes contain Unity coordinates, horizontal distance, scenes, and teleports. Progress snapshots are captured when a `.sav` changes. Lobby passwords are never exported, and 17-digit platform IDs are anonymized by default.

## Install

1. Install a current BepInEx 6 Unity IL2CPP x64 build beside `Big Walk.exe`.
2. Start the game once so BepInEx generates IL2CPP interop files, then close it.
3. Copy `BigWalkTelemetry.dll` into `BepInEx\plugins\BigWalkTelemetry\`.
4. Start Big Walk and load a save.

The plugin follows the main camera's nearest player-like parent. If the route tracks head motion instead of the character body, edit the generated BepInEx config and set `ForcedCameraParentDepth` to `1`, increasing it until `source` in the route file names the player root.

Live activities use the current Steam display name by default (`UseSteamName = true`).
If Steam is unavailable, or if you prefer a custom name, set `UseSteamName = false`
and edit `PlayerName` in the generated BepInEx config. Existing activities keep the
name recorded when they were created; the change applies to new sessions after the
updated DLL is installed.

Run `build.ps1` to rebuild. This mod does not send data over the network or alter saves.

## Landmark calibration checks

Supply your own screenshot crop instead of a machine-specific temporary path:

```sh
python tools/check_northwest_anchor.py /path/to/northwest-crop.png --map /path/to/big-walk-map.png
python tools/check_west_anchor.py /path/to/west-crop.png --map /path/to/big-walk-map.png
```

These scripts require OpenCV and NumPy. If `--map` is omitted, they look for
`web/public/big-walk-map.png`; the current repository contains only a Git reference
for `web`, so use `--map` when that source is unavailable.
