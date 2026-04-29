export function formatZodError(error: any): string {
  const issues = error?.issues || error?.errors || [];
  return issues.map((e: any) => e.message).join(", ");
}