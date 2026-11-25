export type Offer = {
  id: string;
  name: string;
  method: "notice" | "percent" | "fixed" | "price";
  amount: number;
  minimum: number;
  priority: number;
  stacking: boolean;
  targets: string[];
};

export function applyOffers(unit: number, quantity: number, offers: Offer[]) {
  let total = unit * quantity;
  const applied: string[] = [];
  const eligible = offers.filter(offer => offer.method !== "notice" && offer.minimum <= quantity)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const offer of eligible) {
    if (applied.length && !offer.stacking) continue;
    const groups = Math.floor(quantity / offer.minimum);
    const discount = offer.method === "percent" ? Math.round(total * offer.amount / 100)
      : offer.method === "fixed" ? offer.amount * groups
      : Math.max(0, unit * offer.minimum - offer.amount) * groups;
    if (discount <= 0) continue;
    total = Math.max(0, total - discount);
    applied.push(offer.name);
    if (!offer.stacking || total === 0) break;
  }
  return { total, applied };
}
