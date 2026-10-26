import { FleetView } from "@/components/fleet/view";
import { FLEET, REGIONS } from "@/lib/fleet";
import "@/components/iso/iso.css";
import "@/components/fleet/fleet.css";

export default async function Fleet({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region } = await searchParams;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
        <p className="text-sm text-muted-foreground">Every host you run, by region. Pick one to see what&apos;s inside.</p>
      </header>
      <FleetView initialRegion={REGIONS.some((r) => r.id === region) ? region : undefined} hosts={FLEET} regions={REGIONS} />
    </main>
  );
}
