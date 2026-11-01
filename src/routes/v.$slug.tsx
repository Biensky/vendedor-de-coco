import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingCart, PackageCheck, CheckCircle2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateTime, PAYMENTS, saveCardWhatsApp } from "@/lib/format";
import { CardCode } from "@/components/CardCode";
import { StampCard } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Vendor = {
  slug: string;
  seller: string;
  business: string;
  active: boolean;
  max_units: number;
  loyalty: { required: number; product: string; reward: string; reward_qty: number; active: boolean } | null;
  products: { id: string; name: string; price: number }[];
  combos: { id: string; name: string; price: number }[];
};
type Card = {
  name: string;
  code: string;
  whatsapp: string;
  stamps: number;
  credit_items: { product_id: string; product: string; kind: string; qty: number }[];
  history: { type: string; at: string; total?: number; qty?: number; product?: string }[];
};
type Confirm = { title: string; detail: string; at: string };

export const Route = createFileRoute("/v/$slug")({
  head: () => ({
    meta: [
      { title: "Autoatendimento — Cocó do Parque" },
      { name: "description", content: "Registre sua compra, acompanhe seus selos e retire seus créditos." },
      { property: "og:title", content: "Cartão Fidelidade — autoatendimento" },
      { property: "og:description", content: "Escaneou, registrou, ganhou selo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SelfPage,
});

const errMsg = (e: { message: string }) => e.message.replace(/^.*?ERROR:\s*/, "");

function SelfPage() {
  const { slug } = Route.useParams();
  const key = `coco-token-${slug}`;
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [newCard, setNewCard] = useState(false);
  useEffect(() => {
    setToken(localStorage.getItem(key));
    setReady(true);
  }, [key]);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["self-vendor", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("self_vendor", { _slug: slug });
      if (error) throw error;
      return data as unknown as Vendor | null;
    },
  });

  if (isLoading || !ready) return <Shell><p className="text-center">Carregando...</p></Shell>;
  if (!vendor) return <Shell><p className="text-center text-lg font-bold">Vendedor não encontrado.</p></Shell>;
  if (!vendor.active)
    return (
      <Shell vendor={vendor}>
        <p className="text-center text-lg font-bold">O autoatendimento está pausado no momento.</p>
        <p className="mt-2 text-center text-muted-foreground">Fale diretamente com o vendedor. Obrigado! 🥥</p>
      </Shell>
    );

  if (!token)
    return (
      <Shell vendor={vendor}>
        <Identify slug={slug} onToken={(t, isNew) => { localStorage.setItem(key, t); setToken(t); setNewCard(isNew); }} />
      </Shell>
    );

  return (
    <Shell vendor={vendor}>
      <CustomerArea slug={slug} token={token} vendor={vendor} newCard={newCard} onLogout={() => { localStorage.removeItem(key); setToken(null); setNewCard(false); }} />
    </Shell>
  );
}

function Shell({ vendor, children }: { vendor?: Vendor; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-coco px-4 py-6">
      <div className="mx-auto max-w-sm space-y-4">
        <div className="text-center text-primary-foreground">
          <p className="text-4xl">🥥</p>
          <h1 className="font-display text-2xl font-bold">{vendor?.business ?? "Cartão Fidelidade"}</h1>
          {vendor?.seller && <p className="opacity-90">com {vendor.seller}</p>}
        </div>
        <div className="rounded-3xl bg-card p-5 shadow-soft">{children}</div>
      </div>
    </div>
  );
}

function Identify({ slug, onToken }: { slug: string; onToken: (t: string, isNew: boolean) => void }) {
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [suffix, setSuffix] = useState("");
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setErr("");
    const { data, error } = await supabase.rpc("self_identify_secure", { _slug: slug, _name: name, _whatsapp: wa, _card_suffix: needsCode ? suffix : "" });
    setLoading(false);
    if (error) { setErr(errMsg(error)); return; }
    const r = data as unknown as { status: string; token?: string; is_new?: boolean; message?: string; remaining?: number; blocked_until?: string };
    if (r.status === "ok" && r.token) { onToken(r.token, !!r.is_new); return; }
    setNeedsCode(true);
    setErr(`${r.message ?? "Não foi possível entrar."}${r.remaining != null ? ` Restam ${r.remaining} tentativas.` : ""}`);
    setBlockedUntil(r.blocked_until ?? null);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold">Seu cartão fidelidade</h2>
      <p className="text-muted-foreground">Já tem cartão? Tenha o código em mãos para acessar neste aparelho.</p>
      <div><Label htmlFor="self-name">Nome</Label><Input id="self-name" className="h-14 text-lg" required value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label htmlFor="self-wa">WhatsApp</Label><Input id="self-wa" className="h-14 text-lg" inputMode="tel" required placeholder="(61) 99999-9999" value={wa} onChange={(e) => { setWa(e.target.value); setNeedsCode(false); setSuffix(""); setErr(""); setBlockedUntil(null); }} /></div>
      {needsCode && <div><Label htmlFor="self-code">4 últimos caracteres do cartão</Label><Input id="self-code" className="h-14 text-center font-mono text-2xl uppercase" autoComplete="off" maxLength={4} value={suffix} onChange={(e) => setSuffix(e.target.value)} /></div>}
      {err && <p role="alert" className="font-semibold text-destructive">{err}</p>}
      {blockedUntil && <p className="text-sm text-muted-foreground">Tente novamente após {new Date(blockedUntil).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p>}
      <Button type="submit" variant="hero" size="xl" className="w-full" disabled={loading}>{loading ? "Verificando..." : "Entrar no meu cartão"}</Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setForgot(true)}>Esqueci meu código</Button>
      {forgot && <p role="status" className="text-sm text-muted-foreground">Peça ao vendedor para reenviar seu cartão pelo WhatsApp. O código está no cartão e na mensagem enviada por ele.</p>}
    </form>
  );
}

function CustomerArea({ slug, token, vendor, newCard, onLogout }: { slug: string; token: string; vendor: Vendor; newCard: boolean; onLogout: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<null | "compra" | "retirar">(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const { data: card, error } = useQuery({
    queryKey: ["self-card", slug, token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("self_card", { _slug: slug, _token: token });
      if (error) throw error;
      return data as unknown as Card;
    },
  });

  if (error) {
    return (
      <div className="space-y-3 text-center">
        <p>Não encontramos seu cadastro neste aparelho.</p>
        <Button variant="hero" size="xl" className="w-full" onClick={onLogout}>Cadastrar de novo</Button>
      </div>
    );
  }
  if (!card) return <p className="text-center">Carregando...</p>;

  function done(c: Confirm) {
    setMode(null);
    setConfirm(c);
    qc.invalidateQueries({ queryKey: ["self-card", slug, token] });
  }

  if (confirm) {
    return (
      <div className="-m-5 rounded-3xl bg-coco p-8 text-center text-primary-foreground">
        <CheckCircle2 className="mx-auto size-24" />
        <h2 className="mt-3 text-3xl font-bold">{confirm.title}</h2>
        <p className="mt-2 text-xl font-semibold">{confirm.detail}</p>
        <p className="mt-4 font-display text-5xl font-bold">{new Date(confirm.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
        <p className="opacity-90">{new Date(confirm.at).toLocaleDateString("pt-BR")} · {card.name}</p>
        <p className="mt-4 text-sm opacity-90">Mostre esta tela ao vendedor</p>
        <Button variant="sun" size="xl" className="mt-6 w-full" onClick={() => setConfirm(null)}>Voltar ao cartão</Button>
      </div>
    );
  }

  if (mode === "compra") return <SelfPurchase slug={slug} token={token} vendor={vendor} onCancel={() => setMode(null)} onDone={done} />;
  if (mode === "retirar") return <SelfWithdraw slug={slug} token={token} card={card} onCancel={() => setMode(null)} onDone={done} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Olá, {card.name.split(" ")[0]}!</h2>
        <Button variant="ghost" size="sm" onClick={onLogout}>Não sou eu</Button>
      </div>
      {newCard && <p className="text-center text-lg font-bold text-primary-deep">Seu cartão foi criado! Guarde seu código.</p>}
      <CardCode code={card.code} />
      {card.whatsapp && <Button asChild variant="soft" size="lg" className="h-auto min-h-12 w-full whitespace-normal"><a href={saveCardWhatsApp(card.whatsapp, card.code)} target="_blank" rel="noreferrer"><MessageCircle className="shrink-0" /> Salvar meu cartão no WhatsApp</a></Button>}
      {vendor.loyalty?.active && (
        <div>
          <StampCard stamps={card.stamps} required={vendor.loyalty.required} />
          <p className="mt-1 text-center text-sm text-muted-foreground">A cada {vendor.loyalty.required} {vendor.loyalty.product}, ganhe {vendor.loyalty.reward_qty} {vendor.loyalty.reward} grátis</p>
        </div>
      )}
      <div>
        <p className="font-bold">Créditos a retirar</p>
        {card.credit_items.length === 0 ? <p className="text-muted-foreground">Nenhum.</p> : card.credit_items.map((c) => (
          <p key={c.product_id + c.kind} className="flex justify-between text-lg font-bold">
            <span>{c.product} {c.kind === "brinde" && <span className="text-sm text-primary">brinde</span>}</span><span>{c.qty}</span>
          </p>
        ))}
      </div>
      <Button variant="hero" size="xl" className="w-full" onClick={() => setMode("compra")}><ShoppingCart /> Registrar compra</Button>
      <Button variant="sun" size="xl" className="w-full" disabled={card.credit_items.length === 0} onClick={() => setMode("retirar")}><PackageCheck /> Retirar crédito</Button>
      <div>
        <p className="font-bold">Histórico</p>
        <ul className="divide-y divide-border text-sm">
          {card.history.slice(0, 8).map((h, i) => (
            <li key={i} className="flex justify-between py-2">
              <span>{h.type === "compra" ? `Compra ${brl(h.total)}` : `Retirou ${h.qty} ${h.product ?? ""}`}</span>
              <span className="text-muted-foreground">{dateTime(h.at)}</span>
            </li>
          ))}
          {card.history.length === 0 && <li className="py-2 text-muted-foreground">Sem movimentações.</li>}
        </ul>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, max }: { value: number; onChange: (v: number) => void; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <Button size="icon" variant="soft" onClick={() => onChange(Math.max(0, value - 1))} aria-label="Menos"><Minus /></Button>
      <span className="w-6 text-center font-display text-2xl font-bold">{value}</span>
      <Button size="icon" variant="hero" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Mais"><Plus /></Button>
    </div>
  );
}

function SelfPurchase({ slug, token, vendor, onCancel, onDone }: { slug: string; token: string; vendor: Vendor; onCancel: () => void; onDone: (c: Confirm) => void }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [comboId, setComboId] = useState<string | null>(null);
  const [takeNow, setTakeNow] = useState(true);
  const [payment, setPayment] = useState("pix");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const units = Object.values(qty).reduce((a, b) => a + b, 0);
  const combo = vendor.combos.find((c) => c.id === comboId);
  const total = (combo?.price ?? 0) + vendor.products.reduce((s, p) => s + (qty[p.id] ?? 0) * Number(p.price), 0);

  async function submit() {
    setSaving(true); setErr("");
    const items = Object.entries(qty).filter(([, v]) => v > 0).map(([product_id, q]) => ({ product_id, qty: q }));
    const { data, error } = await supabase.rpc("self_register_sale", {
      _slug: slug, _token: token, _items: items, _combo_id: comboId ?? (null as unknown as string), _take_now: takeNow, _payment: payment,
    });
    setSaving(false);
    if (error) { setErr(errMsg(error)); return; }
    const r = data as unknown as { at: string; total: number; take_now: boolean };
    onDone({ title: "Compra registrada!", detail: `${brl(r.total)} · ${r.take_now ? "levou agora" : "ficou de crédito"}`, at: r.at });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Registrar compra</h2>
      {vendor.products.map((p) => (
        <div key={p.id} className="flex items-center justify-between">
          <div><p className="font-bold">{p.name}</p><p className="text-sm text-muted-foreground">{brl(p.price)}</p></div>
          <Stepper value={qty[p.id] ?? 0} max={vendor.max_units - units + (qty[p.id] ?? 0)} onChange={(v) => setQty({ ...qty, [p.id]: v })} />
        </div>
      ))}
      {vendor.combos.length > 0 && (
        <div className="space-y-2">
          <p className="font-bold">Ou um combo</p>
          {vendor.combos.map((c) => (
            <button key={c.id} onClick={() => setComboId(comboId === c.id ? null : c.id)}
              className={cn("w-full rounded-2xl border-2 p-3 text-left font-bold", comboId === c.id ? "border-primary bg-secondary" : "border-border")}>
              {c.name} <span className="float-right text-primary">{brl(c.price)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {PAYMENTS.map((p) => <Button key={p.id} variant={payment === p.id ? "hero" : "soft"} onClick={() => setPayment(p.id)}>{p.label}</Button>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={takeNow ? "hero" : "soft"} size="lg" onClick={() => setTakeNow(true)}>Levo agora</Button>
        <Button variant={!takeNow ? "sun" : "soft"} size="lg" onClick={() => setTakeNow(false)}>Deixar crédito</Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Máximo de {vendor.max_units} unidades por registro.</p>
      {err && <p className="font-semibold text-destructive">{err}</p>}
      <Button variant="hero" size="xl" className="w-full" disabled={saving || (!comboId && units === 0)} onClick={submit}>Confirmar {brl(total)}</Button>
      <Button variant="ghost" className="w-full" onClick={onCancel}>Cancelar</Button>
    </div>
  );
}

function SelfWithdraw({ slug, token, card, onCancel, onDone }: { slug: string; token: string; card: Card; onCancel: () => void; onDone: (c: Confirm) => void }) {
  const [sel, setSel] = useState<string>(card.credit_items[0] ? card.credit_items[0].product_id + "|" + card.credit_items[0].kind : "");
  const [q, setQ] = useState(1);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const item = card.credit_items.find((c) => c.product_id + "|" + c.kind === sel);

  async function submit() {
    if (!item) return;
    setSaving(true); setErr("");
    const { data, error } = await supabase.rpc("self_withdraw", { _slug: slug, _token: token, _product_id: item.product_id, _kind: item.kind, _qty: q });
    setSaving(false);
    if (error) { setErr(errMsg(error)); return; }
    const r = data as unknown as { at: string; qty: number; product: string };
    onDone({ title: "Retirada confirmada!", detail: `${r.qty} ${r.product}`, at: r.at });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Retirar crédito</h2>
      {card.credit_items.map((c) => {
        const k = c.product_id + "|" + c.kind;
        return (
          <button key={k} onClick={() => { setSel(k); setQ(1); }}
            className={cn("w-full rounded-2xl border-2 p-3 text-left font-bold", sel === k ? "border-primary bg-secondary" : "border-border")}>
            {c.product} {c.kind === "brinde" && <span className="text-sm text-primary">brinde</span>}
            <span className="float-right">saldo {c.qty}</span>
          </button>
        );
      })}
      {item && (
        <div className="flex items-center justify-between">
          <span className="font-bold">Quantidade</span>
          <Stepper value={q} max={item.qty} onChange={(v) => setQ(Math.max(1, v))} />
        </div>
      )}
      {err && <p className="font-semibold text-destructive">{err}</p>}
      <Button variant="hero" size="xl" className="w-full" disabled={saving || !item} onClick={submit}>Confirmar retirada</Button>
      <Button variant="ghost" className="w-full" onClick={onCancel}>Cancelar</Button>
    </div>
  );
}
