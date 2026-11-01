import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, Gift, Wallet, BarChart3, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cocó do Parque — cartão fidelidade e caixa para ambulantes" },
      { name: "description", content: "Cartão fidelidade com QR Code, créditos para retirar depois e painel de lucro para vendedores de coco, açaí, caldo de cana, pastel e food truck." },
      { property: "og:title", content: "Cocó do Parque — fidelidade para vendedores ambulantes" },
      { property: "og:description", content: "Seus clientes voltam mais. Selos, brindes, combos e lucro do dia no celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: QrCode, t: "Cartão com QR Code", d: "Cada cliente tem seu cartão no celular. Escaneou, achou." },
  { icon: Gift, t: "Selos e brindes", d: "A cada 10 cocos, 1 grátis. Você define a regra." },
  { icon: Wallet, t: "Créditos para retirar", d: "Vendeu combo? O cliente retira aos poucos, tudo anotado." },
  { icon: BarChart3, t: "Lucro na palma da mão", d: "Receita, custo e lucro de hoje, da semana e do mês." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
          <span className="font-display text-xl font-bold text-primary-deep">Cocó do Parque</span>
        </div>
        <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-8 px-5 pb-12 pt-4 md:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-sun px-3 py-1 text-sm font-bold text-sun-foreground">30 dias grátis</span>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-primary-deep md:text-5xl">
            Seu cliente volta. Seu caixa fecha.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Fidelidade com QR Code e controle de vendas para quem vende na rua: coco, açaí, caldo de cana, pastel, food truck.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="hero" size="xl"><Link to="/auth" search={{ modo: "cadastro" }}>Criar minha conta</Link></Button>
            <Button asChild variant="soft" size="xl"><Link to="/auth">Entrar</Link></Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Smartphone className="size-4" /> Funciona no celular, com uma mão, debaixo de sol.</p>
        </div>
        <img src={hero} alt="Carrinho de coco no parque" width={1024} height={768} className="w-full rounded-3xl object-cover shadow-soft" />
      </section>

      <section className="bg-coco py-12">
        <div className="mx-auto grid max-w-5xl gap-4 px-5 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.t} className="rounded-2xl bg-card p-5 shadow-soft">
              <f.icon className="size-8 text-primary" />
              <h3 className="mt-3 text-xl font-semibold">{f.t}</h3>
              <p className="mt-1 text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-5 py-8 text-center text-sm text-muted-foreground">© Cocó do Parque</footer>
    </div>
  );
}
