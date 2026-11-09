export type EditorSection = "forms" | "readings" | "senses" | "tags";
interface ShortcutKey {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
  repeat?: boolean;
}
export type EditorShortcut = { action: "save" } | { action: "add"; section: EditorSection };

export function editorShortcut(key: ShortcutKey, section: EditorSection | null): EditorShortcut | null {
  if (key.isComposing || key.repeat || key.altKey || key.metaKey) return null;
  if (key.ctrlKey && key.key === "Enter") return { action: "save" };
  if (!section) return null;
  if (key.ctrlKey && !key.shiftKey && key.key.toLowerCase() === "a" && section !== "tags") return { action: "add", section };
  if (key.ctrlKey) return null;
  if (key.key === "Tab" && !key.shiftKey) {
    const next = { forms: "readings", readings: "senses", senses: "tags", tags: null } as const;
    if (next[section]) return { action: "add", section: next[section] };
  }
  return null;
}
