import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShoppingCart, PackageCheck, History, MessageCircle, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loyaltyQuery, productsQuery } from "@/lib/data";
import { brl, cardUrl, dateTime, saveCardWhatsApp } from "@/lib/format";
import { CardCode } from "@/components/CardCode";
import { StampCard } from "@/components/StampCard";
import { SaleForm } from "@/components/SaleForm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/app/cliente/$id")({
  head: () => ({ meta: [
    { title: "Ficha do cliente — Cocó do Parque" },
    { name: "description", content: "Vendas, créditos e reenvio do cartão do cliente." },
    { property: "og:title", content: "Ficha do cliente — Cocó do Parque" },
    { property: "og:description", content: "Consulte o cartão e as movimentações do cliente." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ClientePage,
});

function ClientePage() {
  const { id } = Route.useParams();
  const [sheet, setSheet] = useState<null | "venda" | "entregar" | "historico">(null);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: loyalty } = useQuery(loyaltyQuery);
  const { data: c } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await supabase.from("customers").select("*").eq("id", id).single()).data,
  });
  const { data: credits = [] } = useQuery({
    queryKey: ["credits", id],
    queryFn: async () => (await supabase.from("credits").select("*").eq("customer_id", id).gt("qty", 0)).data ?? [],
  });

  if (!c) return <p className="text-center text-muted-foreground">Carregando...</p>;
  const pname = (pid: string) => products.find((p) => p.id === pid)?.name ?? "Produto";
  const url = cardUrl(c.code);
  const wa = c.whatsapp
    ? saveCardWhatsApp(c.whatsapp, c.code, c.name)
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary-deep">{c.name}</h1>
            <p className="text-muted-foreground">{c.whatsapp || "sem WhatsApp"}</p>
            {c.notes && <p className="mt-1 text-sm">{c.notes}</p>}
            <div className="mt-3"><CardCode code={c.code} /></div>
          </div>
          <QRCodeSVG value={url} size={84} />
        </div>
        {loyalty?.active && <div className="mt-4"><StampCard stamps={c.stamps} required={loyalty.required_qty} /></div>}
      </div>

      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold">Créditos a retirar</h2>
        {credits.length === 0 ? (
          <p className="text-muted-foreground">Nenhum.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {credits.map((cr) => (
              <li key={cr.id} className="flex justify-between text-lg font-bold">
                <span>{pname(cr.product_id)} {cr.kind === "brinde" && <span className="text-sm text-primary">brinde</span>}</span>
                <span>{cr.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3">
        <Button variant="hero" size="xl" onClick={() => setSheet("venda")}><ShoppingCart /> Registrar venda</Button>
        <Button variant="sun" size="xl" disabled={credits.length === 0} onClick={() => setSheet("entregar")}><PackageCheck /> Entregar crédito</Button>
        <Button variant="soft" size="xl" onClick={() => setSheet("historico")}><History /> Histórico</Button>
        {wa && (
          <Button asChild variant="soft" size="xl">
            <a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> Reenviar cartão por WhatsApp</a>
          </Button>
        )}
      </div>

      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{sheet === "venda" ? "Registrar venda" : sheet === "entregar" ? "Entregar crédito" : "Histórico"}</SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            {sheet === "venda" && <SaleForm customerId={id} onDone={() => setSheet(null)} />}
            {sheet === "entregar" && <DeliverForm customerId={id} credits={credits} pname={pname} onDone={() => setSheet(null)} />}
            {sheet === "historico" && <HistoryList customerId={id} pname={pname} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

type Credit = { id: string; product_id: string; kind: string; qty: number };

function DeliverForm({ customerId, credits, pname, onDone }: { customerId: string; credits: Credit[]; pname: (id: string) => string; onDone: () => void }) {
  const [sel, setSel] = useState<Record<string, number>>({});
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    for (const cr of credits) {
      const q = sel[cr.id] ?? 0;
      if (q > 0) {
        const { error } = await supabase.rpc("deliver_credit", { _customer_id: customerId, _product_id: cr.product_id, _kind: cr.kind, _qty: q });
        if (error) { setSaving(false); { toast.error(error.message); return; } }
      }
    }
    setSaving(false);
    toast.success("Entrega registrada!");
    qc.invalidateQueries();
    onDone();
  }

  return (
    <div className="space-y-3">
      {credits.map((cr) => (
        <div key={cr.id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
          <div>
            <p className="font-bold">{pname(cr.product_id)} {cr.kind === "brinde" && <span className="text-sm text-primary">brinde</span>}</p>
            <p className="text-sm text-muted-foreground">Disponível: {cr.qty}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button size="icon" variant="soft" onClick={() => setSel((s) => ({ ...s, [cr.id]: Math.max(0, (s[cr.id] ?? 0) - 1) }))}><Minus /></Button>
            <span className="w-6 text-center font-display text-2xl font-bold">{sel[cr.id] ?? 0}</span>
            <Button size="icon" variant="hero" onClick={() => setSel((s) => ({ ...s, [cr.id]: Math.min(cr.qty, (s[cr.id] ?? 0) + 1) }))}><Plus /></Button>
          </div>
        </div>
      ))}
      <Button variant="hero" size="xl" className="w-full" disabled={saving || Object.values(sel).every((v) => !v)} onClick={submit}>Entregar</Button>
    </div>
  );
}

function HistoryList({ customerId, pname }: { customerId: string; pname: (id: string) => string }) {
  const { data = [] } = useQuery({
    queryKey: ["history", customerId],
    queryFn: async () => {
      const [s, d] = await Promise.all([
        supabase.from("sales").select("id,created_at,total,payment,take_now").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50),
        supabase.from("deliveries").select("id,created_at,qty,product_id,kind").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50),
      ]);
      const rows = [
        ...(s.data ?? []).map((x) => ({ id: x.id, at: x.created_at, text: `Compra ${brl(x.total)} · ${x.payment}${x.take_now ? "" : " · crédito"}` })),
        ...(d.data ?? []).map((x) => ({ id: x.id, at: x.created_at, text: `Retirou ${x.qty} ${pname(x.product_id ?? "")}${x.kind === "brinde" ? " (brinde)" : ""}` })),
      ];
      return rows.sort((a, b) => b.at.localeCompare(a.at));
    },
  });
  return (
    <ul className="divide-y divide-border">
      {data.map((r) => (
        <li key={r.id} className="flex justify-between gap-2 py-3">
          <span className="font-semibold">{r.text}</span>
          <span className="shrink-0 text-sm text-muted-foreground">{dateTime(r.at)}</span>
        </li>
      ))}
      {data.length === 0 && <p className="text-muted-foreground">Sem movimentações.</p>}
    </ul>
  );
}
