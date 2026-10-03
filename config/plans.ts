export const planLimits = {
  free: { bots: 1, contacts: 100, messages: 500 },
  pro: { bots: 5, contacts: 2000, messages: 10000 },
  business: { bots: 20, contacts: 10000, messages: 50000 },
} as const;
export function limitsFor(plan: string) {
  return planLimits[plan as keyof typeof planLimits] ?? planLimits.free;
}
