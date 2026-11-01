import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, uid } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const teamQuery = {
  queryKey: ["team"],
  queryFn: async () => {
    const me = await uid();
    const { data } = await supabase.from("profiles").select("id,display_name,email,active,member_role").eq("establishment_id", me).order("created_at");
    return data ?? [];
  },
};

export function Equipe() {
  const { data: p } = useQuery(profileQuery);
  const { data: team = [] } = useQuery(teamQuery);
  const qc = useQueryClient();
  if (!p) return null;
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/auth?modo=cadastro`;
  const msg = `Entre na equipe do ${p.business_name} no Cocó do Parque!\n1) Abra ${link}\n2) Toque em "Tenho convite"\n3) Use o código: ${p.invite_code}`;

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.rpc("owner_set_member_active", { _member: id, _active: active });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-4 text-center shadow-soft">
        <p className="text-sm font-semibold text-muted-foreground">Código de convite da equipe</p>
        <p className="font-mono text-3xl font-bold tracking-widest text-primary-deep">{p.invite_code}</p>
        <Button asChild variant="hero" size="lg" className="mt-3 w-full">
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle /> Convidar por WhatsApp</a>
        </Button>
      </div>
      {team.map((m) => (
        <div key={m.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft">
          <div>
            <p className="font-bold">{m.display_name || m.email}</p>
            <p className="text-sm text-muted-foreground">{m.member_role === "owner" ? "Responsável" : m.active ? "Vendedor" : "Vendedor bloqueado"}</p>
          </div>
          {m.member_role !== "owner" && <Switch checked={m.active} onCheckedChange={(v) => toggle(m.id, v)} aria-label="Ativo" />}
        </div>
      ))}
      {team.length <= 1 && <p className="text-center text-sm text-muted-foreground">Nenhum vendedor ainda. Envie o código acima.</p>}
    </div>
  );
}
