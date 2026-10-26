import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, CircleAlert, Info, GitCommitHorizontal, TriangleAlert } from "lucide-react";
import { CopyButton } from "@/components/host/copy-button";
import { PartLink } from "@/components/host/part-link";
import { BladeFigure } from "@/components/blade/figure";
import { Field, HealthBadge, Meter, PROVIDER_SHORT, ProviderBadge, SparkScale, Sparkline } from "@/components/host/bits";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { HOSTS } from "@/lib/hosts";
import { FLEET, hostRecord } from "@/lib/fleet";

export function generateStaticParams() {
  return FLEET.map((host) => ({ id: host.id }));
}

const ENDPOINT = {
  aws: "http://169.254.169.254/latest/meta-data/",
  azure: "http://169.254.169.254/metadata/instance",
  gcp: "http://metadata.google.internal/computeMetadata/v1/",
} as const;

export default async function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = hostRecord(id);
  if (!host) notFound();
  const memPct = Math.round((host.memory.usedGiB / host.memory.totalGiB) * 100);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      {/* Breadcrumb and provider switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Fleet</Link>
          <ChevronRight className="size-4" />
          <Link href={`/?region=${host.region}`} className="font-mono hover:text-foreground">{host.region}</Link>
          <ChevronRight className="size-4" />
          <span className="truncate font-mono text-foreground">{host.hostname}</span>
        </nav>
        <div className="inline-flex rounded-lg border p-0.5">
          {HOSTS.map((other) => (
            <Link
              key={other.id}
              href={`/hosts/${other.id}`}
              className={cn("rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground", other.id === host.id && "bg-muted text-foreground")}
            >
              {PROVIDER_SHORT[other.provider]}
            </Link>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ProviderBadge provider={host.provider} name={host.providerName} />
          <HealthBadge health={host.health} />
          <Badge variant="secondary" className="font-mono">{host.instanceType}</Badge>
          <Badge variant="secondary">{host.region} · {host.zone}</Badge>
        </div>
        <div className="flex items-start gap-1">
          <h1 className="break-all font-mono text-2xl font-semibold tracking-tight">{host.hostname}</h1>
          <CopyButton value={host.hostname} label="hostname" className="mt-1" />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">ID <span className="font-mono text-foreground">{host.id}</span><CopyButton value={host.id} label="instance ID" /></span>
          <span>Up <span className="text-foreground">{host.uptime}</span></span>
          <span>Booted <span className="text-foreground">{host.bootedAt}</span></span>
          <span>Last seen <span className="text-foreground">{host.lastSeen}</span></span>
        </div>
      </header>

      {host.alerts.length ? (
        <div className="grid gap-2 md:grid-cols-2">
          {host.alerts.map((alert) => (
            <div key={alert.title} className={cn("flex gap-3 rounded-xl border p-3 text-sm", alert.level === "critical" ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10")}>
              <TriangleAlert className={cn("mt-0.5 size-4 shrink-0", alert.level === "critical" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
              <div className="min-w-0">
                <div className="font-medium">
                  {alert.title} <span className="font-normal text-muted-foreground">· since {alert.since}</span>
                </div>
                <div className="text-muted-foreground">{alert.detail}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Figure and live usage */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <BladeFigure host={host} fig="Host" />
        <Card>
          <CardHeader>
            <CardTitle>Right now</CardTitle>
            <CardDescription>Last 4 hours, 5-minute resolution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Meter label="CPU" value={host.usage.cpu} sub={`${host.cpu.vcpus} vCPU`} />
              <Sparkline values={host.sparks.cpu} className="mt-2 text-emerald-600 dark:text-emerald-400" />
              <SparkScale values={host.sparks.cpu} />
            </div>
            <div>
              <Meter label="Memory" value={memPct} sub={`${host.memory.usedGiB} / ${host.memory.totalGiB} GiB`} />
              <Sparkline values={host.sparks.memory} className="mt-2 text-sky-600 dark:text-sky-400" />
              <SparkScale values={host.sparks.memory} />
            </div>
            <Meter label="Disk /" value={host.usage.disk} />
            <Separator />
            <div className="grid grid-cols-3 gap-2 text-center">
              {(["1m", "5m", "15m"] as const).map((label, i) => (
                <div key={label} className="rounded-md bg-muted/50 py-2">
                  <div className="font-mono text-lg tabular-nums">{host.usage.load[i]!.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">load {label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground">Net in</div>
                <div className="font-mono">{host.usage.netIn}</div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-xs text-muted-foreground">Net out</div>
                <div className="font-mono">{host.usage.netOut}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full justify-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metadata">Cloud metadata</TabsTrigger>
          <TabsTrigger value="storage">Storage &amp; network</TabsTrigger>
          <TabsTrigger value="agent">Agent &amp; build</TabsTrigger>
          <TabsTrigger value="events">Events{host.alerts.length ? <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px] text-amber-600 dark:text-amber-400">{host.alerts.length}</Badge> : null}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Operating system</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <Field label="Distribution">{host.os.name} {host.os.version}</Field>
                <Field label="Kernel" mono>{host.os.kernel}</Field>
                <Field label="Architecture" mono>{host.os.arch}</Field>
                <Field label="Image" mono>{host.os.image}</Field>
                <Field label="Image ID" mono>{host.os.imageId}</Field>
              </dl>
            </CardContent>
          </Card>
          <PartLink part="cpu">
          <Card className="h-full">
            <CardHeader><CardTitle>CPU</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <Field label="Model">{host.cpu.model}</Field>
                <Field label="vCPUs">{host.cpu.vcpus} ({host.cpu.cores} cores × {host.cpu.threadsPerCore} threads)</Field>
                <Field label="Clock">{host.cpu.baseGhz} GHz base · {host.cpu.turboGhz} GHz turbo</Field>
                <Field label="L3 cache">{host.cpu.l3} (shared, host)</Field>
                <Field label="Flags">
                  <div className="flex flex-wrap gap-1">
                    {host.cpu.flags.map((flag) => (
                      <Badge key={flag} variant="secondary" className="font-mono text-[11px]">{flag}</Badge>
                    ))}
                  </div>
                </Field>
              </dl>
            </CardContent>
          </Card>
          </PartLink>
          <PartLink part="mem">
          <Card className="h-full">
            <CardHeader><CardTitle>Memory</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <Field label="Total">{host.memory.totalGiB} GiB</Field>
                <Field label="Used">{host.memory.usedGiB} GiB ({memPct}%)</Field>
                <Field label="Swap">{host.memory.swapGiB ? `${host.memory.swapGiB} GiB` : "none"}</Field>
                <Field label="Huge pages" mono>{host.memory.hugepages}</Field>
              </dl>
            </CardContent>
          </Card>
          </PartLink>
          <Card>
            <CardHeader><CardTitle>Virtualization</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <Field label="Hypervisor">{host.hypervisor.name}</Field>
                <Field label="Type">{host.hypervisor.virt}</Field>
                <PartLink part="card" className="-mx-2 rounded-md px-2"><Field label="I/O offload">{host.hypervisor.offload}</Field></PartLink>
                <PartLink part="trust" className="-mx-2 rounded-md px-2"><Field label="Root of trust">{host.hypervisor.rootOfTrust}</Field></PartLink>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Placement</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <Field label="Provider">{host.providerName}</Field>
                <Field label="Region" mono>{host.region}</Field>
                <Field label="Zone" mono>{host.zone}</Field>
                <Field label="Instance type" mono>{host.instanceType}</Field>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {Object.entries(host.tags).map(([key, value]) => (
                <Badge key={key} variant="outline" className="font-mono text-[11px] font-normal">
                  <span className="text-muted-foreground">{key}:</span>
                  {value}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metadata" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Instance metadata</CardTitle>
              <CardDescription className="font-mono">{ENDPOINT[host.provider]}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%]">Key</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {host.metadata.map(([key, value]) => (
                    <TableRow key={key} className="group/row">
                      <TableCell className="font-mono text-[13px] text-muted-foreground">{key}</TableCell>
                      <TableCell className="whitespace-normal break-all font-mono text-[13px]">
                        <span className="inline-flex items-start gap-1">
                          {value}
                          <CopyButton value={value} label={key} className="-my-0.5 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100" />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-4 grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Disks</CardTitle>
              <CardDescription>Network volumes reach the VM through the {host.hypervisor.offload.split(" (")[0]}; point at a row to see where.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Mount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>FS</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="w-48">Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {host.disks.map((disk) => (
                    <PartLink as="tr" key={disk.device} part={disk.type.startsWith("Local") ? "drives" : "card"}>
                      <TableCell className="font-mono text-[13px]">{disk.device}</TableCell>
                      <TableCell className="font-mono text-[13px]">{disk.mount}</TableCell>
                      <TableCell>{disk.type}</TableCell>
                      <TableCell className="font-mono text-[13px]">{disk.fs}</TableCell>
                      <TableCell className="text-right tabular-nums">{disk.sizeGiB} GiB</TableCell>
                      <TableCell><Meter label="" value={disk.usedPct} /></TableCell>
                    </PartLink>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Network interfaces</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>IPv4</TableHead>
                    <TableHead>MAC</TableHead>
                    <TableHead>Bandwidth</TableHead>
                    <TableHead>Driver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {host.nics.map((nic) => (
                    <PartLink as="tr" key={nic.name} part="card">
                      <TableCell className="font-mono text-[13px]">{nic.name}</TableCell>
                      <TableCell className="font-mono text-[13px]">{nic.ipv4}</TableCell>
                      <TableCell className="font-mono text-[13px]">{nic.mac}</TableCell>
                      <TableCell>{nic.speed}</TableCell>
                      <TableCell className="font-mono text-[13px]">{nic.driver}</TableCell>
                    </PartLink>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Agent</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <Field label="Agent" mono>{host.build.agent}</Field>
                <Field label="Version" mono>{host.build.agentVersion}</Field>
                <Field label="Config" mono>{host.build.config}</Field>
                <Field label="Receivers">
                  <div className="flex flex-wrap gap-1">
                    {host.build.collectors.map((c) => (
                      <Badge key={c} variant="secondary" className="font-mono text-[11px]">{c}</Badge>
                    ))}
                  </div>
                </Field>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Host build</CardTitle></CardHeader>
            <CardContent>
              <dl>
                <Field label="Build ID" mono>{host.build.buildId}</Field>
                <Field label="Base image" mono>{host.os.image}</Field>
                <Field label="Kernel" mono>{host.os.kernel}</Field>
                <Field label="Booted">{host.bootedAt}</Field>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>Alerts, changes and provider notices for this host</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {host.events.map((event) => {
                  const Icon = event.kind === "warning" ? CircleAlert : event.kind === "change" ? GitCommitHorizontal : Info;
                  return (
                    <li key={event.at + event.text} className="relative">
                      <span className="absolute -left-[29px] top-0.5 flex size-4 items-center justify-center rounded-full bg-card">
                        <Icon className={cn("size-4", event.kind === "warning" ? "text-amber-600 dark:text-amber-400" : event.kind === "change" ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")} />
                      </span>
                      <div className="text-sm">{event.text}</div>
                      <div className="font-mono text-xs text-muted-foreground">{event.at} UTC</div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
