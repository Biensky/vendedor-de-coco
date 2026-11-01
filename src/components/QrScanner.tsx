import { useEffect, useRef, useState } from "react";

export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const id = useRef(`qr-${Math.random().toString(36).slice(2)}`);
  const cb = useRef(onResult);
  cb.current = onResult;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; isScanning: boolean } | null = null;
    let done = false;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(id.current);
        scanner = s;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (done) return;
            done = true;
            cb.current(text);
            setTimeout(() => (done = false), 2000);
          },
          () => {},
        );
      } catch {
        setError("Não foi possível abrir a câmera. Permita o acesso ou use a busca abaixo.");
      }
    })();
    return () => {
      cancelled = true;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div>
      <div id={id.current} className="aspect-square w-full overflow-hidden rounded-3xl bg-primary-deep" />
      {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
