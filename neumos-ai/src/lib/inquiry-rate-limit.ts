const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const buckets = new Map<string, number[]>();

export function isInquiryRateLimited(key: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= MAX_REQUESTS) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);

  if (buckets.size > 2000) {
    for (const [bucketKey, timestamps] of buckets) {
      if (timestamps.every((timestamp) => timestamp <= cutoff)) buckets.delete(bucketKey);
    }
  }
  return false;
}

export function resetInquiryRateLimitForTests(): void {
  buckets.clear();
}
