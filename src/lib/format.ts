export const SUPPORT_WHATSAPP = "5561981402233";
export const SUPPORT_WHATSAPP_LABEL = "(61) 98140-2233";

export function brl(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dateTime(v: string) {
  return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export function waNumber(phone: string) {
  const d = onlyDigits(phone);
  return d.length <= 11 ? `55${d}` : d;
}

export function cardUrl(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/c/${code}`;
}

export function saveCardWhatsApp(phone: string, code: string, name?: string) {
  const message = `${name ? `Olá ${name}! ` : ""}Guarde seu cartão fidelidade: ${cardUrl(code)}\nCódigo do cartão: ${code}\nPara acessar de outro celular, informe os 4 últimos caracteres: ${code.slice(-4)}.`;
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(message)}`;
}

/** Extracts a customer code from a scanned QR (full card URL or raw code). */
export function parseScannedCode(text: string): string | null {
  const t = text.trim();
  const m = t.match(/\/c\/([A-Za-z0-9]+)/);
  if (m?.[1]) return m[1].toUpperCase();
  if (/^[A-Za-z0-9]{4,12}$/.test(t)) return t.toUpperCase();
  return null;
}

export const PAYMENTS = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "cartao", label: "Cartão" },
] as const;
