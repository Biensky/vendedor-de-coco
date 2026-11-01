import { createFileRoute } from "@tanstack/react-router";
import { SaleForm } from "@/components/SaleForm";

export const Route = createFileRoute("/_authenticated/app/venda")({
  component: () => (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary-deep">Venda avulsa</h1>
        <p className="text-muted-foreground">Sem cliente identificado — entra no caixa, sem selos.</p>
      </div>
      <SaleForm />
    </div>
  ),
});
