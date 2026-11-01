import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isAdminQuery } from "@/lib/data";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Super-admin — Cocó do Parque" },
      { name: "description", content: "Gestão de vendedores e planos." },
      { property: "og:title", content: "Super-admin — Cocó do Parque" },
      { property: "og:description", content: "Gestão de vendedores e planos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const label = { trial: "Teste grátis", active: "Ativo", suspended: "Suspenso" } as const;

function Admin() {
  const { data: isAdmin, isLoading } = useQuery(isAdminQuery);
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-vendors"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_vendors");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function setPlan(id: string, plan: "trial" | "active" | "suspended", days?: number) {
    const expires = days ? new Date(Date.now() + days * 86400000).toISOString() : (null as unknown as string);
    const { error } = await supabase.rpc("admin_set_plan", { _vendor: id, _plan: plan, _expires: expires });
    if (error) { toast.error(error.message); return; }
    toast.success("Plano atualizado");
    qc.invalidateQueries({ queryKey: ["admin-vendors"] });
  }

  if (isLoading) return null;
  if (!isAdmin) return <div className="p-10 text-center">Acesso restrito. <Link to="/app" className="text-primary underline">Voltar</Link></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-deep">Vendedores ({data.length})</h1>
        <Link to="/app" className="font-bold text-primary">← App</Link>
      </div>
      {data.map((v) => (
        <div key={v.id} className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold">{v.business_name}</p>
              <p className="text-sm text-muted-foreground">{v.email}</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold">{label[v.plan]}</span>
          </div>
          <p className="mt-2 text-sm">
            Vence: <b>{new Date(v.plan_expires_at).toLocaleDateString("pt-BR")}</b> · Vendedores: <b>{v.sellers}</b> · Clientes: <b>{v.customers}</b> · Vendas no mês: <b>{v.sales_month}</b> ({brl(v.revenue_month)})
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="hero" onClick={() => setPlan(v.id, "active", 30)}>Ativar +30 dias</Button>
            <Button size="sm" variant="soft" onClick={() => setPlan(v.id, "trial", 30)}>Novo teste 30 dias</Button>
            <Button size="sm" variant="destructive" onClick={() => setPlan(v.id, "suspended")}>Suspender</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
