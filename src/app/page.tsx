import { FleetView } from "@/components/fleet/view";
import { FLEETS, REGIONS, type FleetSize } from "@/lib/fleet";
import "@/components/iso/iso.css";
import "@/components/fleet/fleet.css";

export default async function Fleet({ searchParams }: { searchParams: Promise<{ region?: string; fleet?: string }> }) {
  const { region, fleet } = await searchParams;
  const size: FleetSize = fleet === "500" ? "500" : "84";
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
        <p className="text-sm text-muted-foreground">Every host you run, by region. Pick one to see what&apos;s inside.</p>
      </header>
      <FleetView initialRegion={REGIONS.some((r) => r.id === region) ? region : undefined} fleets={FLEETS} initialSize={size} regions={REGIONS} />
    </main>
  );
}
