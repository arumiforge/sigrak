/**
 * A school-year rule the operator broke (overlapping year, class name
 * taken, closed year…). `field` is the form field the message belongs
 * to, or null for a page-level message; `key` is a `classes.*` lang key
 * with its parameters.
 */
export class SchoolYearRuleError extends Error {
  constructor(
    readonly field: string | null,
    readonly key: string,
    readonly params: Record<string, string | number> = {}
  ) {
    super(key)
  }
}
