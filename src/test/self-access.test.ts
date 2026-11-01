import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";

// Runs against an explicitly supplied temporary seller, never arbitrary accounts.
const slug = process.env['SELF_TEST_SLUG'];
describe.skipIf(!slug)("Server-enforced self-service card access", () => {
  const client = createClient<Database>(import.meta.env['VITE_SUPABASE_URL'], import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'], { auth: { persistSession: false, autoRefreshToken: false } });
  const phone = `619${String(Date.now()).slice(-8)}`;
  let token = "";
  let code = "";
  type Result = { status: string; token?: string; code?: string; is_new?: boolean; remaining?: number; blocked_until?: string };
  async function identify(suffix = "") {
    const { data, error } = await client.rpc("self_identify_secure", { _slug: slug ?? "", _name: "Cliente teste proteção", _whatsapp: phone, _card_suffix: suffix });
    expect(error).toBeNull();
    return data as unknown as Result;
  }
  beforeAll(async () => {
    const r = await identify();
    token = r.token ?? "";
    code = r.code ?? "";
    expect(r.status).toBe("ok");
    expect(r.is_new).toBe(true);
  });
  it("creates a new customer freely and returns their code", () => {
    expect(token.length).toBeGreaterThan(20);
    expect(code.length).toBeGreaterThanOrEqual(4);
  });
  it("requires proof for an existing WhatsApp and does not return its token", async () => {
    const r = await identify();
    expect(r.status).toBe("code_required");
    expect(r.token).toBeUndefined();
    const legacy = await client.rpc("self_identify", { _slug: slug ?? "", _name: "Cliente teste proteção", _whatsapp: phone });
    expect(legacy.error).not.toBeNull();
    expect(legacy.data).toBeNull();
  });
  it("accepts exactly the correct final four characters", async () => {
    const r = await identify(code.slice(-4).toLowerCase());
    expect(r.status).toBe("ok");
    expect(r.token).toBe(token);
    expect(r.is_new).toBe(false);
  });
  it("rejects wrong codes and blocks on the fifth error for 30 minutes", async () => {
    const before = Date.now();
    for (let attempt = 1; attempt <= 5; attempt++) {
      const r = await identify("!!!!");
      expect(r.token).toBeUndefined();
      if (attempt < 5) {
        expect(r.status).toBe("invalid_code");
        expect(r.remaining).toBe(5 - attempt);
      } else {
        expect(r.status).toBe("blocked");
        const duration = new Date(r.blocked_until ?? "").getTime() - before;
        expect(duration).toBeGreaterThanOrEqual(30 * 60 * 1000 - 10000);
        expect(duration).toBeLessThan(30 * 60 * 1000 + 10000);
      }
    }
  });
  it("rejects even a correct code while blocked", async () => {
    const r = await identify(code.slice(-4));
    expect(r.status).toBe("blocked");
    expect(r.token).toBeUndefined();
  });
  it("allows a saved device token to keep accessing the card during recovery lockout", async () => {
    const { data, error } = await client.rpc("self_card", { _slug: slug ?? "", _token: token });
    expect(error).toBeNull();
    expect((data as { code?: string })?.code).toBe(code);
  });
});