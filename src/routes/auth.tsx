import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { modo?: "cadastro" } => (s["modo"] === "cadastro" ? { modo: "cadastro" } : {}),
  head: () => ({
    meta: [
      { title: "Entrar — Cocó do Parque" },
      { name: "description", content: "Entre ou crie sua conta de vendedor no Cocó do Parque." },
      { property: "og:title", content: "Entrar — Cocó do Parque" },
      { property: "og:description", content: "Acesse seu painel de vendas e fidelidade." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { modo } = Route.useSearch();
  const [signup, setSignup] = useState(modo === "cadastro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [business, setBusiness] = useState("");
  const [kind, setKind] = useState<"dono" | "vendedor">("dono");
  const [invite, setInvite] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (signup) {
        if (kind === "vendedor") {
          const { data: est } = await supabase.rpc("check_invite", { _code: invite });
          if (!est) throw new Error("Código de convite inválido");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app`, data: kind === "dono" ? { business_name: business || "Meu ponto", display_name: displayName } : { invite_code: invite.trim().toUpperCase(), display_name: displayName } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/app" });
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(msg.includes("Invalid login") ? "E-mail ou senha incorretos" : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-coco px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-soft">
        <div className="mb-5 flex flex-col items-center text-center">
          <img src="/icon-192.png" alt="" width={64} height={64} className="rounded-2xl" />
          <h1 className="mt-3 text-2xl font-bold text-primary-deep">{signup ? "Criar minha conta" : "Entrar"}</h1>
        </div>
        {sent ? (
          <p className="text-center">Enviamos um link de confirmação para <b>{email}</b>. Abra seu e-mail para ativar a conta.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {signup && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={kind === "dono" ? "hero" : "soft"} onClick={() => setKind("dono")}>Sou o responsável</Button>
                  <Button type="button" variant={kind === "vendedor" ? "hero" : "soft"} onClick={() => setKind("vendedor")}>Tenho convite</Button>
                </div>
                <div>
                  <Label>Seu nome</Label>
                  <Input className="h-12 text-base" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                {kind === "dono" ? (
                  <div>
                    <Label>Nome do estabelecimento</Label>
                <Input className="h-12 text-base" placeholder="Ex.: Coco do Zé" value={business} onChange={(e) => setBusiness(e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <Label>Código de convite</Label>
                    <Input className="h-12 text-base uppercase" required placeholder="Peça ao responsável" value={invite} onChange={(e) => setInvite(e.target.value)} />
                  </div>
                )}
              </>
            )}
            <div>
              <Label>E-mail</Label>
              <Input className="h-12 text-base" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Senha</Label>
              <Input className="h-12 text-base" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="hero" size="xl" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : signup ? "Criar conta grátis" : "Entrar"}
            </Button>
          </form>
        )}
        <button className="mt-5 w-full text-center font-semibold text-primary" onClick={() => { setSignup(!signup); setSent(false); }}>
          {signup ? "Já tenho conta — entrar" : "Não tenho conta — criar"}
        </button>
      </div>
    </div>
  );
}
