export interface RuleContext {
  /** Absolute path of the file being linted. */
  filename: string;
  /** Rule options for this rule on this file (`options[0]` is the first arg after severity). */
  options: readonly unknown[];
  report: (opts: { node: unknown; message: string; fix?: (fixer: Fixer) => Fix }) => void;
  getSourceCode: () => SourceCode;
}

export interface Fixer {
  replaceText: (node: unknown, text: string) => Fix;
}

export interface Fix {
  range: [number, number];
  text: string;
}

export interface SourceCode {
  getText: (node: unknown) => string;
}
