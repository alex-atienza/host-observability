import { IsoFigure, Plate } from "@/components/iso/react/draw";
import type { Host } from "@/lib/hosts";
import { PROVIDER_SHORT } from "@/components/host/bits";
import { bladeArt } from "./art";
import { HEIGHT, WIDTH } from "./geometry";
import { BladeLive } from "./live";
import "@/components/iso/iso.css";
import "./blade.css";

const TOUR = ["card", "trust", "cpu", "mem", "fans", "bezel", "power"];

export function BladeFigure({ host, fig = "Fig 1" }: { host: Host; fig?: string }) {
  const { art, fans, projection } = bladeArt(host.spec);
  const rest = `${host.instanceType} · ${host.cpu.vcpus} vCPU · ${host.memory.totalGiB} GiB`;
  const tour = TOUR.filter((part) => host.parts[part]);
  const share = Math.round((host.cpu.vcpus / host.family.vcpus) * 1000) / 10;
  return (
    <div className="iso blade-host">
      <Plate
        fig={fig === "Host" ? `${PROVIDER_SHORT[host.provider]} host` : fig}
        title={host.hypervisor.offload}
        hint="Point at a part · ← →"
        readout={rest}
        keys={[
          { mark: "lit", label: `${host.hypervisor.offload.split(" (")[0]}: where the cloud lives` },
          host.spec.status === "ok" ? { mark: "green", label: "Health LED" } : { mark: "dim", label: "Health LED, amber while degraded" },
        ]}
        caption={`A representative ${host.cpu.model.replace("Intel ", "")} host. Your VM gets ${host.cpu.vcpus} of the ${host.family.vcpus} vCPUs that ${host.family.largest}, the largest ${host.family.name} size, takes on one host (${share}%). Exact hardware is not published.`}
      >
        <IsoFigure width={WIDTH} height={HEIGHT} label={`A representative ${host.providerName} 1U host with its lid off, showing CPU sockets, memory, fans, power and the ${host.hypervisor.offload} offload card.`} className="blade">
          <BladeLive art={art} fans={fans} projection={projection} parts={host.parts} rest={rest} tour={tour} health={host.health} />
        </IsoFigure>
      </Plate>
    </div>
  );
}
