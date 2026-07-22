/**
 * Test-only escape hatch for branded id fields. Brands are compile-time-only (the
 * runtime value is just the string), so a hand-authored test fixture can't satisfy a
 * branded `Type` without either casting here or decoding the fixture through its own
 * schema first - which would make the decode assertion that follows tautological.
 */
export const asId = <Id extends string>(value: string): Id => value as Id;
