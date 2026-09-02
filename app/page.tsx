'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Check, Footprints, Radio, Route, Share2, Timer, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Point = { sequence: number; pixel_x: number; pixel_y: number; y: number; distance_metres: number; steps: number; teleport: number };
type LiveActivity = { id: string; player_name: string; title: string; scene: string; status: string; started_at: string; last_seen_at: string; distance_metres: number; steps: number; elevation_gain_metres: number; moving_seconds: number };

const demoActivity: LiveActivity = { id: 'demo', player_name: 'Corgs', title: 'Orange pole to the colour rooms', scene: 'WorldScene', status: 'live', started_at: new Date(Date.now() - 229000).toISOString(), last_seen_at: new Date().toISOString(), distance_metres: 511.919, steps: 683, elevation_gain_metres: 54.4, moving_seconds: 229 };
const demoPoints: Point[] = [{ sequence: 1, pixel_x: 262, pixel_y: 339, y: 37, distance_metres: 0, steps: 0, teleport: 0 }, { sequence: 2, pixel_x: 286.6, pixel_y: 244.4, y: 47, distance_metres: 196, steps: 261, teleport: 0 }, { sequence: 3, pixel_x: 294.1, pixel_y: 293, y: 34, distance_metres: 330, steps: 440, teleport: 0 }, { sequence: 4, pixel_x: 326.8, pixel_y: 239.4, y: 86, distance_metres: 511.9, steps: 683, teleport: 0 }];

export default function Home() {
  const [activity, setActivity] = useState(demoActivity);
  const [points, setPoints] = useState(demoPoints);
  const [copied, setCopied] = useState(false);
  const [isDemo, setIsDemo] = useState(true);

  const load = useCallback(async () => {
    const id = new URLSearchParams(window.location.search).get('activity');
    if (!id) return;
    const response = await fetch(`/api/activities/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    setActivity(payload.activity); setPoints(payload.points); setIsDemo(false);
  }, []);

  useEffect(() => { load(); const timer = window.setInterval(load, 2000); return () => window.clearInterval(timer); }, [load]);

  const routeSegments = useMemo(() => {
    const segments: Point[][] = [[]];
    points.forEach((point) => { if (point.teleport && segments.at(-1)?.length) segments.push([]); segments.at(-1)?.push(point); });
    return segments.filter((segment) => segment.length).map((segment) => segment.map((point) => `${point.pixel_x},${point.pixel_y}`).join(' '));
  }, [points]);
  const last = points.at(-1);
  const share = async () => {
    const data = { title: `${activity.player_name}'s Big Walk`, text: `${formatKm(activity.distance_metres)} · ${activity.steps.toLocaleString()} steps · ${formatTime(activity.moving_seconds)}`, url: window.location.href };
    if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(`${data.text} ${data.url}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 lg:px-8">
        <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Route /></div><div><p className="font-heading text-lg font-black tracking-tight">BIG WALK CLUB</p><p className="text-[10px] uppercase tracking-[.24em] text-muted-foreground">Live island activities</p></div></div>
        <div className="flex items-center gap-3"><Badge className={activity.status === 'live' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white'}>{activity.status === 'live' ? <Radio className="animate-pulse" /> : <Check />} {activity.status === 'live' ? 'Live' : 'Finished'}</Badge><Button variant="outline" onClick={share}>{copied ? <Check /> : <Share2 />}<span className="hidden sm:inline">{copied ? 'Copied' : 'Share activity'}</span></Button></div>
      </header>
      <section className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_350px] lg:p-6">
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.2em] text-primary">{activity.player_name} {activity.status === 'live' ? 'is walking' : 'went walking'}</p><h1 className="font-heading text-3xl font-black tracking-tight sm:text-5xl">{activity.title}</h1></div><p className="max-w-sm text-sm text-muted-foreground">A route across Big Walk, recorded directly from the player character.</p></div>
          <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[#276582] shadow-2xl">
            <img src="/big-walk-map.png" alt="Big Walk island map" className="block h-auto w-full" />
            <svg viewBox="0 0 814 783" className="absolute inset-0 h-full w-full" aria-label="Player route">{routeSegments.map((route, index) => <g key={index}><polyline points={route} fill="none" stroke="rgba(255,255,255,.86)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /><polyline points={route} fill="none" stroke="#ff5a26" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></g>)}{last && <circle cx={last.pixel_x} cy={last.pixel_y} r="10" fill="#ff5a26" stroke="white" strokeWidth="4" />}</svg>
            <div className="absolute left-4 top-4 rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2 text-xs font-bold backdrop-blur"><span className={`mr-2 inline-block size-2 rounded-full ${activity.status === 'live' ? 'bg-emerald-400' : 'bg-white/50'}`} />{isDemo ? 'Showing calibrated sample' : activity.status === 'live' ? 'Receiving live position' : 'Completed route'}</div>
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-[26px] border border-white/10 bg-card p-5 shadow-xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Current activity</p><p className="mt-1 font-heading text-2xl font-black">{activity.scene}</p></div><div className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary"><Activity /></div></div><div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10"><Stat icon={<Route />} label="Distance" value={formatKm(activity.distance_metres)} /><Stat icon={<Footprints />} label="Steps" value={activity.steps.toLocaleString()} /><Stat icon={<Timer />} label="Moving time" value={formatTime(activity.moving_seconds)} /><Stat icon={<Activity />} label="Elevation" value={`${Math.round(activity.elevation_gain_metres)} m`} /></div></div>
          <div className="rounded-[26px] border border-white/10 bg-card p-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">Players live</p><div className="mt-4 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-violet-500 font-black">{activity.player_name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{activity.player_name}</p><p className="text-xs text-muted-foreground">{activity.status === 'live' ? 'Walking · updated now' : 'Activity complete'}</p></div><span className={`size-2 rounded-full ${activity.status === 'live' ? 'bg-emerald-400' : 'bg-white/30'}`} /></div></div>
          <div className="rounded-[26px] bg-primary p-5 text-primary-foreground"><Footprints className="mb-6 size-7" /><p className="text-sm font-bold opacity-75">ACTIVITY TOTAL</p><p className="mt-1 font-heading text-4xl font-black">{activity.steps.toLocaleString()} steps</p><p className="mt-2 text-sm opacity-80">Every wander counts—even the scenic detours.</p></div>
          {isDemo && <div className="rounded-[26px] border border-dashed border-white/15 p-5"><Upload className="mb-3 text-muted-foreground" /><p className="font-bold">Waiting for your mod</p><p className="mt-1 text-sm text-muted-foreground">Open a live activity link from Big Walk Telemetry to replace this sample.</p></div>}
        </aside>
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="bg-card p-4"><div className="mb-3 text-primary [&_svg]:size-4">{icon}</div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-heading text-xl font-black">{value}</p></div>; }
function formatKm(metres: number) { return `${(metres / 1000).toFixed(2)} km`; }
function formatTime(seconds: number) { const mins = Math.floor(seconds / 60); return `${mins}:${String(seconds % 60).padStart(2, '0')}`; }
