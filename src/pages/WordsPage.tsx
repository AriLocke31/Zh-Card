import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Alert, Box, Button, CircularProgress, Link as MuiLink, Pagination, Paper, Typography } from "@mui/material";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import type { WordEntry } from "../types";
import type { WordRepository } from "../repositories/WordRepository";
import { initialStudyOrder, moveStudyCard, type StudySession } from "../utils/studyQueue";
import { printedInkSx } from "../styles/printedInk";

interface WordsPageProps {
  repository: WordRepository;
  studySession: StudySession;
  onStudySessionChange: Dispatch<SetStateAction<StudySession>>;
}
const PAGE_SIZE = 25;

async function loadAllWords(repository: WordRepository): Promise<WordEntry[]> {
  const words: WordEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await repository.list(cursor);
    words.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return words;
}

export default function WordsPage({ repository, studySession, onStudySessionChange }: WordsPageProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const requestedPage = Number(params.get("page") ?? 1);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([loadAllWords(repository), repository.getStudyOrder()])
      .then(([loadedWords, savedStudy]) => {
        if (!active) return;
        const available = new Set(loadedWords.map(word => word.id));
        setWords(loadedWords);
        onStudySessionChange(current => {
          const order = initialStudyOrder(loadedWords, current.initialized ? current.order : savedStudy.order);
          const updatedAt = current.initialized ? current.updatedAt : savedStudy.updatedAt;
          return {
            initialized: true,
            order,
            reviewedIds: current.reviewedIds.filter(id => available.has(id)),
            ...(updatedAt ? { updatedAt } : {}),
          };
        });
      })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load the Study deck."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, retry, onStudySessionChange]);

  const pageCount = Math.max(1, Math.ceil(studySession.order.length / PAGE_SIZE));
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const wordsById = new Map(words.map(word => [word.id, word]));
  const visibleWords = studySession.order.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    .map(id => wordsById.get(id)).filter((word): word is WordEntry => Boolean(word));

  const review = (id: string, remembered: boolean) => {
    if (syncing) return;
    onStudySessionChange(current => ({
      ...current,
      order: moveStudyCard(current.order, id, remembered),
      reviewedIds: current.reviewedIds.includes(id) ? current.reviewedIds : [...current.reviewedIds, id],
    }));
    setMessage(remembered ? "Marked remembered; moved to the end of the deck." : "Marked for another try after three cards.");
    setError(null);
  };

  const sync = async () => {
    if (!studySession.reviewedIds.length || syncing) return;
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const updatedAt = await repository.syncStudyOrder(studySession.order, studySession.updatedAt);
      onStudySessionChange(current => ({ ...current, reviewedIds: [], updatedAt }));
      setMessage("Study progress synced.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sync study progress.");
    } finally {
      setSyncing(false);
    }
  };

  const returnTo = `${location.pathname}${location.search}`;
  const setPage = (page: number) => setParams(page === 1 ? {} : { page: String(page) });

  return <>
    {error && <Alert severity="error" sx={{ mb: 2 }} action={
      <Button color="inherit" onClick={() => setRetry(value => value + 1)}>Retry</Button>
    }>{error}</Alert>}
    {message && <Typography role="status" variant="body2" sx={{ mb: 2 }}>{message}</Typography>}
    <Typography variant="body2" sx={{ mb: 2 }}>Left-click a word if you remembered it. Right-click if you need another try.</Typography>
    {loading ? <CircularProgress aria-label="Loading Study deck" /> : visibleWords.length ? <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }, gap: 2 }}>
        {visibleWords.map(word => {
          const hanzi = (word.forms.find(form => form.isPreferred) ?? word.forms[0])?.text ?? "-";
          return <Paper key={word.id} variant="outlined" sx={{ minWidth: 0, textAlign: "center" }}>
            <Button fullWidth onClick={() => review(word.id, true)}
              onContextMenu={event => { event.preventDefault(); review(word.id, false); }}
              disabled={syncing} aria-label={`Mark ${hanzi} remembered; right-click if not remembered`}
              sx={{ minHeight: 125, p: 2, color: "#241b12", borderRadius: 0 }}>
              <Typography component="span" variant="h4" sx={{
                ...printedInkSx, overflowWrap: "anywhere",
                fontFamily: '"Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif',
                fontWeight: 700,
              }}>{hanzi}</Typography>
            </Button>
            <Button size="small" disabled={syncing} onClick={() => review(word.id, false)}>Again</Button>
            <MuiLink component={Link} to={`/words/${encodeURIComponent(word.id)}`}
              state={{ returnTo, returnState: location.state }} sx={{ display: "block", pb: 1 }}>Details</MuiLink>
          </Paper>;
        })}
      </Box>
    </> : !error ? <Typography>No words to study yet. Create a word to get started.</Typography> : null}
    <Box sx={{ mt: 3, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5 }}>
        <Button variant="outlined" disabled={loading || syncing || studySession.reviewedIds.length === 0} onClick={() => void sync()}>
          {syncing ? "Syncing…" : "Sync"}
        </Button>
        {studySession.reviewedIds.length > 0 && <Typography variant="caption">{studySession.reviewedIds.length} cards pending sync</Typography>}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        {pageCount > 1 && <Pagination aria-label="Study pagination" count={pageCount} page={currentPage}
          shape="rounded" disabled={loading || syncing || Boolean(error)} onChange={(_, page) => setPage(page)} />}
        <Typography variant="body2">{words.length} words</Typography>
      </Box>
    </Box>
  </>;
}
