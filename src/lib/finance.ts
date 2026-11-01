export type Period = "hoje" | "semana" | "mes";

export function periodStart(p: Period, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (p === "semana") {
    const dow = (d.getDay() + 6) % 7; // segunda = 0
    d.setDate(d.getDate() - dow);
  } else if (p === "mes") {
    d.setDate(1);
  }
  return d;
}

export type SimInput = {
  goalPerDay: number;
  price: number;
  cost: number;
  loyaltyRequired?: number;
  rewardQty?: number;
  rewardCost?: number;
  workDays?: number;
};

/** Lucro diário/mensal estimado vendendo `goalPerDay` unidades do produto, descontando brindes da fidelidade. */
export function simulate({ goalPerDay, price, cost, loyaltyRequired, rewardQty = 0, rewardCost = 0, workDays = 26 }: SimInput) {
  const revenue = goalPerDay * price;
  const productCost = goalPerDay * cost;
  const rewardsCost = loyaltyRequired && loyaltyRequired > 0 ? (goalPerDay / loyaltyRequired) * rewardQty * rewardCost : 0;
  const daily = revenue - productCost - rewardsCost;
  return { revenue, productCost, rewardsCost, daily, monthly: daily * workDays };
}

export function grossProfit(revenue: number, cost: number, rewardsCost: number) {
  return revenue - cost - rewardsCost;
}
