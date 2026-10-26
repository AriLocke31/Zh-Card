import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Pagination, Typography } from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import WordThumb from "../components/WordThumb";
import type { WordPage, WordRepository } from "../repositories/WordRepository";

interface WordsPageProps { repository: WordRepository }

export default function WordsPage({ repository }: WordsPageProps) {
  const [params] = useSearchParams();
  const cursor = params.get("cursor") || undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const previous: string[] = Array.isArray(location.state?.previous) && location.state.previous.every((value: unknown) => typeof value === "string")
    ? location.state.previous : [];
  const [result, setResult] = useState<{ cursor: string | undefined; page: WordPage } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    repository.list(cursor).then(page => { if (active) setResult({ cursor, page }); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load words."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, cursor, retry]);

  const page = result && result.cursor === cursor ? result.page : null;
  const pending = loading || (!page && !error);
  // GET /words has no total count: offer discovered pages and the next cursor.
  const known: string[] = Array.isArray(location.state?.cursors) && location.state.cursors.every((value: unknown) => typeof value === "string")
    ? location.state.cursors : [];
  const currentPage = previous.length + 1;
  let cursors = known[previous.length] === (cursor ?? "") ? [...known] : [...previous, cursor ?? ""];
  if (page) {
    if (page.nextCursor) {
      if (cursors[currentPage] !== page.nextCursor) cursors = [...cursors.slice(0, currentPage), page.nextCursor];
    } else cursors = cursors.slice(0, currentPage);
  }
  const go = (cursor: string | undefined, history: string[]) => navigate({
    pathname: "/words", search: cursor ? `?${new URLSearchParams({ cursor })}` : "",
  }, { state: { previous: history, cursors } });

  return <>
    {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setRetry(value => value + 1)}>Retry</Button>}>{error}</Alert>}
    {pending ? <CircularProgress aria-label="Loading words" /> : !error && page && <>
      {page.items.length ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }, gap: 2 }}>
        {page.items.map(word => <WordThumb key={word.id} word={word}
          returnTo={`${location.pathname}${location.search}`} returnState={location.state} />)}
      </Box> : <Typography>{cursor ? "No words on this page." : "No words yet. Add a new word to get started."}</Typography>}
    </>}
    {cursors.length > 1 && <Pagination aria-label="Words pagination" count={cursors.length} page={currentPage}
      shape="rounded" disabled={pending || Boolean(error)} sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}
      onChange={(_, target) => go(cursors[target - 1] || undefined, cursors.slice(0, target - 1))} />}
  </>;
}
