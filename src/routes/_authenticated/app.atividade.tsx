import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Undo2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery } from "@/lib/data";
import { brl, dateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/atividade")({
  head: () => ({ meta: [
    { title: "Atividade e proteção — Cocó do Parque" },
    { name: "description", content: "Compras, retiradas e tentativas inválidas no autoatendimento." },
    { property: "og:title", content: "Atividade e proteção — Cocó do Parque" },
    { property: "og:description", content: "Acompanhe as ações dos clientes e alertas de acesso." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Atividade,
});

type Line = { product_id: string; qty: number; kind: string };

function Atividade() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(productsQuery);
  const pn = (id: string | null) => products.find((p) => p.id === id)?.name ?? "Produto";

  const { data = [] } = useQuery({
    queryKey: ["self-activity"],
    queryFn: async () => {
      const [s, d, e] = await Promise.all([
        supabase.from("sales").select("id,created_at,total,take_now,meta,customers(name)").eq("origin", "autoatendimento").order("created_at", { ascending: false }).limit(50),
        supabase.from("deliveries").select("id,created_at,qty,product_id,kind,customers(name)").eq("origin", "autoatendimento").is("sale_id", null).order("created_at", { ascending: false }).limit(50),
        supabase.from("self_security_events").select("id,created_at,customer_name,blocked_until").order("created_at", { ascending: false }).limit(50),
      ]);
      if (s.error || d.error || e.error) throw s.error ?? d.error ?? e.error;
      const rows = [
        ...(s.data ?? []).map((x) => ({
          id: x.id, type: "sale" as const, at: x.created_at, who: x.customers?.name ?? "Cliente",
          text: `Compra ${brl(x.total)} · ${x.take_now ? "levou" : "crédito"}`,
          lines: ((x.meta as { lines?: Line[] })?.lines ?? []),
        })),
        ...(d.data ?? []).map((x) => ({
          id: x.id, type: "delivery" as const, at: x.created_at, who: x.customers?.name ?? "Cliente",
          text: "Retirada de crédito", lines: [{ product_id: x.product_id ?? "", qty: x.qty, kind: x.kind }],
        })),
        ...(e.data ?? []).map((x) => ({ id: x.id, type: "security" as const, at: x.created_at, who: x.customer_name, text: `Tentativas inválidas no cartão de ${x.customer_name}`, lines: [] as Line[] })),
      ];
      return rows.sort((a, b) => b.at.localeCompare(a.at));
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => qc.invalidateQueries({ queryKey: ["self-activity"] }), 10000);
    return () => window.clearInterval(timer);
  }, [qc]);

  useEffect(() => {
    const ch = supabase
      .channel(`self-activity-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => qc.invalidateQueries({ queryKey: ["self-activity"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => qc.invalidateQueries({ queryKey: ["self-activity"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function undo(r: (typeof data)[number]) {
    if (r.type === "security") return;
    if (!confirm("Desfazer esta ação? Selos, brindes e créditos serão estornados.")) return;
    const { error } = r.type === "sale"
      ? await supabase.rpc("undo_sale", { _sale_id: r.id })
      : await supabase.rpc("undo_delivery", { _delivery_id: r.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Desfeito");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="size-3 animate-pulse rounded-full bg-primary" />
        <h1 className="text-2xl font-bold text-primary-deep">Atividade em tempo real</h1>
      </div>
      <p className="text-muted-foreground">Compras e retiradas feitas pelos clientes no seu QR.</p>
      {data.length === 0 && <p className="text-center text-muted-foreground">Nenhuma ação de autoatendimento ainda.</p>}
      {data.map((r) => (
        <div key={r.id} className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold">{r.who}</p>
              <p className={r.type === "sale" ? "font-semibold text-primary" : "font-semibold text-sun-foreground"}>{r.text}</p>
              <p className="text-sm">{r.lines.map((l) => `${l.qty}× ${pn(l.product_id)}${l.kind === "brinde" ? " (brinde)" : ""}`).join(", ")}</p>
              <p className="text-sm text-muted-foreground">{dateTime(r.at)}</p>
            </div>
            {r.type === "security" ? <ShieldAlert className="size-6 shrink-0 text-destructive" aria-label="Alerta de proteção" /> : <Button variant="soft" size="sm" onClick={() => undo(r)}><Undo2 /> Desfazer</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}
