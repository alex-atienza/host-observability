import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Health, Provider } from "@/lib/hosts";

export const PROVIDER_COLOR: Record<Provider, string> = { aws: "#ff9900", azure: "#0078d4", gcp: "#4285f4" };
export const PROVIDER_SHORT: Record<Provider, string> = { aws: "AWS", azure: "Azure", gcp: "GCP" };

export function ProviderBadge({ provider, name }: { provider: Provider; name?: string }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="size-2 rounded-full" style={{ background: PROVIDER_COLOR[provider] }} />
      {name ?? PROVIDER_SHORT[provider]}
    </Badge>
  );
}

const HEALTH: Record<Health, string> = {
  healthy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  degraded: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  critical: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

export function HealthBadge({ health }: { health: Health }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 capitalize", HEALTH[health])}>
      <span className="size-1.5 rounded-full bg-current" />
      {health}
    </Badge>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 240;
  const h = 48;
  const step = w / (values.length - 1);
  const y = (v: number) => h - 2 - (v / 100) * (h - 4);
  const line = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-12 w-full", className)} aria-hidden="true">
      <path d={`${line}L${w} ${h}L0 ${h}Z`} className="fill-current opacity-10" />
      <path d={line} className="fill-none stroke-current" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words", mono && "font-mono text-[13px]")}>{children}</dd>
    </div>
  );
}

export function Meter({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const tone = value >= 85 ? "bg-red-500" : value >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">
          {value}%{sub ? <span className="text-muted-foreground"> · {sub}</span> : null}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function SparkScale({ values }: { values: number[] }) {
  return (
    <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground tabular-nums">
      <span>−4h</span>
      <span>
        min {Math.min(...values)}% · max {Math.max(...values)}%
      </span>
      <span>now</span>
    </div>
  );
}
