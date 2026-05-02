export function trackEvent(event: string, payload: Record<string, unknown>) {
  console.log(`[analytics] ${event}`, payload);
}
