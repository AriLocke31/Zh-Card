import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import WordDetail from "../components/WordDetail";
import WordEditor from "../components/WordEditor";
import type { WordEntry } from "../types";
import type { WordRepository } from "../repositories/WordRepository";

interface WordPageProps { repository: WordRepository; creating?: boolean; onSavingChange: (saving: boolean) => void }
type CreationType = "Word" | "Article" | "Sentence";

export default function WordPage({ repository, creating = false, onSavingChange }: WordPageProps) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [word, setWord] = useState<WordEntry | null>(null);
  const [loading, setLoading] = useState(!creating);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(creating);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [creationType, setCreationType] = useState<CreationType>("Word");
  const returnTo = typeof location.state?.returnTo === "string" && /^\/words(?:\?|$)/.test(location.state.returnTo)
    ? location.state.returnTo : "/words";
  const returnState: unknown = location.state?.returnState;

  useEffect(() => {
    if (creating || !id) return;
    let active = true;
    setLoading(true); setError(null); setWord(null); setEditing(false);
    repository.getById(id).then(word => {
      if (!active) return;
      setWord(word);
      if (!word) setError("This word no longer exists.");
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load word."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, creating, repository, retry]);

  const save = async (draft: WordEntry) => {
    if (saving) return;
    setSaving(true); onSavingChange(true); setSaveError(null);
    try {
      const saved = creating ? await repository.create(draft) : await repository.update(draft);
      setWord(saved); setEditing(false); setNotice("Word saved.");
      if (creating) navigate(`/words/${encodeURIComponent(saved.id)}`, { replace: true, state: { returnTo, returnState } });
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save word."); }
    finally { setSaving(false); onSavingChange(false); }
  };
  const remove = async () => {
    if (!word || saving) return;
    setSaving(true); onSavingChange(true); setError(null);
    try { await repository.delete(word.id, word.updatedAt); navigate(returnTo, { state: returnState }); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not delete word."); setDeleting(false); }
    finally { setSaving(false); onSavingChange(false); }
  };

  return <>
    {creating ? <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
      <TextField select label="Create" value={creationType} disabled={saving} size="small"
        onChange={event => setCreationType(event.target.value as CreationType)} sx={{
          minWidth: 160,
          "& .MuiOutlinedInput-root": {
            borderRadius: 0,
            color: "#000",
          },
          "& .MuiInputLabel-root, & .MuiInputLabel-root.Mui-focused": { color: "#000" },
          "& .MuiSelect-icon": { color: "#000" },
        }}>
        <MenuItem value="Word">Word</MenuItem>
        <MenuItem value="Article">Article</MenuItem>
        <MenuItem value="Sentence">Sentence</MenuItem>
      </TextField>
    </Box> : <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
      <Button component={Link} to={returnTo} state={returnState} disabled={saving}>Back to words</Button>
      {!creating && !editing && word && <>
        <Button disabled={loading || saving} onClick={() => { setEditing(true); setNotice(null); setSaveError(null); }}>Edit word</Button>
        <Button disabled={loading || saving} color="error" onClick={() => setDeleting(true)}>Delete word</Button>
      </>}
    </Stack>}
    {error && <Alert severity="error" sx={{ mb: 2 }} action={!word && !creating ? <Button onClick={() => setRetry(value => value + 1)}>Retry</Button> : undefined}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    {creating && creationType !== "Word" && <Typography>{creationType} editor is not available yet.</Typography>}
    <Box hidden={creating && creationType !== "Word"}>
    {loading ? <CircularProgress aria-label="Loading word" /> : editing ? <WordEditor word={word ?? undefined}
      saving={saving} saveError={saveError} onSave={save} onCancel={() => {
        if (creating) navigate(returnTo, { state: returnState });
        else { setEditing(false); setSaveError(null); }
      }} /> : word && <WordDetail word={word} />}
    </Box>
    <Dialog open={deleting} onClose={() => { if (!saving) setDeleting(false); }}>
      <DialogTitle>Delete this word?</DialogTitle><DialogContent>This permanently removes the saved entry.</DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setDeleting(false)}>Cancel</Button>
        <Button disabled={saving} color="error" onClick={() => void remove()}>Delete</Button></DialogActions>
    </Dialog>
  </>;
}
