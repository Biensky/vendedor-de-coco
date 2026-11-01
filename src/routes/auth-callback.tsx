import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pageMeta } from "@/lib/page-meta";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth-callback")({
  head: () => pageMeta("Concluindo entrada", "Retorno seguro da entrada com Google ou Apple."),
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    async function complete() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) { setFailed(true); return; }
      await navigate({ to: "/app", replace: true });
    }
    void complete().catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [navigate]);
  return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-5 text-center">
    <img src="/icon-192.png" alt="Cocó do Parque" width={64} height={64} />
    <h1 className="text-2xl font-bold text-primary-deep">{failed ? "Não foi possível concluir a entrada" : "Concluindo sua entrada..."}</h1>
    {failed && <Button onClick={() => navigate({ to: "/auth" })} variant="hero" size="xl">Voltar para entrar</Button>}
  </div>;
}