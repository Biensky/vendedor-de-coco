import { describe, expect, it } from "vitest";
import { simulate, periodStart } from "@/lib/finance";

describe("simulação", () => {
  it("10 cocos/dia a R$8 com custo R$2 = R$60/dia sem brindes", () => {
    const r = simulate({ goalPerDay: 10, price: 8, cost: 2 });
    expect(r.daily).toBe(60);
    expect(r.monthly).toBe(1560); // 26 dias
  });
  it("desconta 1 coco grátis a cada 10 (custo R$2)", () => {
    const r = simulate({ goalPerDay: 10, price: 8, cost: 2, loyaltyRequired: 10, rewardQty: 1, rewardCost: 2 });
    expect(r.daily).toBe(58);
  });
});

describe("período", () => {
  it("semana começa na segunda", () => {
    const d = periodStart("semana", new Date(2026, 10, 1, 15)); // domingo 1/11/2026
    expect(d.getDate()).toBe(26);
    expect(d.getDay()).toBe(1);
  });
});
