import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { combosQuery, productsQuery } from "@/lib/data";
import { brl, PAYMENTS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaleForm({ customerId, onDone }: { customerId?: string; onDone?: () => void }) {
  const { data: products = [] } = useQuery(productsQuery);
  const { data: combos = [] } = useQuery(combosQuery);
  const qc = useQueryClient();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [comboId, setComboId] = useState<string | null>(null);
  const [payment, setPayment] = useState<string>("pix");
  const [takeNow, setTakeNow] = useState(true);
  const [saving, setSaving] = useState(false);

  const active = products.filter((p) => p.active);
  const combo = combos.find((c) => c.id === comboId);
  const total = (combo?.price ?? 0) + active.reduce((s, p) => s + (qty[p.id] ?? 0) * p.price, 0);
  const empty = !combo && Object.values(qty).every((v) => !v);

  function bump(id: string, d: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + d) }));
  }

  async function submit() {
    setSaving(true);
    const items = Object.entries(qty).filter(([, v]) => v > 0).map(([product_id, q]) => ({ product_id, qty: q }));
    const { error } = await supabase.rpc("register_sale", {
      _customer_id: customerId ?? (null as unknown as string),
      _items: items,
      _combo_id: comboId ?? (null as unknown as string),
      _payment: payment,
      _take_now: customerId ? takeNow : true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Venda registrada: ${brl(total)}`);
    setQty({}); setComboId(null);
    qc.invalidateQueries();
    onDone?.();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {active.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft">
            <div>
              <p className="font-bold">{p.name}</p>
              <p className="text-sm text-muted-foreground">{brl(p.price)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button size="icon" variant="soft" onClick={() => bump(p.id, -1)} aria-label="Menos"><Minus /></Button>
              <span className="w-6 text-center font-display text-2xl font-bold">{qty[p.id] ?? 0}</span>
              <Button size="icon" variant="hero" onClick={() => bump(p.id, 1)} aria-label="Mais"><Plus /></Button>
            </div>
          </div>
        ))}
      </div>

      {combos.filter((c) => c.active).length > 0 && (
        <div>
          <p className="mb-2 font-bold">Combo</p>
          <div className="space-y-2">
            {combos.filter((c) => c.active).map((c) => (
              <button
                key={c.id}
                onClick={() => setComboId(comboId === c.id ? null : c.id)}
                className={cn("w-full rounded-2xl border-2 p-3 text-left font-bold", comboId === c.id ? "border-primary bg-secondary" : "border-border bg-card")}
              >
                {c.name} <span className="float-right text-primary">{brl(c.price)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 font-bold">Pagamento</p>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENTS.map((p) => (
            <Button key={p.id} variant={payment === p.id ? "hero" : "soft"} size="lg" onClick={() => setPayment(p.id)}>{p.label}</Button>
          ))}
        </div>
      </div>

      {customerId && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant={takeNow ? "hero" : "soft"} size="lg" onClick={() => setTakeNow(true)}>Leva agora</Button>
          <Button variant={!takeNow ? "sun" : "soft"} size="lg" onClick={() => setTakeNow(false)}>Deixar crédito</Button>
        </div>
      )}

      <Button variant="hero" size="xl" className="w-full" disabled={empty || saving} onClick={submit}>
        Registrar {brl(total)}
      </Button>
    </div>
  );
}
