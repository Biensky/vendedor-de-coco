import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { brl, cardUrl, dateTime } from "@/lib/format";
import { StampCard } from "@/components/StampCard";

type Card = {
  name: string;
  code: string;
  stamps: number;
  vendor: string;
  loyalty: { required: number; product: string; reward: string; reward_qty: number; active: boolean } | null;
  credits: { product: string; kind: string; qty: number }[];
  history: { type: string; at: string; total?: number; qty?: number; product?: string }[];
};

export const Route = createFileRoute("/c/$code")({
  head: () => ({
    meta: [
      { title: "Meu cartão fidelidade — Cocó do Parque" },
      { name: "description", content: "Seu cartão fidelidade: selos, créditos a retirar e histórico." },
      { property: "og:title", content: "Meu cartão fidelidade" },
      { property: "og:description", content: "Mostre este QR Code ao vendedor a cada compra." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CardPage,
});

function CardPage() {
  const { code } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["card", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_card", { _code: code });
      if (error) throw error;
      return data as unknown as Card | null;
    },
  });

  if (isLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!data) return <div className="p-10 text-center">Cartão não encontrado.</div>;

  return (
    <div className="min-h-screen bg-coco px-4 py-8">
      <div className="mx-auto max-w-sm space-y-4">
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <p className="text-sm font-semibold text-muted-foreground">{data.vendor}</p>
          <h1 className="mt-1 text-2xl font-bold text-primary-deep">{data.name}</h1>
          <div className="mx-auto mt-4 w-fit rounded-2xl bg-card p-3 ring-4 ring-secondary">
            <QRCodeSVG value={cardUrl(data.code)} size={220} />
          </div>
          <p className="mt-2 font-mono text-lg font-bold tracking-widest">{data.code}</p>
          <p className="text-sm text-muted-foreground">Mostre esta tela ao vendedor</p>
        </div>

        {data.loyalty?.active && (
          <div className="rounded-3xl bg-card p-5 shadow-soft">
            <StampCard stamps={data.stamps} required={data.loyalty.required} />
            <p className="mt-2 text-center text-sm text-muted-foreground">
              A cada {data.loyalty.required} {data.loyalty.product} ganhe {data.loyalty.reward_qty} {data.loyalty.reward} grátis
            </p>
          </div>
        )}

        <div className="rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Créditos a retirar</h2>
          {data.credits.length === 0 ? (
            <p className="text-muted-foreground">Nenhum crédito pendente.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {data.credits.map((c, i) => (
                <li key={i} className="flex justify-between font-semibold">
                  <span>{c.product} {c.kind === "brinde" && <span className="text-xs text-primary">(brinde)</span>}</span>
                  <span>{c.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Histórico</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.history.map((h, i) => (
              <li key={i} className="flex justify-between py-2">
                <span>{h.type === "compra" ? `Compra ${brl(h.total)}` : `Retirou ${h.qty} ${h.product ?? ""}`}</span>
                <span className="text-muted-foreground">{dateTime(h.at)}</span>
              </li>
            ))}
            {data.history.length === 0 && <li className="py-2 text-muted-foreground">Sem movimentações ainda.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
