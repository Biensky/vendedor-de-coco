import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uid } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  validateSearch: (s: Record<string, unknown>): { novo?: boolean } => (s["novo"] === true || s["novo"] === "true" ? { novo: true } : {}),
  component: ClientesPage,
});

function ClientesPage() {
  const { novo } = Route.useSearch();
  const [open, setOpen] = useState(!!novo);
  const [filter, setFilter] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,name,whatsapp,stamps,code").eq("vendor_id", await uid()).order("name");
      return data ?? [];
    },
  });
  const list = data.filter((c) => (c.name + (c.whatsapp ?? "")).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-deep">Clientes</h1>
        <span className="text-muted-foreground">{data.length}</span>
      </div>
      <Button variant="hero" size="xl" className="w-full" onClick={() => setOpen(true)}><UserPlus /> Novo cliente</Button>
      <Input className="h-12 rounded-2xl text-base" placeholder="Filtrar..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id}>
            <Link to="/app/cliente/$id" params={{ id: c.id }} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft">
              <div>
                <p className="text-lg font-bold">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.whatsapp || "sem WhatsApp"}</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 font-bold text-secondary-foreground">🥥 {c.stamps}</span>
            </Link>
          </li>
        ))}
        {list.length === 0 && <p className="text-center text-muted-foreground">Nenhum cliente ainda.</p>}
      </ul>
      <NewCustomerDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.from("customers").insert({ name, whatsapp, notes }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente cadastrado!");
    qc.invalidateQueries({ queryKey: ["customers"] });
    onOpenChange(false);
    setName(""); setWhatsapp(""); setNotes("");
    navigate({ to: "/app/cliente/$id", params: { id: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Nome</Label><Input className="h-12 text-base" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input className="h-12 text-base" inputMode="tel" placeholder="(61) 99999-9999" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
          <div><Label>Observação</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={saving}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
