import * as config from "./config";

export function ShouldCopy(summary: string, markedFree: boolean): boolean {
  const forceSharing = summary.includes(config.FORCE_SHARING_SIGN);
  return forceSharing || !markedFree;
}

export function NewSummary(summary: string, redactedSummary?: string): string {
  if (redactedSummary && !summary.includes(config.FORCE_SHARING_SIGN)) return redactedSummary;
  return summary;
}
