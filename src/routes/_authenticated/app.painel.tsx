import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loyaltyQuery, productsQuery, profileQuery } from "@/lib/data";
import { brl } from "@/lib/format";
import { grossProfit, periodStart, simulate, type Period } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { teamQuery } from "@/components/Equipe";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/app/painel")({
  head: () => pageMeta("Painel financeiro", "Receita, custos, lucro e vendas da equipe."),
  component: Painel,
});

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-2xl bg-coco p-4 text-primary-foreground shadow-soft" : "rounded-2xl bg-card p-4 shadow-soft"}>
      <p className="text-sm font-semibold opacity-80">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function Painel() {
  const [period, setPeriod] = useState<Period>("hoje");
  const [origin, setOrigin] = useState<"todas" | "vendedor" | "autoatendimento">("todas");
  const { data: products = [] } = useQuery(productsQuery);
  const pname = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  const { data: team = [] } = useQuery(teamQuery);
  const memberName = (id: string) => { const m = team.find((t) => t.id === id); return m?.display_name || m?.email || "Vendedor"; };

  const { data } = useQuery({
    queryKey: ["painel", period, origin],
    queryFn: async () => {
      const start = periodStart(period).toISOString();
      let sq = supabase.from("sales").select("id,vendor_id,customer_id,total,cost,created_at,origin").gte("created_at", start).limit(5000);
      let dq = supabase.from("deliveries").select("customer_id,kind,qty,unit_cost,origin").gte("created_at", start).limit(10000);
      if (origin !== "todas") { sq = sq.eq("origin", origin); dq = dq.eq("origin", origin); }
      const [sales, items, deliveries, credits] = await Promise.all([
        sq,
        supabase.from("sale_items").select("sale_id,product_id,qty,is_reward").gte("created_at", start).limit(10000),
        dq,
        supabase.from("credits").select("product_id,qty").gt("qty", 0).limit(10000),
      ]);
      const s = sales.data ?? [];
      const saleIds = new Set(s.map((x) => x.id));
      const revenue = s.reduce((a, x) => a + Number(x.total), 0);
      const cost = s.reduce((a, x) => a + Number(x.cost), 0);
      const rewardsCost = (deliveries.data ?? []).filter((d) => d.kind === "brinde").reduce((a, d) => a + d.qty * Number(d.unit_cost), 0);
      const byProduct: Record<string, number> = {};
      for (const it of items.data ?? []) if (saleIds.has(it.sale_id) && !it.is_reward && it.product_id) byProduct[it.product_id] = (byProduct[it.product_id] ?? 0) + it.qty;
      const pending: Record<string, number> = {};
      for (const c of credits.data ?? []) pending[c.product_id] = (pending[c.product_id] ?? 0) + c.qty;
      const selfCount = s.filter((x) => x.origin === "autoatendimento").length;

      const ids = new Set<string>();
      s.forEach((x) => x.customer_id && ids.add(x.customer_id));
      (deliveries.data ?? []).forEach((x) => x.customer_id && ids.add(x.customer_id));
      let returning = 0;
      if (ids.size) {
        const { data: before } = await supabase.from("sales").select("customer_id").in("customer_id", [...ids]).lt("created_at", start).limit(10000);
        const prev = new Set((before ?? []).map((b) => b.customer_id));
        const counts: Record<string, number> = {};
        s.forEach((x) => x.customer_id && (counts[x.customer_id] = (counts[x.customer_id] ?? 0) + 1));
        returning = [...ids].filter((id) => prev.has(id) || (counts[id] ?? 0) > 1).length;
      }
      const rank: Record<string, { total: number; n: number }> = {};
      for (const x of s) { const r = (rank[x.vendor_id] ??= { total: 0, n: 0 }); r.total += Number(x.total); r.n += 1; }
      const ranking = Object.entries(rank).sort((a, b) => b[1].total - a[1].total);
      return { revenue, cost, rewardsCost, byProduct, pending, attended: ids.size, returning, count: s.length, ranking, selfCount };
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary-deep">Painel</h1>
      <div className="grid grid-cols-3 gap-2">
        {(["hoje", "semana", "mes"] as const).map((p) => (
          <Button key={p} variant={period === p ? "hero" : "soft"} size="lg" onClick={() => setPeriod(p)}>
            {p === "hoje" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["todas", "vendedor", "autoatendimento"] as const).map((o) => (
          <Button key={o} size="sm" variant={origin === o ? "sun" : "soft"} onClick={() => setOrigin(o)}>
            {o === "todas" ? "Todas" : o === "vendedor" ? "Vendedor" : "Autoatend."}
          </Button>
        ))}
      </div>
      {data && origin === "todas" && data.selfCount > 0 && (
        <p className="text-center text-sm text-muted-foreground">{data.selfCount} de {data.count} vendas foram por autoatendimento</p>
      )}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Receita" value={brl(data.revenue)} />
            <Stat label="Custo" value={brl(data.cost)} />
            <Stat label="Custo brindes" value={brl(data.rewardsCost)} />
            <Stat label="Lucro bruto" value={brl(grossProfit(data.revenue, data.cost, data.rewardsCost))} strong />
            <Stat label="Clientes atendidos" value={String(data.attended)} />
            <Stat label="Voltaram" value={String(data.returning)} />
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-soft">
            <h2 className="font-semibold">Ranking de vendedores</h2>
            {data.ranking.length === 0 && <p className="text-muted-foreground">Nenhuma venda no período.</p>}
            {data.ranking.map(([vid, r], i) => (
              <p key={vid} className="flex justify-between font-bold"><span>{i + 1}º {memberName(vid)} <span className="text-sm font-normal text-muted-foreground">({r.n} vendas)</span></span><span>{brl(r.total)}</span></p>
            ))}
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-soft">
            <h2 className="font-semibold">Vendido por produto ({data.count} vendas)</h2>
            {Object.keys(data.byProduct).length === 0 && <p className="text-muted-foreground">Nada ainda.</p>}
            {Object.entries(data.byProduct).map(([id, q]) => (
              <p key={id} className="flex justify-between font-bold"><span>{pname(id)}</span><span>{q}</span></p>
            ))}
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-soft">
            <h2 className="font-semibold">Créditos pendentes de retirada</h2>
            {Object.keys(data.pending).length === 0 && <p className="text-muted-foreground">Nenhum.</p>}
            {Object.entries(data.pending).map(([id, q]) => (
              <p key={id} className="flex justify-between font-bold"><span>{pname(id)}</span><span>{q}</span></p>
            ))}
          </div>
        </>
      )}
      <Simulacao />
    </div>
  );
}

function Simulacao() {
  const { data: products = [] } = useQuery(productsQuery);
  const { data: loyalty } = useQuery(loyaltyQuery);
  const { data: profile } = useQuery(profileQuery);
  const qc = useQueryClient();
  const [goal, setGoal] = useState(10);
  useEffect(() => { if (profile) setGoal(profile.daily_goal); }, [profile]);

  const product = products.find((p) => p.id === loyalty?.product_id) ?? products.find((p) => /coco/i.test(p.name)) ?? products[0];
  const reward = products.find((p) => p.id === loyalty?.reward_product_id);
  if (!product) return null;
  const sim = simulate({
    goalPerDay: goal,
    price: product.price,
    cost: product.cost ?? 0,
    loyaltyRequired: loyalty?.active ? loyalty.required_qty : undefined,
    rewardQty: loyalty?.reward_qty ?? 0,
    rewardCost: reward?.cost ?? 0,
  });

  async function saveGoal(v: number) {
    setGoal(v);
    if (profile) {
      await supabase.from("profiles").update({ daily_goal: v }).eq("id", profile.id);
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  }

  return (
    <div className="rounded-2xl border-2 border-sun bg-card p-4 shadow-soft">
      <h2 className="text-lg font-semibold">Simulação</h2>
      <label className="mt-2 flex items-center justify-between gap-3 font-semibold">
        Meta de {product.name.toLowerCase()}s/dia
        <Input type="number" min={0} className="h-12 w-24 text-center text-lg" value={goal} onChange={(e) => saveGoal(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Lucro diário" value={brl(sim.daily)} />
        <Stat label="Lucro mensal (26 dias)" value={brl(sim.monthly)} strong />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {brl(product.price)} venda − {brl(product.cost ?? 0)} custo por unidade{sim.rewardsCost > 0 ? `, descontando ${brl(sim.rewardsCost)}/dia em brindes` : ""}.
      </p>
    </div>
  );
}
