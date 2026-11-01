import { cn } from "@/lib/utils";

export function StampCard({ stamps, required }: { stamps: number; required: number }) {
  const total = Math.max(1, Math.min(required, 30));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Selos</span>
        <span className="font-display text-2xl font-bold text-primary">{stamps}/{required}</span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex aspect-square items-center justify-center rounded-full border-2 text-lg",
              i < stamps ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-border bg-muted",
            )}
          >
            {i < stamps ? "🥥" : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
