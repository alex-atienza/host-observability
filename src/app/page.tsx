import { FleetView } from "@/components/fleet/view";
import { FLEETS, REGIONS } from "@/lib/fleet";
import "@/components/iso/iso.css";
import "@/components/fleet/fleet.css";

// Static, so it can be exported: ?fleet= and ?region= are read in the browser by FleetView.
export default function Fleet() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
        <p className="text-sm text-muted-foreground">Every host you run, by region. Pick one to see what&apos;s inside.</p>
      </header>
      <FleetView fleets={FLEETS} regions={REGIONS} />
    </main>
  );
}
