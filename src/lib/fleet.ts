import { HOSTS, wave, type Health, type Host, type Provider } from "@/lib/hosts";

// A sample fleet of 84 hosts in 6 regions. The three detailed hosts from hosts.ts are part
// of it; the rest are generated from a fixed seed, so every load shows the same fleet.

export interface Region {
  id: string;
  provider: Provider;
  name: string;
  zones: string[];
  count: number;
}

export const REGIONS: Region[] = [
  { id: "us-east-1", provider: "aws", name: "N. Virginia", zones: ["us-east-1a", "us-east-1b", "us-east-1c"], count: 18 },
  { id: "eu-west-1", provider: "aws", name: "Ireland", zones: ["eu-west-1a", "eu-west-1b", "eu-west-1c"], count: 12 },
  { id: "eastus2", provider: "azure", name: "East US 2", zones: ["1", "2", "3"], count: 16 },
  { id: "westeurope", provider: "azure", name: "West Europe", zones: ["1", "2", "3"], count: 12 },
  { id: "us-central1", provider: "gcp", name: "Iowa", zones: ["us-central1-a", "us-central1-b", "us-central1-c"], count: 14 },
  { id: "asia-southeast1", provider: "gcp", name: "Singapore", zones: ["asia-southeast1-a", "asia-southeast1-b", "asia-southeast1-c"], count: 12 },
];

interface InstanceType {
  name: string;
  vcpus: number;
  memGiB: number;
  cpu: string;
}

const TYPES: Record<Provider, InstanceType[]> = {
  aws: [
    { name: "m7i.2xlarge", vcpus: 8, memGiB: 32, cpu: "Intel Xeon Platinum 8488C" },
    { name: "c7i.4xlarge", vcpus: 16, memGiB: 32, cpu: "Intel Xeon Platinum 8488C" },
    { name: "r7i.2xlarge", vcpus: 8, memGiB: 64, cpu: "Intel Xeon Platinum 8488C" },
  ],
  azure: [
    { name: "Standard_D8ds_v5", vcpus: 8, memGiB: 32, cpu: "Intel Xeon Platinum 8370C" },
    { name: "Standard_E8ds_v5", vcpus: 8, memGiB: 64, cpu: "Intel Xeon Platinum 8370C" },
    { name: "Standard_D16ds_v5", vcpus: 16, memGiB: 64, cpu: "Intel Xeon Platinum 8370C" },
  ],
  gcp: [
    { name: "c3-standard-8", vcpus: 8, memGiB: 32, cpu: "Intel Xeon Platinum 8481C" },
    { name: "c3-highmem-8", vcpus: 8, memGiB: 64, cpu: "Intel Xeon Platinum 8481C" },
    { name: "c3-standard-22", vcpus: 22, memGiB: 88, cpu: "Intel Xeon Platinum 8481C" },
  ],
};

const SERVICES: Array<{ service: string; team: string }> = [
  { service: "cart-api", team: "checkout" },
  { service: "orders-worker", team: "orders" },
  { service: "indexer", team: "search" },
  { service: "payments", team: "payments" },
  { service: "auth", team: "identity" },
  { service: "catalog", team: "catalog" },
  { service: "ingest", team: "data" },
  { service: "kafka", team: "platform" },
];

export interface FleetHost {
  id: string;
  hostname: string;
  provider: Provider;
  region: string;
  zone: string;
  instanceType: string;
  vcpus: number;
  memGiB: number;
  service: string;
  team: string;
  env: "prod" | "staging";
  health: Health;
  cpu: number;
  mem: number;
  disk: number;
  alerts: string[];
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (rand: () => number, length: number) => Array.from({ length }, () => Math.floor(rand() * 16).toString(16)).join("");
const digits = (rand: () => number, length: number) => Array.from({ length }, (_, i) => Math.floor(rand() * (i ? 10 : 9)) + (i ? 0 : 1)).join("");

function idFor(provider: Provider, rand: () => number) {
  if (provider === "aws") return `i-0${hex(rand, 16)}`;
  if (provider === "azure") return `${hex(rand, 8)}-${hex(rand, 4)}-4${hex(rand, 3)}-a${hex(rand, 3)}-${hex(rand, 12)}`;
  return digits(rand, 19);
}

function hostnameFor(provider: Provider, region: Region, zone: string, service: string, index: number, rand: () => number) {
  if (provider === "aws") {
    const ip = `10-${20 + REGIONS.indexOf(region)}-${Math.floor(rand() * 8)}-${10 + Math.floor(rand() * 240)}`;
    return region.id === "us-east-1" ? `ip-${ip}.ec2.internal` : `ip-${ip}.${region.id}.compute.internal`;
  }
  if (provider === "azure") return `vm-${service}-${region.id === "eastus2" ? "prod" : "weu"}-${String(index).padStart(2, "0")}`;
  return `${service}-${index}.${zone}.c.acme-${service}.internal`;
}

function alertsFor(health: Health, cpu: number, mem: number, disk: number) {
  if (health === "healthy") return [];
  const out: string[] = [];
  if (mem >= 80) out.push(`Memory above 80% (${mem}%)`);
  if (cpu >= 75) out.push(`CPU above 75% (${cpu}%)`);
  if (disk >= 80) out.push(`Disk / above 80% (${disk}%)`);
  if (health === "critical") out.push("Agent heartbeat late (> 60 s)");
  return out.length ? out : ["Status check degraded"];
}

function build(seed: number, counts: Record<string, number>): FleetHost[] {
  const rand = random(seed);
  const out: FleetHost[] = [];
  const pinned = new Map(HOSTS.map((host) => [host.region, host]));
  for (const region of REGIONS) {
    for (let index = 0; index < (counts[region.id] ?? region.count); index++) {
      const zone = region.zones[index % region.zones.length]!;
      const detailed = index === 1 ? pinned.get(region.id) : undefined;
      if (detailed) {
        out.push({
          id: detailed.id,
          hostname: detailed.hostname,
          provider: detailed.provider,
          region: region.id,
          zone: detailed.zone,
          instanceType: detailed.instanceType,
          vcpus: detailed.cpu.vcpus,
          memGiB: detailed.memory.totalGiB,
          service: detailed.tags.service!,
          team: detailed.tags.team!,
          env: "prod",
          health: detailed.health,
          cpu: detailed.usage.cpu,
          mem: Math.round((detailed.memory.usedGiB / detailed.memory.totalGiB) * 100),
          disk: detailed.usage.disk,
          alerts: detailed.alerts.map((alert) => alert.title),
        });
        continue;
      }
      const type = TYPES[region.provider][Math.floor(rand() * 3)]!;
      const { service, team } = SERVICES[Math.floor(rand() * SERVICES.length)]!;
      const roll = rand();
      const health: Health = roll < 0.035 ? "critical" : roll < 0.11 ? "degraded" : "healthy";
      const hot = health === "healthy" ? 0 : 1;
      const cpu = Math.round(12 + rand() * 50 + hot * 26);
      const mem = Math.round(28 + rand() * 46 + hot * 18);
      const disk = Math.round(18 + rand() * 52 + (health === "critical" ? 20 : 0));
      out.push({
        id: idFor(region.provider, rand),
        hostname: hostnameFor(region.provider, region, zone, service, index + 1, rand),
        provider: region.provider,
        region: region.id,
        zone,
        instanceType: type.name,
        vcpus: type.vcpus,
        memGiB: type.memGiB,
        service,
        team,
        env: rand() < 0.82 ? "prod" : "staging",
        health,
        cpu: Math.min(cpu, 98),
        mem: Math.min(mem, 97),
        disk: Math.min(disk, 96),
        alerts: alertsFor(health, cpu, mem, disk),
      });
    }
  }
  return out;
}

export const FLEET: FleetHost[] = build(84, {});

// A larger sample for trying the data hall view: 500 hosts in the same six regions.
export const FLEET_500: FleetHost[] = build(500, {
  "us-east-1": 120,
  "eu-west-1": 70,
  eastus2: 95,
  westeurope: 60,
  "us-central1": 95,
  "asia-southeast1": 60,
});

export const FLEETS = { "84": FLEET, "500": FLEET_500 } as const;
export type FleetSize = keyof typeof FLEETS;

// The largest size in an instance's family, which is roughly what one host holds.
function familyOf(type: string): Host["family"] {
  if (type.startsWith("Standard_")) {
    const letter = type.charAt(9);
    return { name: `${letter}dsv5`, largest: `Standard_${letter}96ds_v5`, vcpus: 96 };
  }
  if (type.startsWith("c3-")) {
    const kind = type.split("-")[1];
    return { name: "C3", largest: `c3-${kind}-176`, vcpus: 176 };
  }
  const prefix = type.split(".")[0];
  return { name: prefix!, largest: `${prefix}.48xlarge`, vcpus: 192 };
}

export const fleetHost = (id: string) => FLEET.find((host) => host.id === id) ?? FLEET_500.find((host) => host.id === id);

// The full host record for the drill-down page: the detailed hosts as written, the rest
// built from their provider's template with this host's own numbers.
export function hostRecord(id: string): Host | undefined {
  const exact = HOSTS.find((host) => host.id === id);
  if (exact) return exact;
  const lite = fleetHost(id);
  if (!lite) return undefined;
  const template = HOSTS.find((host) => host.provider === lite.provider)!;
  const type = TYPES[lite.provider].find((t) => t.name === lite.instanceType)!;
  const seed = Math.max(FLEET.indexOf(lite), FLEET_500.indexOf(lite));
  const swap = (text: string) =>
    text
      .split(template.id)
      .join(lite.id)
      .split(template.hostname)
      .join(lite.hostname)
      .split(template.instanceType)
      .join(lite.instanceType)
      .split(template.zone)
      .join(lite.zone)
      .split(template.region)
      .join(lite.region);
  const usedGiB = Math.round(((lite.mem / 100) * lite.memGiB) * 10) / 10;
  return {
    ...template,
    id: lite.id,
    hostname: lite.hostname,
    health: lite.health,
    instanceType: lite.instanceType,
    region: lite.region,
    zone: lite.zone,
    uptime: `${3 + (seed % 40)}d ${seed % 24}h ${(seed * 7) % 60}m`,
    lastSeen: lite.health === "critical" ? "74s ago" : `${3 + (seed % 12)}s ago`,
    tags: { env: lite.env, team: lite.team, service: lite.service },
    cpu: { ...template.cpu, model: type.cpu, vcpus: type.vcpus, cores: type.vcpus / 2 },
    memory: { ...template.memory, totalGiB: type.memGiB, usedGiB },
    usage: { ...template.usage, cpu: lite.cpu, memory: lite.mem, disk: lite.disk, load: [(lite.cpu / 100) * type.vcpus * 1.1, (lite.cpu / 100) * type.vcpus, (lite.cpu / 100) * type.vcpus * 0.92].map((v) => Math.round(v * 100) / 100) as [number, number, number] },
    disks: template.disks.map((disk, index) => (index === 0 ? { ...disk, usedPct: lite.disk } : disk)),
    metadata: template.metadata.map(([key, value]) => [key, swap(value)]),
    spec: { ...template.spec, status: lite.health === "healthy" ? "ok" : "warn" },
    family: familyOf(lite.instanceType),
    alerts: lite.alerts.map((title) => ({ level: lite.health === "critical" ? "critical" : "warning", title, detail: "Sample alert generated for the demo fleet.", since: "20:41 UTC" })),
    events: [
      ...lite.alerts.map((title) => ({ at: "2026-10-25 20:41", kind: "warning" as const, text: `Alert opened: ${title}` })),
      { at: "2026-10-20 09:12", kind: "change" as const, text: `${lite.service} deployed by ${lite.team}` },
    ],
    parts: {
      ...template.parts,
      cpu0: { name: "CPU socket 0", detail: `${type.cpu.replace("Intel ", "")} · this VM: ${type.vcpus / 2} cores / ${type.vcpus} vCPU` },
      cpu1: { name: "CPU socket 1", detail: `${type.cpu.replace("Intel ", "")} · this VM: ${type.vcpus / 2} cores / ${type.vcpus} vCPU` },
      cpu: { name: "CPUs", detail: `2 sockets · ${type.cpu.replace("Intel ", "")} · this VM: ${type.vcpus} vCPU` },
    },
    sparks: { cpu: wave(seed, lite.cpu, 12), memory: wave(seed + 3, lite.mem, 4) },
  };
}
