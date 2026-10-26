import { BladeFigure } from "@/components/blade/figure";
import { HOSTS } from "@/lib/hosts";

export default function Figures() {
  return (
    <main className="mx-auto grid max-w-3xl gap-10 p-8">
      {HOSTS.map((host, index) => (
        <BladeFigure key={host.id} host={host} fig={`Fig ${index + 1}`} />
      ))}
    </main>
  );
}
