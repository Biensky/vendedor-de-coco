import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { combosQuery, loyaltyQuery, productsQuery, profileQuery } from "@/lib/data";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/app/cartaz")({
  head: () => pageMeta("Meu QR / Cartaz", "Cartaz do vendedor para imprimir e acessar o autoatendimento."),
  component: Cartaz,
});

function Cartaz() {
  const { data: p } = useQuery(profileQuery);
  const { data: loyalty } = useQuery(loyaltyQuery);
  const { data: combos = [] } = useQuery(combosQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const [size, setSize] = useState<"A4" | "A5">("A4");
  const ref = useRef<HTMLDivElement>(null);
  if (!p?.public_slug) return null;

  const url = `${window.location.origin}/v/${p.public_slug}`;
  const pn = (id: string | null) => products.find((x) => x.id === id)?.name ?? "";
  const rule = loyalty?.active && loyalty.product_id
    ? `A cada ${loyalty.required_qty} ${pn(loyalty.product_id).toLowerCase()}s, ganhe ${loyalty.reward_qty} ${pn(loyalty.reward_product_id).toLowerCase()} grátis`
    : null;
  const active = combos.filter((c) => c.active);
  const a5 = size === "A5";

  async function download() {
    if (!ref.current) return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(ref.current, { pixelRatio: 3 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `cartaz-${p!.public_slug}.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: ${size}; margin: 0; } }`}</style>
      <h1 className="text-2xl font-bold text-primary-deep">Meu QR / Cartaz</h1>
      <div className="flex items-center gap-2 rounded-2xl bg-card p-3 shadow-soft">
        <span className="flex-1 truncate text-sm font-semibold">{url}</span>
        <Button size="sm" variant="soft" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}><Copy /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={size === "A4" ? "hero" : "soft"} onClick={() => setSize("A4")}>A4</Button>
        <Button variant={size === "A5" ? "hero" : "soft"} onClick={() => setSize("A5")}>A5</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="hero" size="xl" onClick={() => window.print()}><Printer /> Imprimir</Button>
        <Button variant="sun" size="xl" onClick={download}><Download /> Baixar PNG</Button>
      </div>

      <div className="overflow-x-auto">
        <div
          ref={ref}
          className="print-area mx-auto flex aspect-[210/297] w-full max-w-[420px] flex-col items-center bg-coco p-[6%] text-center text-primary-foreground"
        >
          <p className={a5 ? "text-3xl" : "text-4xl"}>🥥</p>
          <h2 className="font-display text-[clamp(1.4rem,6vw,2.2rem)] font-bold leading-tight">{p.business_name}</h2>
          {p.display_name && <p className="text-lg font-semibold opacity-90">com {p.display_name}</p>}
          <p className="mt-[3%] font-display text-[clamp(1rem,4.5vw,1.6rem)] font-bold leading-tight">
            Cartão Fidelidade — escaneie com a câmera do celular
          </p>
          <div className="mt-[4%] rounded-3xl bg-card p-[4%]">
            <QRCodeSVG value={url} size={220} className="h-auto w-[52vw] max-w-[220px]" />
          </div>
          {rule && <p className="mt-[4%] rounded-full bg-sun px-4 py-2 text-[clamp(0.9rem,3.8vw,1.25rem)] font-extrabold text-sun-foreground">{rule}</p>}
          {active.length > 0 && (
            <div className="mt-[3%] w-full space-y-1">
              {active.slice(0, 3).map((c) => (
                <p key={c.id} className="flex justify-between gap-2 rounded-xl bg-primary-foreground/15 px-3 py-1 text-left text-sm font-bold">
                  <span>{c.name}</span><span>{brl(c.price)}</span>
                </p>
              ))}
            </div>
          )}
          <ol className="mt-auto grid w-full grid-cols-3 gap-2 pt-[3%] text-xs font-bold">
            {["Escaneie", "Cadastre nome e WhatsApp", "Registre sua compra ou retire seu crédito"].map((t, i) => (
              <li key={i} className="rounded-xl bg-card p-2 text-foreground">
                <span className="block font-display text-2xl text-primary">{i + 1}</span>{t}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
