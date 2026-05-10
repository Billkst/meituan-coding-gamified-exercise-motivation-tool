const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const PROTECT_STOCK_MAX = 3

export interface ShouldGrantProtectInput {
  last_protect_grant_at: string
  protect_cards: number
}

export function shouldGrantProtect(input: ShouldGrantProtectInput, now: Date): boolean {
  if (input.protect_cards >= PROTECT_STOCK_MAX) return false
  const last = new Date(input.last_protect_grant_at).getTime()
  return (now.getTime() - last) >= SEVEN_DAYS_MS
}
