import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { combosQuery, loyaltyQuery, productsQuery, profileQuery, type Combo, type ComboItem, type Product } from "@/lib/data";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Equipe } from "@/components/Equipe";

export const Route = createFileRoute("/_authenticated/app/ajustes")({
  component: Ajustes,
});

function Ajustes() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary-deep">Ajustes</h1>
      <Tabs defaultValue="produtos">
        <TabsList className="grid h-12 w-full grid-cols-5 text-xs">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="fidelidade">Selos</TabsTrigger>
          <TabsTrigger value="combos">Combos</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="conta">Conta</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos"><Produtos /></TabsContent>
        <TabsContent value="fidelidade"><Fidelidade /></TabsContent>
        <TabsContent value="combos"><Combos /></TabsContent>
        <TabsContent value="equipe"><Equipe /></TabsContent>
        <TabsContent value="conta"><Conta /></TabsContent>
      </Tabs>
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

function Produtos() {
  const { data = [] } = useQuery(productsQuery);
  const qc = useQueryClient();
  async function add() {
    const { error } = await supabase.from("products").insert({ name: "Novo produto", price: 0 });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["products"] });
  }
  return (
    <div className="space-y-3">
      {data.map((p) => <ProductRow key={p.id} p={p} />)}
      <Button variant="soft" size="xl" className="w-full" onClick={add}><Plus /> Adicionar produto</Button>
    </div>
  );
}

function ProductRow({ p }: { p: Product }) {
  const qc = useQueryClient();
  const [name, setName] = useState(p.name);
  const [price, setPrice] = useState(String(p.price));
  const [cost, setCost] = useState(p.cost == null ? "" : String(p.cost));
  async function save(patch: Partial<{ name: string; price: number; cost: number | null; active: boolean }>) {
    const { error } = await supabase.from("products").update(patch).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["products"] });
  }
  return (
    <div className={`space-y-2 rounded-2xl bg-card p-4 shadow-soft ${p.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-2">
        <Input className="h-11 text-base font-bold" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== p.name && save({ name })} />
        <Switch checked={p.active} onCheckedChange={(v) => save({ active: v })} aria-label="Ativo" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Venda (R$)</Label><Input inputMode="decimal" className="h-11 text-base" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => save({ price: num(price) ?? 0 })} /></div>
        <div><Label>Custo (R$)</Label><Input inputMode="decimal" className="h-11 text-base" placeholder="preencha" value={cost} onChange={(e) => setCost(e.target.value)} onBlur={() => save({ cost: num(cost) })} /></div>
      </div>
      {p.cost == null && <p className="text-xs font-semibold text-sun-foreground">Informe o custo para o lucro sair certo.</p>}
    </div>
  );
}

function ProductSelect({ value, onChange, products }: { value: string | null; onChange: (v: string) => void; products: Product[] }) {
  return (
    <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

function Fidelidade() {
  const { data: products = [] } = useQuery(productsQuery);
  const { data: l } = useQuery(loyaltyQuery);
  const qc = useQueryClient();
  const [f, setF] = useState({ active: true, product_id: "", required_qty: 10, reward_product_id: "", reward_qty: 1 });
  useEffect(() => {
    if (l) setF({ active: l.active, product_id: l.product_id ?? "", required_qty: l.required_qty, reward_product_id: l.reward_product_id ?? "", reward_qty: l.reward_qty });
  }, [l]);
  async function save() {
    const payload = { ...f, product_id: f.product_id || null, reward_product_id: f.reward_product_id || null };
    const { error } = await supabase.from("loyalty").upsert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Programa salvo");
    qc.invalidateQueries({ queryKey: ["loyalty"] });
  }
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
      <label className="flex items-center justify-between font-bold">Programa ativo <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></label>
      <div><Label>A cada</Label><Input type="number" min={1} className="h-11 text-base" value={f.required_qty} onChange={(e) => setF({ ...f, required_qty: Number(e.target.value) })} /></div>
      <div><Label>unidades pagas de</Label><ProductSelect products={products} value={f.product_id} onChange={(v) => setF({ ...f, product_id: v })} /></div>
      <div><Label>ganhe (quantidade)</Label><Input type="number" min={1} className="h-11 text-base" value={f.reward_qty} onChange={(e) => setF({ ...f, reward_qty: Number(e.target.value) })} /></div>
      <div><Label>de brinde</Label><ProductSelect products={products} value={f.reward_product_id} onChange={(v) => setF({ ...f, reward_product_id: v })} /></div>
      <Button variant="hero" size="xl" className="w-full" onClick={save}>Salvar</Button>
    </div>
  );
}

function Combos() {
  const { data = [] } = useQuery(combosQuery);
  const qc = useQueryClient();
  async function add() {
    await supabase.from("combos").insert({ name: "Novo combo", items: [], price: 0 });
    qc.invalidateQueries({ queryKey: ["combos"] });
  }
  return (
    <div className="space-y-3">
      {data.map((c) => <ComboEditor key={c.id} c={c} />)}
      <Button variant="soft" size="xl" className="w-full" onClick={add}><Plus /> Novo combo</Button>
    </div>
  );
}

function ComboEditor({ c }: { c: Combo }) {
  const { data: products = [] } = useQuery(productsQuery);
  const qc = useQueryClient();
  const [name, setName] = useState(c.name);
  const [items, setItems] = useState<ComboItem[]>(c.items);
  const [rewardId, setRewardId] = useState(c.reward_product_id ?? "");
  const [rewardQty, setRewardQty] = useState(c.reward_qty);
  const [price, setPrice] = useState(String(c.price));
  const [active, setActive] = useState(c.active);
  const sum = items.reduce((s, it) => s + (products.find((p) => p.id === it.product_id)?.price ?? 0) * it.qty, 0);

  async function save() {
    const { error } = await supabase.from("combos").update({
      name, items: items.filter((i) => i.product_id && i.qty > 0), reward_product_id: rewardId || null, reward_qty: rewardQty,
      price: num(price) ?? sum, active,
    }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Combo salvo");
    qc.invalidateQueries({ queryKey: ["combos"] });
  }
  async function remove() {
    await supabase.from("combos").update({ active: false }).eq("id", c.id);
    setActive(false);
    qc.invalidateQueries({ queryKey: ["combos"] });
  }

  return (
    <div className={`space-y-3 rounded-2xl bg-card p-4 shadow-soft ${active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-2">
        <Input className="h-11 font-bold" value={name} onChange={(e) => setName(e.target.value)} />
        <Switch checked={active} onCheckedChange={setActive} aria-label="Ativo" />
      </div>
      <p className="text-sm font-bold">Itens comprados</p>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input type="number" min={1} className="h-11 w-20 text-base" value={it.qty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
          <ProductSelect products={products} value={it.product_id} onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, product_id: v } : x)))} />
          <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 /></Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => setItems([...items, { product_id: "", qty: 1 }])}><Plus /> Item</Button>
      <p className="text-sm font-bold">Brinde</p>
      <div className="flex gap-2">
        <Input type="number" min={0} className="h-11 w-20 text-base" value={rewardQty} onChange={(e) => setRewardQty(Number(e.target.value))} />
        <ProductSelect products={products} value={rewardId} onChange={setRewardId} />
      </div>
      <div>
        <Label>Preço do combo (soma dos itens: {brl(sum)})</Label>
        <div className="flex gap-2">
          <Input inputMode="decimal" className="h-11 text-base" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Button variant="soft" onClick={() => setPrice(String(sum))}>Usar soma</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={remove}>Desativar</Button>
        <Button variant="hero" onClick={save}>Salvar</Button>
      </div>
    </div>
  );
}

function Conta() {
  const { data: p } = useQuery(profileQuery);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  useEffect(() => { if (p) setName(p.business_name); }, [p]);
  if (!p) return null;
  async function save() {
    const { error } = await supabase.from("profiles").update({ business_name: name }).eq("id", p!.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
      <div><Label>Nome do ponto</Label><Input className="h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <Button variant="hero" size="xl" className="w-full" onClick={save}>Salvar</Button>
      <p className="text-sm text-muted-foreground">
        Plano: <b>{p.plan === "trial" ? "Teste grátis" : p.plan === "active" ? "Ativo" : "Suspenso"}</b> · vence em {new Date(p.plan_expires_at).toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
}
