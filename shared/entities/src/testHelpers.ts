/**
 * Test-only escape hatch for branded id fields. Brands are compile-time-only (the
 * runtime value is just the string), so a hand-authored test fixture can't satisfy a
 * branded `Type` without either casting here or decoding the fixture through its own
 * schema first - which would make the decode assertion that follows tautological.
 */
// SAFETY: brands are compile-time-only (Id extends string, so the runtime representation is
// identical to the input) - fixtures pass plain string literals, and any real validation
// happens when the schema under test decodes the fixture downstream.
export const asId = <Id extends string>(value: string): Id => value as Id;
