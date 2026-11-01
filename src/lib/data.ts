import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Product = { id: string; name: string; price: number; cost: number | null; active: boolean };
export type ComboItem = { product_id: string; qty: number };
export type Combo = {
  id: string;
  name: string;
  items: ComboItem[];
  reward_product_id: string | null;
  reward_qty: number;
  price: number;
  active: boolean;
};

export async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Não autenticado");
  return data.user.id;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const id = await uid();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at");
    if (error) throw error;
    return (data ?? []).map((p) => ({ ...p, price: Number(p.price), cost: p.cost == null ? null : Number(p.cost) })) as Product[];
  },
});

export const combosQuery = queryOptions({
  queryKey: ["combos"],
  queryFn: async () => {
    const { data, error } = await supabase.from("combos").select("*").order("created_at");
    if (error) throw error;
    return (data ?? []).map((c) => ({ ...c, price: Number(c.price), items: (c.items as unknown as ComboItem[]) ?? [] })) as Combo[];
  },
});

export const loyaltyQuery = queryOptions({
  queryKey: ["loyalty"],
  queryFn: async () => {
    const { data, error } = await supabase.from("loyalty").select("*").maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const isAdminQuery = queryOptions({
  queryKey: ["is-admin"],
  queryFn: async () => {
    const id = await uid();
    const { data } = await supabase.rpc("has_role", { _user_id: id, _role: "admin" });
    return !!data;
  },
});

export function planState(p: { plan: string; plan_expires_at: string } | undefined) {
  if (!p) return { blocked: false, daysLeft: 0, label: "" };
  const daysLeft = Math.ceil((new Date(p.plan_expires_at).getTime() - Date.now()) / 86400000);
  if (p.plan === "suspended") return { blocked: true, daysLeft, label: "Suspenso" };
  if (p.plan === "trial") return { blocked: daysLeft <= 0, daysLeft, label: "Teste grátis" };
  return { blocked: false, daysLeft, label: "Ativo" };
}

export const activeQuery = queryOptions({
  queryKey: ["vendor-active"],
  queryFn: async () => {
    const id = await uid();
    const { data } = await supabase.rpc("vendor_is_active", { _uid: id });
    return !!data;
  },
});
