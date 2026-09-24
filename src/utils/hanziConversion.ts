import OpenCC from "opencc-js";

export type HanziScript =
  | "simplified"
  | "traditional";

const toTraditional = OpenCC.Converter({
  from: "cn",
  to: "tw",
});

const toSimplified = OpenCC.Converter({
  from: "tw",
  to: "tw",
});

export function convertHanzi(text: string, sourceScript: HanziScript): string {
  const input = text.trim();

  if (!input)
    return "";

  return sourceScript === "simplified" ? toTraditional(input) : toSimplified(input);
}
