import type { BladeSpec } from "@/components/blade/geometry";

// Sample hosts for the demo. Instance types, CPUs and metadata fields follow what each
// provider publishes (EC2 IMDSv2, Azure IMDS, GCE metadata server). IDs, IPs and
// account numbers are made up.

export type Provider = "aws" | "azure" | "gcp";
export type Health = "healthy" | "degraded" | "critical";

export interface Part {
  name: string;
  detail: string;
}

export interface Host {
  id: string;
  provider: Provider;
  providerName: string;
  hostname: string;
  health: Health;
  instanceType: string;
  region: string;
  zone: string;
  uptime: string;
  bootedAt: string;
  lastSeen: string;
  tags: Record<string, string>;
  os: { name: string; version: string; kernel: string; arch: string; image: string; imageId: string };
  cpu: { model: string; vcpus: number; cores: number; threadsPerCore: number; baseGhz: number; turboGhz: number; l3: string; flags: string[] };
  memory: { totalGiB: number; usedGiB: number; swapGiB: number; hugepages: string };
  hypervisor: { name: string; virt: string; offload: string; rootOfTrust: string };
  build: { agent: string; agentVersion: string; config: string; buildId: string; collectors: string[] };
  usage: { cpu: number; memory: number; disk: number; load: [number, number, number]; netIn: string; netOut: string };
  disks: Array<{ device: string; mount: string; type: string; sizeGiB: number; usedPct: number; fs: string }>;
  nics: Array<{ name: string; mac: string; ipv4: string; speed: string; driver: string }>;
  metadata: Array<[string, string]>;
  spec: BladeSpec;
  family: { name: string; largest: string; vcpus: number };
  alerts: Array<{ level: "warning" | "critical"; title: string; detail: string; since: string }>;
  events: Array<{ at: string; kind: "info" | "warning" | "change"; text: string }>;
  parts: Record<string, Part>;
  sparks: { cpu: number[]; memory: number[] };
}

export const wave = (seed: number, base: number, swing: number) =>
  Array.from({ length: 48 }, (_, index) => Math.round(Math.max(1, Math.min(99, base + Math.sin(index / 4 + seed) * swing + Math.sin(index * 1.7 + seed * 3) * swing * 0.35))));

const commonParts = (cpu: string, dimm: string): Record<string, Part> => ({
  cpu: { name: "CPUs", detail: `2 sockets · ${cpu}` },
  mem: { name: "Memory", detail: dimm },
  power: { name: "Power", detail: "Power entry" },
  cpu0: { name: "CPU socket 0", detail: cpu },
  cpu1: { name: "CPU socket 1", detail: cpu },
  vrm0: { name: "VRM, socket 0", detail: "Voltage regulators feeding socket 0" },
  vrm1: { name: "VRM, socket 1", detail: "Voltage regulators feeding socket 1" },
  mem0: { name: "Memory, socket 0", detail: dimm },
  mem1: { name: "Memory, socket 1", detail: dimm },
  fan0: { name: "Fan 1", detail: "Hot-swap fan module" },
  fan1: { name: "Fan 2", detail: "Hot-swap fan module" },
  fan2: { name: "Fan 3", detail: "Hot-swap fan module" },
  fan3: { name: "Fan 4", detail: "Hot-swap fan module" },
  fan4: { name: "Fan 5", detail: "Hot-swap fan module" },
  fan5: { name: "Fan 6", detail: "Hot-swap fan module" },
  fans: { name: "Fan cage", detail: "Front-to-back airflow" },
  bmc: { name: "BMC", detail: "Baseboard management controller" },
  pch: { name: "Chipset", detail: "Platform controller hub" },
  boot: { name: "Boot SSD", detail: "M.2 NVMe, host firmware and hypervisor" },
  caps: { name: "Capacitors", detail: "Bulk capacitance at power entry" },
  riser: { name: "PCIe riser", detail: "PCIe Gen5 riser" },
  board: { name: "Motherboard", detail: "Dual-socket board" },
  chassis: { name: "Chassis", detail: "1U, 19-inch rack" },
  bezel: { name: "Front bezel", detail: "Air intake" },
  status: { name: "Status LEDs", detail: "Health · identify" },
  tag: { name: "Service tag", detail: "Pull-out asset label" },
  front: { name: "Front panel board", detail: "Power button, ID and health LEDs" },
  mcio: { name: "MCIO connectors", detail: "PCIe Gen5 cabling to riser and drives" },
  drives: { name: "NVMe drives", detail: "Hot-swap U.2/E1.S carriers on a backplane" },
  tpm: { name: "TPM module", detail: "Measured boot for the host firmware" },
  io: { name: "Rear I/O", detail: "Management network, USB, serial" },
  slot: { name: "Spare slots", detail: "Empty PCIe and OCP 3.0 slots" },
  pdb: { name: "Power distribution board", detail: "Fused 12 V feeds to the board, fans and drives" },
});

export const HOSTS: Host[] = [
  {
    id: "i-0a7f3c91e2d4b5861",
    provider: "aws",
    providerName: "Amazon EC2",
    hostname: "ip-10-24-3-118.ec2.internal",
    health: "healthy",
    instanceType: "m7i.2xlarge",
    region: "us-east-1",
    zone: "us-east-1b",
    uptime: "41d 6h 12m",
    bootedAt: "2026-09-14 14:39 UTC",
    lastSeen: "12s ago",
    tags: { env: "prod", team: "checkout", service: "cart-api", "aws:autoscaling:groupName": "cart-api-asg" },
    os: { name: "Amazon Linux", version: "2023.6.20250929", kernel: "6.1.155-176.282.amzn2023.x86_64", arch: "x86_64", image: "al2023-ami-2023.6.20250929.0-kernel-6.1-x86_64", imageId: "ami-0c1f7a3d9e2b4a615" },
    cpu: { model: "Intel Xeon Platinum 8488C", vcpus: 8, cores: 4, threadsPerCore: 2, baseGhz: 2.4, turboGhz: 3.8, l3: "105 MiB", flags: ["avx512f", "amx_tile", "amx_bf16", "aes", "sha_ni"] },
    memory: { totalGiB: 32, usedGiB: 19.4, swapGiB: 0, hugepages: "0 × 2 MiB" },
    hypervisor: { name: "Nitro", virt: "KVM-based Nitro Hypervisor", offload: "Nitro Cards (VPC, EBS, controller)", rootOfTrust: "Nitro Security Chip" },
    build: { agent: "otel-collector-contrib", agentVersion: "0.112.0", config: "s3://obs-config/prod/cart-api.yaml", buildId: "bld-2026.10.21-7e1c", collectors: ["hostmetrics", "journald", "awsecscontainermetrics", "prometheus"] },
    usage: { cpu: 46, memory: 61, disk: 38, load: [3.42, 3.18, 2.97], netIn: "412 Mb/s", netOut: "268 Mb/s" },
    disks: [
      { device: "/dev/nvme0n1p1", mount: "/", type: "EBS gp3", sizeGiB: 50, usedPct: 38, fs: "xfs" },
      { device: "/dev/nvme1n1", mount: "/var/lib/data", type: "EBS io2", sizeGiB: 500, usedPct: 54, fs: "xfs" },
    ],
    nics: [{ name: "ens5", mac: "0a:3f:9c:41:7e:d1", ipv4: "10.24.3.118", speed: "Up to 12.5 Gb/s", driver: "ena 2.13.0" }],
    metadata: [
      ["instance-id", "i-0a7f3c91e2d4b5861"],
      ["instance-type", "m7i.2xlarge"],
      ["ami-id", "ami-0c1f7a3d9e2b4a615"],
      ["placement/availability-zone", "us-east-1b"],
      ["placement/availability-zone-id", "use1-az4"],
      ["local-ipv4", "10.24.3.118"],
      ["mac", "0a:3f:9c:41:7e:d1"],
      ["iam/info → InstanceProfileArn", "arn:aws:iam::123456789012:instance-profile/cart-api"],
      ["identity → accountId", "123456789012"],
      ["hibernation/configured", "false"],
      ["IMDS", "v2 (token required), hop limit 2"],
    ],
    spec: { drives: 0, fans: 6, cards: ["nitro", "nitro"], power: "dual", status: "ok" },
    family: { name: "m7i", largest: "m7i.48xlarge", vcpus: 192 },
    alerts: [],
    events: [
      { at: "2026-10-25 19:02", kind: "info", text: "Instance status checks 2/2 passed" },
      { at: "2026-10-24 03:15", kind: "change", text: "otel-collector-contrib upgraded 0.111.0 → 0.112.0" },
      { at: "2026-10-21 16:40", kind: "change", text: "EBS volume vol-0d3… resized 400 → 500 GiB (io2)" },
      { at: "2026-09-14 14:39", kind: "info", text: "Instance launched by cart-api-asg" },
    ],
    parts: {
      ...commonParts("Xeon Platinum 8488C · this VM: 4 cores / 8 vCPU", "DDR5-4800 RDIMM · this VM: 32 GiB"),
      card: { name: "Nitro Card", detail: "VPC networking and EBS storage, in hardware" },
      card2: { name: "Nitro Card", detail: "Nitro controller" },
      trust: { name: "Nitro Security Chip", detail: "Hardware root of trust, locks host firmware" },
      power: { name: "Power supplies", detail: "2 × PSU, redundant 1+1" },
      psu0: { name: "PSU 1", detail: "Redundant 1+1" },
      psu1: { name: "PSU 2", detail: "Redundant 1+1" },
      bezel: { name: "Front bezel", detail: "No local drives: storage is EBS over Nitro" },
    },
    sparks: { cpu: wave(1, 46, 14), memory: wave(4, 61, 4) },
  },
  {
    id: "5f2c8e0a-7b14-4d9e-a3c6-1e8d0b92f471",
    provider: "azure",
    providerName: "Microsoft Azure",
    hostname: "vm-orders-prod-03",
    health: "degraded",
    instanceType: "Standard_D8ds_v5",
    region: "eastus2",
    zone: "2",
    uptime: "12d 19h 47m",
    bootedAt: "2026-10-13 01:04 UTC",
    lastSeen: "8s ago",
    tags: { env: "prod", team: "orders", service: "orders-worker", costCenter: "cc-4410" },
    os: { name: "Ubuntu", version: "22.04.5 LTS", kernel: "6.8.0-1036-azure", arch: "x86_64", image: "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2", imageId: "22.04.202510070" },
    cpu: { model: "Intel Xeon Platinum 8370C", vcpus: 8, cores: 4, threadsPerCore: 2, baseGhz: 2.8, turboGhz: 3.5, l3: "48 MiB", flags: ["avx512f", "avx512_vnni", "aes", "sha_ni", "vaes"] },
    memory: { totalGiB: 32, usedGiB: 27.1, swapGiB: 0, hugepages: "0 × 2 MiB" },
    hypervisor: { name: "Azure Hypervisor", virt: "Hyper-V based", offload: "Azure Boost (MANA NIC)", rootOfTrust: "Cerberus" },
    build: { agent: "azuremonitoragent", agentVersion: "1.33.2", config: "dcr-orders-prod-linux", buildId: "bld-2026.10.09-a41f", collectors: ["perf", "syslog", "dcr-custom-logs", "prometheus"] },
    usage: { cpu: 72, memory: 85, disk: 67, load: [6.81, 6.42, 5.9], netIn: "1.2 Gb/s", netOut: "640 Mb/s" },
    disks: [
      { device: "/dev/sda1", mount: "/", type: "Premium SSD v2", sizeGiB: 64, usedPct: 67, fs: "ext4" },
      { device: "/dev/nvme0n1", mount: "/mnt", type: "Local temp NVMe", sizeGiB: 300, usedPct: 21, fs: "ext4" },
      { device: "/dev/sdc", mount: "/data", type: "Premium SSD", sizeGiB: 1024, usedPct: 72, fs: "xfs" },
    ],
    nics: [{ name: "eth0", mac: "60:45:bd:7a:19:c3", ipv4: "10.1.4.23", speed: "12.5 Gb/s", driver: "mana 6.8" }],
    metadata: [
      ["compute.vmId", "5f2c8e0a-7b14-4d9e-a3c6-1e8d0b92f471"],
      ["compute.vmSize", "Standard_D8ds_v5"],
      ["compute.location", "eastus2"],
      ["compute.zone", "2"],
      ["compute.resourceGroupName", "rg-orders-prod"],
      ["compute.subscriptionId", "8c0e4b6f-2d51-4a77-9e1f-3b6c0d2a9e15"],
      ["compute.storageProfile.imageReference", "Canonical / 0001-com-ubuntu-server-jammy / 22_04-lts-gen2"],
      ["compute.securityProfile.secureBootEnabled", "true"],
      ["compute.securityProfile.virtualTpmEnabled", "true"],
      ["network.interface[0].ipv4.privateIpAddress", "10.1.4.23"],
      ["IMDS", "api-version=2025-04-07, Metadata: true"],
    ],
    spec: { drives: 4, fans: 5, cards: ["boost"], power: "single", status: "warn" },
    family: { name: "Ddsv5", largest: "Standard_D96ds_v5", vcpus: 96 },
    alerts: [
      { level: "warning", title: "Memory above 80%", detail: "85% used (27.1 of 32 GiB) for the last 26 min. Threshold 80% for 10 min.", since: "20:27 UTC" },
      { level: "warning", title: "Load above vCPU count", detail: "1-minute load 6.81 on 8 vCPU, CPU 72%. Threshold 0.75 × vCPU.", since: "20:39 UTC" },
    ],
    events: [
      { at: "2026-10-25 20:39", kind: "warning", text: "Alert opened: load above vCPU count" },
      { at: "2026-10-25 20:27", kind: "warning", text: "Alert opened: memory above 80%" },
      { at: "2026-10-25 20:05", kind: "change", text: "orders-worker deployed v4.18.2 (replicas 6 → 9)" },
      { at: "2026-10-13 01:04", kind: "info", text: "VM redeployed after host maintenance (Freeze event)" },
    ],
    parts: {
      ...commonParts("Xeon Platinum 8370C · this VM: 4 cores / 8 vCPU", "DDR4-3200 RDIMM · this VM: 32 GiB"),
      card: { name: "Azure Boost", detail: "Offloads networking (MANA) and storage from the host" },
      trust: { name: "Cerberus", detail: "Hardware root of trust for firmware" },
      power: { name: "Power supply", detail: "Single universal PSU" },
      psu0: { name: "PSU", detail: "Single universal PSU" },
      bezel: { name: "Front bezel", detail: "4 × local NVMe for the temp disk" },
    },
    sparks: { cpu: wave(2, 72, 12), memory: wave(7, 85, 3) },
  },
  {
    id: "4718263945510093827",
    provider: "gcp",
    providerName: "Google Cloud",
    hostname: "search-indexer-7.us-central1-a.c.acme-search.internal",
    health: "healthy",
    instanceType: "c3-standard-8",
    region: "us-central1",
    zone: "us-central1-a",
    uptime: "3d 2h 05m",
    bootedAt: "2026-10-22 18:46 UTC",
    lastSeen: "5s ago",
    tags: { env: "prod", team: "search", service: "indexer", "goog-ops-agent-policy": "v2" },
    os: { name: "Debian GNU/Linux", version: "12 (bookworm)", kernel: "6.1.0-40-cloud-amd64", arch: "x86_64", image: "debian-12-bookworm-v20251014", imageId: "projects/debian-cloud/global/images/debian-12-bookworm-v20251014" },
    cpu: { model: "Intel Xeon Platinum 8481C", vcpus: 8, cores: 4, threadsPerCore: 2, baseGhz: 2.7, turboGhz: 3.3, l3: "105 MiB", flags: ["avx512f", "amx_tile", "amx_int8", "aes", "sha_ni"] },
    memory: { totalGiB: 32, usedGiB: 14.2, swapGiB: 0, hugepages: "512 × 2 MiB" },
    hypervisor: { name: "KVM", virt: "Google's KVM-based hypervisor", offload: "Titanium (IPU)", rootOfTrust: "Titan" },
    build: { agent: "google-cloud-ops-agent", agentVersion: "2.61.0", config: "ops-agent policy indexer-v2", buildId: "bld-2026.10.20-0bd3", collectors: ["hostmetrics", "syslog", "nvme", "prometheus"] },
    usage: { cpu: 31, memory: 44, disk: 52, load: [2.11, 2.34, 2.5], netIn: "2.8 Gb/s", netOut: "1.1 Gb/s" },
    disks: [
      { device: "/dev/nvme0n1p1", mount: "/", type: "Hyperdisk Balanced", sizeGiB: 100, usedPct: 52, fs: "ext4" },
      { device: "/dev/nvme1n1", mount: "/index", type: "Hyperdisk Throughput", sizeGiB: 2048, usedPct: 48, fs: "xfs" },
    ],
    nics: [{ name: "ens4", mac: "42:01:0a:80:00:2f", ipv4: "10.128.0.47", speed: "Up to 23 Gb/s", driver: "gve 1.4.3" }],
    metadata: [
      ["instance/id", "4718263945510093827"],
      ["instance/machine-type", "projects/482109334716/machineTypes/c3-standard-8"],
      ["instance/zone", "projects/482109334716/zones/us-central1-a"],
      ["instance/hostname", "search-indexer-7.us-central1-a.c.acme-search.internal"],
      ["instance/image", "projects/debian-cloud/global/images/debian-12-bookworm-v20251014"],
      ["instance/network-interfaces/0/ip", "10.128.0.47"],
      ["instance/scheduling/on-host-maintenance", "MIGRATE"],
      ["instance/service-accounts/default/email", "indexer@acme-search.iam.gserviceaccount.com"],
      ["project/project-id", "acme-search"],
      ["instance/attributes/enable-oslogin", "TRUE"],
      ["Metadata server", "metadata.google.internal, Metadata-Flavor: Google"],
    ],
    spec: { drives: 2, fans: 6, cards: ["ipu"], power: "busbar", status: "ok" },
    family: { name: "C3", largest: "c3-standard-176", vcpus: 176 },
    alerts: [],
    events: [
      { at: "2026-10-25 06:12", kind: "info", text: "Live migration completed (on-host-maintenance: MIGRATE), 0.4 s pause" },
      { at: "2026-10-24 22:00", kind: "info", text: "Upcoming maintenance notice received from metadata server" },
      { at: "2026-10-22 18:46", kind: "info", text: "Instance started by managed instance group indexer-mig" },
    ],
    parts: {
      ...commonParts("Xeon Platinum 8481C · this VM: 4 cores / 8 vCPU", "DDR5-4800 RDIMM · this VM: 32 GiB"),
      card: { name: "Titanium IPU", detail: "Offloads networking and Hyperdisk I/O from the host" },
      trust: { name: "Titan", detail: "Google's root-of-trust chip, verifies boot firmware" },
      power: { name: "48 V power", detail: "Bus bar clip at the rear, 48 → 12 V converter at the front, no PSU" },
      bezel: { name: "Front bezel", detail: "2 × local SSD bays" },
    },
    sparks: { cpu: wave(5, 31, 10), memory: wave(9, 44, 3) },
  },
];

export const hostById = (id: string) => HOSTS.find((host) => host.id === id);
