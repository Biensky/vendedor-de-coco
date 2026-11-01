export function CardCode({ code }: { code: string }) {
  return (
    <div className="space-y-2 text-center">
      <p className="font-mono text-xl font-bold break-all" aria-label={`Código do cartão: ${code}`}>
        {code.slice(0, -4)}<strong className="ml-1 rounded-md bg-secondary px-2 py-1 text-2xl text-primary-deep">{code.slice(-4)}</strong>
      </p>
      <p className="text-sm text-muted-foreground">Guarde: você precisa destes 4 dígitos para acessar de outro celular</p>
    </div>
  );
}