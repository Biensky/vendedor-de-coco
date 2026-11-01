import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QrCode, Users, Zap, BarChart3, Settings, LogOut, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminQuery, planState, profileQuery } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Meu ponto — Cocó do Parque" },
      { name: "description", content: "Área do vendedor: escanear clientes, vendas e painel." },
      { property: "og:title", content: "Meu ponto — Cocó do Parque" },
      { property: "og:description", content: "Área do vendedor." },
    ],
  }),
  component: AppLayout,
});

const nav = [
  { to: "/app", label: "Escanear", icon: QrCode, exact: true },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/venda", label: "Avulsa", icon: Zap },
  { to: "/app/painel", label: "Painel", icon: BarChart3 },
  { to: "/app/ajustes", label: "Ajustes", icon: Settings },
] as const;

function AppLayout() {
  const { data: profile } = useQuery(profileQuery);
  const { data: isAdmin } = useQuery(isAdminQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const plan = planState(profile);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { modo: undefined }, replace: true });
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-coco px-4 py-3 text-primary-foreground shadow-soft">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-xl" />
          <div className="leading-tight">
            <p className="font-display text-lg font-bold">{profile?.business_name ?? "Cocó do Parque"}</p>
            {profile && <p className="text-xs opacity-90">{plan.label}{profile.plan === "trial" && plan.daysLeft > 0 ? ` · ${plan.daysLeft} dias` : ""}</p>}
          </div>
        </div>
        <div className="flex gap-1">
          {isAdmin && (
            <Link to="/admin" className="rounded-xl p-2 hover:bg-primary-foreground/10" aria-label="Admin"><Shield className="size-5" /></Link>
          )}
          <button onClick={signOut} className="rounded-xl p-2 hover:bg-primary-foreground/10" aria-label="Sair"><LogOut className="size-5" /></button>
        </div>
      </header>

      {plan.blocked ? (
        <div className="m-4 rounded-3xl bg-card p-6 text-center shadow-soft">
          <h2 className="text-2xl font-bold text-destructive">Conta suspensa</h2>
          <p className="mt-2 text-muted-foreground">
            {profile?.plan === "trial" ? "Seu teste grátis terminou." : "Seu plano está suspenso."} Regularize pelo WhatsApp {SUPPORT_WHATSAPP_LABEL} para voltar a registrar vendas.
          </p>
          <Button asChild variant="hero" size="xl" className="mt-5 w-full">
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Olá! Quero regularizar minha conta do Cocó do Parque.")}`} target="_blank" rel="noreferrer">
              Falar no WhatsApp
            </a>
          </Button>
        </div>
      ) : (
        <main className="p-4">
          <Outlet />
        </main>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="flex flex-col items-center gap-1 py-3 text-xs font-bold text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <n.icon className="size-6" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
