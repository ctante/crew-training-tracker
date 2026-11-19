export function sessionSurface(input: { overdue?: boolean; stalled?: boolean; dueToday?: boolean }): string {
  if (input.stalled || input.overdue) return "border-red-300 bg-red-100";
  if (input.dueToday) return "border-green-300 bg-green-100";
  return "border-line bg-card";
}
