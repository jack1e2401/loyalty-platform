/** Returns whether reversing an event may change the member's current qualification cycle. */
export function isQualificationContributionInCurrentCycle(
  occurredAt: Date | null,
  lastResetAt: Date | null,
): boolean {
  return occurredAt === null || lastResetAt === null || occurredAt.getTime() >= lastResetAt.getTime();
}
