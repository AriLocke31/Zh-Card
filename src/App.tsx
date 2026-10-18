import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import WordDetail from "./components/WordDetail";
import WordEditor from "./components/WordEditor";
import { configurationError, repository } from "./config";
import type { WordEntry } from "./types";

type EditorMode = "view" | "edit" | "create";
const message = (error: unknown) => error instanceof Error ? error.message : "The request failed. Please try again.";

export default function App() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [word, setWord] = useState<WordEntry | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [mode, setMode] = useState<EditorMode>("view");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const request = useRef(0);

  const load = async (next?: string) => {
    const current = ++request.current;
    setBusy(true); setError(null);
    try {
      const page = await repository.list(next);
      if (current !== request.current) return;
      setWords(previous => next ? [...new Map([...previous, ...page.items].map(item => [item.id, item])).values()] : page.items);
      setCursor(page.nextCursor);
      if (!next) setWord(page.items[0] ?? null);
    } catch (error) { if (current === request.current) setError(message(error)); }
    finally { if (current === request.current) setBusy(false); }
  };

  useEffect(() => {
    if (!configurationError) void load();
    return () => { request.current++; };
  }, []);

  const select = async (id: string) => {
    const current = ++request.current;
    setBusy(true); setError(null); setNotice(null);
    try {
      const selected = await repository.getById(id);
      if (current !== request.current) return;
      setWord(selected);
      if (!selected) setError("This word no longer exists. Reload the list.");
    } catch (error) { if (current === request.current) setError(message(error)); }
    finally { if (current === request.current) setBusy(false); }
  };

  const handleSave = async (draft: WordEntry) => {
    if (saving) return;
    setSaving(true); setSaveError(null);
    try {
      const saved = mode === "create" ? await repository.create(draft) : await repository.update(draft);
      setWord(saved);
      setWords(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
      setMode("view"); setNotice("Word saved.");
    } catch (error) { setSaveError(message(error)); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!word || busy) return;
    setBusy(true); setError(null);
    try {
      await repository.delete(word.id, word.updatedAt);
      setWords(previous => previous.filter(item => item.id !== word.id));
      setWord(null); setDeleting(false); setNotice("Word deleted.");
    } catch (error) { setDeleting(false); setError(message(error)); }
    finally { setBusy(false); }
  };

  const start = (mode: EditorMode) => { setMode(mode); setSaveError(null); setNotice(null); };
  return <Container maxWidth="lg"><Box sx={{ py: 6 }}>
    <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}>
      <Typography variant="h4" component="h1">Chinese Dictionary</Typography>
    </Stack>
    {configurationError ? <Alert severity="warning">Dictionary connection is not configured. Set {configurationError} in .env.local using .env.example, then restart Vite.</Alert> : <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      <>
        {mode === "view" ? <>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 3, flexWrap: "wrap" }}>
            <Button disabled={busy} onClick={() => start("create")}>New word</Button>
            <Button disabled={busy || !word} onClick={() => start("edit")}>Edit word</Button>
            <Button disabled={busy || !word} color="error" onClick={() => setDeleting(true)}>Delete word</Button>
            <Button disabled={busy} onClick={() => void load()}>Reload list</Button>
            {cursor && <Button disabled={busy} onClick={() => void load(cursor)}>Load more</Button>}
          </Stack>
          {words.length > 0 && <TextField select fullWidth label="Word" value={word?.id ?? ""} disabled={busy}
            onChange={event => void select(event.target.value)} sx={{ mb: 3 }}>
            {words.map(item => <MenuItem key={item.id} value={item.id}>{item.forms.find(form => form.isPreferred)?.text ?? item.forms[0]?.text}</MenuItem>)}
          </TextField>}
          {busy && <CircularProgress aria-label="Loading dictionary" />}
          {word ? <WordDetail word={word} /> : !busy && !error && <Typography>No word selected. Choose a word or create one.</Typography>}
        </> : <WordEditor key={mode === "edit" ? `edit-${word?.id}` : "create"}
          word={mode === "edit" ? word ?? undefined : undefined} saving={saving} saveError={saveError}
          onSave={handleSave} onCancel={() => { setMode("view"); setSaveError(null); }} />}
      </>
    </>}
    <Dialog open={deleting} onClose={() => { if (!busy) setDeleting(false); }}>
      <DialogTitle>Delete this word?</DialogTitle><DialogContent>This permanently removes the saved entry.</DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setDeleting(false)}>Cancel</Button>
        <Button color="error" disabled={busy} onClick={() => void remove()}>Delete</Button></DialogActions>
    </Dialog>
  </Box></Container>;
}
