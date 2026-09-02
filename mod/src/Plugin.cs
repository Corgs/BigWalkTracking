using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;

namespace BigWalkTelemetry;

[BepInPlugin(MyPluginInfo.PLUGIN_GUID, MyPluginInfo.PLUGIN_NAME, MyPluginInfo.PLUGIN_VERSION)]
[BepInProcess("Big Walk.exe")]
public sealed class Plugin : BasePlugin
{
    internal static new ManualLogSource Log = null!;
    internal static ConfigEntry<float> SampleInterval = null!;
    internal static ConfigEntry<float> RoutePointDistance = null!;
    internal static ConfigEntry<float> RoutePointInterval = null!;
    internal static ConfigEntry<float> MaximumWalkingSegment = null!;
    internal static ConfigEntry<float> SavePollInterval = null!;
    internal static ConfigEntry<int> ForcedParentDepth = null!;
    internal static ConfigEntry<bool> AnonymizePlatformIds = null!;
    internal static ConfigEntry<float> StrideLength = null!;
    internal static ConfigEntry<string> LiveEndpoint = null!;
    internal static ConfigEntry<string> PlayerName = null!;
    internal static ConfigEntry<string> ActivityTitle = null!;

    public override void Load()
    {
        Log = base.Log;
        SampleInterval = Config.Bind("Movement", "SampleIntervalSeconds", 0.25f, "How often player position is sampled.");
        RoutePointDistance = Config.Bind("Movement", "RoutePointDistanceMetres", 1.0f, "Write a route point after moving this far.");
        RoutePointInterval = Config.Bind("Movement", "RoutePointIntervalSeconds", 5.0f, "Stationary heartbeat interval.");
        MaximumWalkingSegment = Config.Bind("Movement", "MaximumWalkingSegmentMetres", 20.0f, "Larger jumps are teleports, not walking.");
        SavePollInterval = Config.Bind("Progress", "SavePollIntervalSeconds", 2.0f, "How often saves are checked for changes.");
        ForcedParentDepth = Config.Bind("Player", "ForcedCameraParentDepth", -1, "-1 selects automatically; 0 is camera, 1 its parent, etc.");
        AnonymizePlatformIds = Config.Bind("Privacy", "AnonymizePlatformIds", true, "Anonymize 17-digit platform IDs.");
        StrideLength = Config.Bind("Movement", "StrideLengthMetres", 0.75f, "Used to estimate steps from horizontal distance.");
        LiveEndpoint = Config.Bind("Live", "TelemetryEndpoint", "", "Full Big Walk Club /api/telemetry URL. Leave blank for file-only tracking.");
        PlayerName = Config.Bind("Live", "PlayerName", "Walker", "Public display name for live activities.");
        ActivityTitle = Config.Bind("Live", "ActivityTitle", "A Big Walk", "Title shown on the activity post.");
        AddComponent<TelemetryBehaviour>();
        Log.LogInfo("Big Walk Telemetry loaded. Route data stays on this computer.");
    }
}
