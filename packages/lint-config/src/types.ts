export interface RuleContext {
  report: (opts: {
    node: unknown;
    message: string;
    fix?: (fixer: Fixer) => Fix;
  }) => void;
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
