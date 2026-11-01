import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Camera, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uid } from "@/lib/data";
import { QrScanner } from "@/components/QrScanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { onlyDigits, parseScannedCode } from "@/lib/format";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => pageMeta("Escanear cliente", "Identifique o cartão do cliente para vender ou entregar créditos."),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const [camera, setCamera] = useState(true);
  const [q, setQ] = useState("");

  const { data: results = [] } = useQuery({
    queryKey: ["customer-search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const term = q.trim();
      const digits = onlyDigits(term);
      let query = supabase.from("customers").select("id,name,whatsapp,code").eq("vendor_id", await uid()).limit(10);
      query = digits.length >= 3
        ? query.or(`whatsapp.ilike.%${digits}%,code.ilike.%${term}%`)
        : query.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  async function handleScan(text: string) {
    const code = parseScannedCode(text);
    if (!code) { toast.error("QR Code não reconhecido"); return; }
    const { data } = await supabase.from("customers").select("id").eq("code", code).eq("vendor_id", await uid()).maybeSingle();
    if (!data) { toast.error("Cliente não encontrado neste ponto"); return; }
    navigate({ to: "/app/cliente/$id", params: { id: data.id } });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary-deep">Escanear cliente</h1>
      {camera ? (
        <QrScanner onResult={handleScan} />
      ) : (
        <Button variant="hero" size="xl" className="w-full" onClick={() => setCamera(true)}><Camera /> Abrir câmera</Button>
      )}
      {camera && <Button variant="ghost" className="w-full" onClick={() => setCamera(false)}>Fechar câmera</Button>}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-14 rounded-2xl pl-12 text-lg" placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="space-y-2">
        {results.map((c) => (
          <li key={c.id}>
            <Link to="/app/cliente/$id" params={{ id: c.id }} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft">
              <span className="text-lg font-bold">{c.name}</span>
              <span className="text-sm text-muted-foreground">{c.whatsapp}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild variant="soft" size="xl" className="w-full"><Link to="/app/clientes" search={{ novo: true }}><UserPlus /> Novo cliente</Link></Button>
    </div>
  );
}
