"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, TriangleAlert, X } from "lucide-react";
import { IsoFigure, Plate } from "@/components/iso/react/draw";
import { FleetScene, GROUP_LABEL, HEIGHT, WIDTH, racksFor, type GroupBy } from "@/components/fleet/scene";
import { HealthBadge, PROVIDER_COLOR, PROVIDER_SHORT } from "@/components/host/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FleetHost, Region } from "@/lib/fleet";
import type { Provider } from "@/lib/hosts";

type Shade = "cpu" | "mem" | "disk";
type SortKey = "hostname" | "region" | "health" | "cpu" | "mem" | "disk";
const ALL = "all";
const PAGE = 15;
const HEALTH_RANK = { critical: 0, degraded: 1, healthy: 2 } as const;

interface Filters {
  q: string;
  provider: string;
  region: string;
  health: string;
  service: string;
}

const EMPTY: Filters = { q: "", provider: ALL, region: ALL, health: ALL, service: ALL };

function matches(host: FleetHost, f: Filters) {
  if (f.provider !== ALL && host.provider !== f.provider) return false;
  if (f.region !== ALL && host.region !== f.region) return false;
  if (f.health === "unhealthy" ? host.health === "healthy" : f.health !== ALL && host.health !== f.health) return false;
  if (f.service !== ALL && host.service !== f.service) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![host.hostname, host.id, host.service, host.instanceType, host.zone].some((v) => v.toLowerCase().includes(q))) return false;
  }
  return true;
}

export function FleetView({ hosts, regions, initialRegion }: { initialRegion?: string; hosts: FleetHost[]; regions: Region[] }) {
  const [filters, setFilters] = React.useState<Filters>(initialRegion ? { ...EMPTY, region: initialRegion } : EMPTY);
  const [shade, setShade] = React.useState<Shade>("cpu");
  const [groupBy, setGroupBy] = React.useState<GroupBy>("region");
  const [sort, setSort] = React.useState<{ key: SortKey; up: boolean }>({ key: "health", up: true });
  const [page, setPage] = React.useState(0);
  const [pointed, setPointed] = React.useState<string | null>(null);
  const [fromTable, setFromTable] = React.useState<string | null>(null);

  const shown = React.useMemo(() => hosts.filter((host) => matches(host, filters)), [hosts, filters]);
  const shownIds = React.useMemo(() => new Set(shown.map((host) => host.id)), [shown]);
  const sorted = React.useMemo(() => {
    const list = [...shown];
    const dir = sort.up ? 1 : -1;
    list.sort((a, b) => {
      const av = sort.key === "health" ? HEALTH_RANK[a.health] : a[sort.key];
      const bv = sort.key === "health" ? HEALTH_RANK[b.health] : b[sort.key];
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return b.cpu - a.cpu;
    });
    return list;
  }, [shown, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const rows = sorted.slice(page * PAGE, page * PAGE + PAGE);

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };
  const active = Object.entries(filters).filter(([key, value]) => (key === "q" ? value : value !== ALL)).length;

  const unhealthy = hosts.filter((h) => h.health !== "healthy");
  const alerts = hosts.flatMap((h) => h.alerts.map((title) => ({ host: h, title }))).sort((a, b) => HEALTH_RANK[a.host.health] - HEALTH_RANK[b.host.health]);
  const avg = (list: FleetHost[], key: "cpu" | "mem") => (list.length ? Math.round(list.reduce((s, h) => s + h[key], 0) / list.length) : 0);
  const services = [...new Set(hosts.map((h) => h.service))].sort();
  const counts = { degraded: hosts.filter((h) => h.health === "degraded").length, critical: hosts.filter((h) => h.health === "critical").length };

  const sortBy = (key: SortKey) => setSort((s) => ({ key, up: s.key === key ? !s.up : key === "hostname" || key === "region" || key === "health" }));
  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {sort.key === k ? sort.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </TableHead>
  );

  const rest = `${shown.length === hosts.length ? `${hosts.length} hosts` : `${shown.length} of ${hosts.length} hosts`} · ${racksFor(hosts, regions, groupBy).length} racks by ${GROUP_LABEL[groupBy].toLowerCase()} · ${counts.degraded} degraded · ${counts.critical} critical`;

  return (
    <div className="space-y-6">
      {/* Summary numbers; the unhealthy ones filter the page. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Hosts" value={hosts.length} sub={`${regions.length} regions · 3 clouds`} onClick={() => set(EMPTY)} on={active === 0} />
        <Kpi label="Unhealthy" value={unhealthy.length} sub={`${counts.degraded} degraded · ${counts.critical} critical`} tone="warn" onClick={() => set({ health: filters.health === "unhealthy" ? ALL : "unhealthy" })} on={filters.health === "unhealthy"} />
        <Kpi label="Open alerts" value={alerts.length} sub={`on ${unhealthy.length} hosts`} tone={alerts.length ? "warn" : undefined} onClick={() => set({ health: filters.health === "unhealthy" ? ALL : "unhealthy" })} on={false} />
        <Kpi label="Avg CPU" value={`${avg(shown, "cpu")}%`} sub={active ? "filtered hosts" : "all hosts"} />
        <Kpi label="Avg memory" value={`${avg(shown, "mem")}%`} sub={active ? "filtered hosts" : "all hosts"} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search host, ID, service…" className="pl-8" aria-label="Search hosts" />
        </div>
        <Pick label="Cloud" value={filters.provider} onChange={(v) => set({ provider: v, region: ALL })} options={(["aws", "azure", "gcp"] as Provider[]).map((p) => ({ value: p, label: PROVIDER_SHORT[p], dot: PROVIDER_COLOR[p] }))} />
        <Pick label="Region" value={filters.region} onChange={(v) => set({ region: v })} options={regions.filter((r) => filters.provider === ALL || r.provider === filters.provider).map((r) => ({ value: r.id, label: r.id, dot: PROVIDER_COLOR[r.provider] }))} />
        <Pick label="Health" value={filters.health} onChange={(v) => set({ health: v })} options={[{ value: "unhealthy", label: "Unhealthy" }, { value: "healthy", label: "Healthy" }, { value: "degraded", label: "Degraded" }, { value: "critical", label: "Critical" }]} />
        <Pick label="Service" value={filters.service} onChange={(v) => set({ service: v })} options={services.map((s) => ({ value: s, label: s }))} />
        {active ? (
          <Button variant="ghost" size="sm" onClick={() => set(EMPTY)}>
            <X className="size-4" /> Clear {active}
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          Group by
          <div role="radiogroup" aria-label="Group racks by" className="inline-flex rounded-lg border p-0.5">
            {(Object.keys(GROUP_LABEL) as GroupBy[]).map((key) => (
              <button key={key} type="button" role="radio" aria-checked={groupBy === key} onClick={() => setGroupBy(key)} className={cn("rounded-md px-2.5 py-1 text-xs transition-colors hover:text-foreground", groupBy === key && "bg-muted text-foreground")}>
                {GROUP_LABEL[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          Shade by
          <div role="radiogroup" aria-label="Shade blades by" className="inline-flex rounded-lg border p-0.5">
            {(["cpu", "mem", "disk"] as Shade[]).map((key) => (
              <button key={key} type="button" role="radio" aria-checked={shade === key} onClick={() => setShade(key)} className={cn("rounded-md px-2.5 py-1 text-xs transition-colors hover:text-foreground", shade === key && "bg-muted text-foreground")}>
                {key === "cpu" ? "CPU" : key === "mem" ? "Memory" : "Disk"}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* The racks */}
      <div className="iso fleet-host">
        <Plate
          fig="Fleet"
          title={`Racks by ${GROUP_LABEL[groupBy].toLowerCase()}`}
          hint="Point at a host · click to open"
          readout={rest}
          keys={[
            { mark: "green", label: "Healthy" },
            { mark: "dim", label: "Amber panel: degraded" },
            { mark: "red", label: "Red, pulsing: critical" },
            { mark: "raised", label: `Front panel shade: ${shade === "cpu" ? "CPU" : shade === "mem" ? "memory" : "disk"} use` },
          ]}
          caption="Each rack holds one group, up to 20 hosts, with unhealthy hosts at the top. A lit beacon means a rack has hosts that need attention, and the nameplate counts them. Groups larger than 20 fill more racks. Cloud VMs don't occupy your own racks: this is a grouping, not a map of hardware."
        >
          <IsoFigure width={WIDTH} height={HEIGHT} label={`Server racks for ${regions.length} regions holding ${hosts.length} hosts, each host a 1U blade whose front LED shows its health.`} className="fleet">
            <FleetScene hosts={hosts} regions={regions} groupBy={groupBy} shown={shownIds} shade={shade} rest={rest} focus={fromTable} onPoint={setPointed} />
          </IsoFigure>
        </Plate>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Hosts</CardTitle>
            <CardDescription>
              {shown.length} {shown.length === 1 ? "host" : "hosts"}
              {active ? " match the filters" : ""}. Point at a row to find it in its rack.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="hostname" label="Host" />
                  <SortHead k="region" label="Region" />
                  <SortHead k="health" label="Health" />
                  <SortHead k="cpu" label="CPU" className="w-24" />
                  <SortHead k="mem" label="Mem" className="w-24" />
                  <SortHead k="disk" label="Disk" className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((host) => (
                  <TableRow
                    key={host.id}
                    data-on={pointed === host.id ? "" : undefined}
                    onPointerEnter={() => setFromTable(host.id)}
                    onPointerLeave={() => setFromTable(null)}
                    className="cursor-pointer data-[on]:bg-muted"
                  >
                    <TableCell className="max-w-[18rem]">
                      <Link href={`/hosts/${host.id}`} className="block truncate font-mono text-[13px] hover:underline" onFocus={() => setFromTable(host.id)} onBlur={() => setFromTable(null)}>
                        {host.hostname}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {host.service} · {host.instanceType}
                        {host.env === "staging" ? " · staging" : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[13px]">
                        <span className="size-2 rounded-full" style={{ background: PROVIDER_COLOR[host.provider] }} />
                        {host.region}
                      </span>
                      <div className="font-mono text-xs text-muted-foreground">{host.zone}</div>
                    </TableCell>
                    <TableCell>
                      <HealthBadge health={host.health} />
                    </TableCell>
                    <TableCell><Bar value={host.cpu} /></TableCell>
                    <TableCell><Bar value={host.mem} /></TableCell>
                    <TableCell><Bar value={host.disk} /></TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No hosts match these filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {sorted.length ? `${page * PAGE + 1}–${Math.min(sorted.length, page * PAGE + PAGE)} of ${sorted.length}` : "0 of 0"}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="size-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon" className="size-8" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open alerts</CardTitle>
            <CardDescription>Across the fleet, worst first</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {alerts.map(({ host, title }) => (
              <Link
                key={host.id + title}
                href={`/hosts/${host.id}`}
                onPointerEnter={() => setFromTable(host.id)}
                onPointerLeave={() => setFromTable(null)}
                className={cn("-mx-2 flex gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted", pointed === host.id && "bg-muted")}
              >
                <TriangleAlert className={cn("mt-0.5 size-4 shrink-0", host.health === "critical" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
                <span className="min-w-0">
                  <span className="block">{title}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {host.hostname} · {host.region}
                  </span>
                </span>
              </Link>
            ))}
            {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Nothing open.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, onClick, on }: { label: string; value: React.ReactNode; sub: string; tone?: "warn"; onClick?: () => void; on?: boolean }) {
  const body = (
    <>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl tabular-nums", tone === "warn" && "text-amber-600 dark:text-amber-400")}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </>
  );
  const base = "rounded-xl border bg-card p-4 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn(base, "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on && "ring-2 ring-ring/60")}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string; dot?: string }> }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className={cn("min-w-[8.5rem]", value !== ALL && "border-ring/60")} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label === "Health" ? "health" : label === "Cloud" ? "clouds" : `${label.toLowerCase()}s`}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.dot ? <span className="size-2 rounded-full" style={{ background: option.dot }} /> : null}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Bar({ value }: { value: number }) {
  const tone = value >= 85 ? "bg-red-500" : value >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums">{value}%</span>
    </div>
  );
}
