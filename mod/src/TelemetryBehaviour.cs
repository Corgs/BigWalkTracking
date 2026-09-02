using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace BigWalkTelemetry;

public sealed class TelemetryBehaviour : MonoBehaviour
{
    private static readonly Regex PlatformKey = new(@"^(\d{17})(.*)$", RegexOptions.Compiled);
    private static readonly Regex PlatformId = new(@"\d{17}", RegexOptions.Compiled);
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, IncludeFields = true };
    private readonly string _sessionId = Guid.NewGuid().ToString("N");
    private readonly Dictionary<string, SaveStamp> _saveStamps = new(StringComparer.OrdinalIgnoreCase);
    private static readonly HttpClient Http = new();
    private Transform _trackedTransform;
    private Vector3 _lastSamplePosition;
    private Vector3 _lastWrittenPosition;
    private float _nextSampleAt;
    private float _nextSavePollAt;
    private float _lastPointAt;
    private double _walkingDistance;
    private double _elevationGain;
    private double _movingSeconds;
    private long _routePointCount;
    private string _outputDirectory = string.Empty;
    private string _routePath = string.Empty;
    private string _progressPath = string.Empty;
    private DateTime _startedUtc;

    public TelemetryBehaviour(IntPtr pointer) : base(pointer) { }

    private void Start()
    {
        _startedUtc = DateTime.UtcNow;
        _outputDirectory = Path.Combine(Application.persistentDataPath, "BigWalkTelemetry");
        Directory.CreateDirectory(_outputDirectory);
        _routePath = Path.Combine(_outputDirectory, $"route-{_sessionId}.ndjson");
        _progressPath = Path.Combine(_outputDirectory, $"progress-{_sessionId}.ndjson");
        WriteJsonLine(_routePath, new { type = "session-start", schemaVersion = 1, sessionId = _sessionId, timestampUtc = DateTime.UtcNow, gameVersion = Application.version, unityVersion = Application.unityVersion });
        Plugin.Log.LogInfo($"Telemetry session {_sessionId} writing to {_outputDirectory}");
    }

    private void Update()
    {
        var now = Time.unscaledTime;
        if (now >= _nextSampleAt)
        {
            _nextSampleAt = now + Math.Max(0.05f, Plugin.SampleInterval.Value);
            SampleMovement(now);
        }
        if (now >= _nextSavePollAt)
        {
            _nextSavePollAt = now + Math.Max(0.5f, Plugin.SavePollInterval.Value);
            PollSaves();
        }
    }

    private void SampleMovement(float now)
    {
        if (_trackedTransform == null)
        {
            _trackedTransform = FindPlayerTransform();
            if (_trackedTransform == null) return;
            _lastSamplePosition = _trackedTransform.position;
            _lastWrittenPosition = _lastSamplePosition;
            _lastPointAt = now;
            WriteRoutePoint(_lastSamplePosition, false, "acquired");
            Plugin.Log.LogInfo($"Tracking transform: {GetHierarchyPath(_trackedTransform)}");
            return;
        }

        Vector3 position;
        try { position = _trackedTransform.position; }
        catch { _trackedTransform = null; return; }
        var segment = HorizontalDistance(_lastSamplePosition, position);
        var teleport = segment > Math.Max(1f, Plugin.MaximumWalkingSegment.Value);
        if (!teleport && segment >= 0.01f)
        {
            _walkingDistance += segment;
            if (position.y > _lastSamplePosition.y) _elevationGain += position.y - _lastSamplePosition.y;
            if (segment >= 0.05f) _movingSeconds += Math.Max(0.05f, Plugin.SampleInterval.Value);
        }
        var pointDue = HorizontalDistance(_lastWrittenPosition, position) >= Math.Max(0.1f, Plugin.RoutePointDistance.Value)
                       || now - _lastPointAt >= Math.Max(1f, Plugin.RoutePointInterval.Value) || teleport;
        if (pointDue)
        {
            WriteRoutePoint(position, teleport, teleport ? "teleport" : "sample");
            _lastWrittenPosition = position;
            _lastPointAt = now;
        }
        _lastSamplePosition = position;
    }

    private Transform FindPlayerTransform()
    {
        var camera = Camera.main;
        if (camera == null) return null;
        var transform = camera.transform;
        if (Plugin.ForcedParentDepth.Value >= 0)
        {
            for (var i = 0; i < Plugin.ForcedParentDepth.Value && transform.parent != null; i++) transform = transform.parent;
            return transform;
        }
        Transform namedCandidate = null;
        var current = transform;
        for (var depth = 0; current != null && depth < 8; depth++)
        {
            if (current.GetComponent<CharacterController>() != null || current.GetComponent<Rigidbody>() != null) return current;
            var lowerName = current.name.ToLowerInvariant();
            if (namedCandidate == null && (lowerName.Contains("player") || lowerName.Contains("character") || lowerName.Contains("avatar"))) namedCandidate = current;
            current = current.parent;
        }
        return namedCandidate ?? camera.transform;
    }

    private void WriteRoutePoint(Vector3 position, bool teleport, string reason)
    {
        _routePointCount++;
        var point = CreateLivePoint(position, teleport, false);
        WriteJsonLine(_routePath, new { type = "route-point", schemaVersion = 2, point.activityId, point.playerId, point.playerName, point.title, point.startedAt, point.sequence, point.timestampUtc, point.scene, point.x, point.y, point.z, point.walkingDistanceMetres, point.steps, point.elevationGainMetres, point.movingSeconds, point.teleport, reason, source = _trackedTransform == null ? null : GetHierarchyPath(_trackedTransform) });
        PostLive(point);
    }

    private LivePoint CreateLivePoint(Vector3 position, bool teleport, bool ended)
    {
        return new LivePoint
        {
            activityId = _sessionId,
            playerId = ShortHash(SystemInfo.deviceUniqueIdentifier),
            playerName = Plugin.PlayerName.Value,
            title = Plugin.ActivityTitle.Value,
            startedAt = _startedUtc.ToString("o"),
            sequence = _routePointCount,
            timestampUtc = DateTime.UtcNow.ToString("o"),
            scene = SceneManager.GetActiveScene().name,
            x = Round(position.x), y = Round(position.y), z = Round(position.z),
            walkingDistanceMetres = Math.Round(_walkingDistance, 3),
            steps = (long)Math.Floor(_walkingDistance / Math.Max(0.2f, Plugin.StrideLength.Value)),
            elevationGainMetres = Math.Round(_elevationGain, 3),
            movingSeconds = (long)Math.Round(_movingSeconds),
            teleport = teleport,
            ended = ended,
        };
    }

    private static async void PostLive(LivePoint point)
    {
        var endpoint = Plugin.LiveEndpoint.Value.Trim();
        if (endpoint.Length == 0) return;
        try
        {
            var content = new StringContent(JsonSerializer.Serialize(point, JsonOptions), Encoding.UTF8, "application/json");
            using var response = await Http.PostAsync(endpoint, content);
            if (!response.IsSuccessStatusCode) Plugin.Log.LogWarning($"Live telemetry returned {(int)response.StatusCode}");
        }
        catch (Exception exception) { Plugin.Log.LogWarning($"Live telemetry failed: {exception.Message}"); }
    }

    private void PollSaves()
    {
        try
        {
            var saveDirectory = Path.Combine(Application.persistentDataPath, "user_data", "save_games");
            if (!Directory.Exists(saveDirectory)) return;
            foreach (var path in Directory.EnumerateFiles(saveDirectory, "*.sav", SearchOption.TopDirectoryOnly))
            {
                var info = new FileInfo(path);
                var stamp = new SaveStamp(info.LastWriteTimeUtc.Ticks, info.Length);
                if (_saveStamps.TryGetValue(path, out var previous) && previous == stamp) continue;
                _saveStamps[path] = stamp;
                CaptureProgress(path);
            }
        }
        catch (Exception exception) { Plugin.Log.LogWarning($"Could not poll saves: {exception.Message}"); }
    }

    private void CaptureProgress(string savePath)
    {
        try
        {
            var root = JsonNode.Parse(File.ReadAllText(savePath, Encoding.UTF8)) as JsonObject;
            if (root == null) return;
            root.Remove("password");
            root.Remove("lastPlayedTimeAsLong");
            AnonymizeEntryKeys(root["entries"] as JsonArray);
            WriteJsonLine(_progressPath, new { type = "save-snapshot", schemaVersion = 1, sessionId = _sessionId, timestampUtc = DateTime.UtcNow, saveFile = Path.GetFileName(savePath), save = root });
        }
        catch (Exception exception) { Plugin.Log.LogWarning($"Could not capture {Path.GetFileName(savePath)}: {exception.Message}"); }
    }

    private static void AnonymizeEntryKeys(JsonArray entries)
    {
        if (!Plugin.AnonymizePlatformIds.Value || entries == null) return;
        foreach (var node in entries)
        {
            if (node is not JsonObject entry || entry["key"] is not JsonValue keyValue || !keyValue.TryGetValue<string>(out var key)) continue;
            var match = PlatformKey.Match(key);
            if (match.Success) entry["key"] = $"player-{ShortHash(match.Groups[1].Value)}{match.Groups[2].Value}";
        }
    }

    private void OnApplicationQuit()
    {
        if (string.IsNullOrEmpty(_routePath)) return;
        if (_trackedTransform != null) PostLive(CreateLivePoint(_trackedTransform.position, false, true));
        WriteJsonLine(_routePath, new { type = "session-end", schemaVersion = 2, sessionId = _sessionId, timestampUtc = DateTime.UtcNow, walkingDistanceMetres = Math.Round(_walkingDistance, 3), steps = (long)Math.Floor(_walkingDistance / Math.Max(0.2f, Plugin.StrideLength.Value)), elevationGainMetres = Math.Round(_elevationGain, 3), movingSeconds = (long)Math.Round(_movingSeconds), routePointCount = _routePointCount });
    }

    private static void WriteJsonLine(string path, object value) => File.AppendAllText(path, JsonSerializer.Serialize(value, JsonOptions) + Environment.NewLine, Encoding.UTF8);
    private static string ShortHash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)), 0, 6).ToLowerInvariant();
    private static string GetHierarchyPath(Transform transform)
    {
        var names = new List<string>();
        var current = transform;
        for (var depth = 0; current != null && depth < 12; depth++) { names.Add(current.name); current = current.parent; }
        names.Reverse();
        var path = string.Join("/", names);
        if (!Plugin.AnonymizePlatformIds.Value) return path;
        var match = PlatformId.Match(path);
        while (match.Success)
        {
            path = path.Substring(0, match.Index) + "player-" + ShortHash(match.Value) + path.Substring(match.Index + match.Length);
            match = PlatformId.Match(path, match.Index + 7);
        }
        return path;
    }
    private static double HorizontalDistance(Vector3 a, Vector3 b) { var dx = (double)b.x - a.x; var dz = (double)b.z - a.z; return Math.Sqrt(dx * dx + dz * dz); }
    private static double Round(float value) => Math.Round(value, 3);
    private readonly record struct SaveStamp(long LastWriteTicks, long Length);

    private sealed class LivePoint
    {
        public string activityId = ""; public string playerId = ""; public string playerName = ""; public string title = ""; public string startedAt = ""; public long sequence; public string timestampUtc = ""; public string scene = "";
        public double x; public double y; public double z; public double walkingDistanceMetres; public long steps; public double elevationGainMetres; public long movingSeconds; public bool teleport; public bool ended;
    }
}

