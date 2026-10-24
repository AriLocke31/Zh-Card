import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
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
  const go = (cursor: string | undefined, history: string[]) => navigate({
    pathname: "/words", search: cursor ? `?${new URLSearchParams({ cursor })}` : "",
  }, { state: { previous: history } });

  return <>
    {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setRetry(value => value + 1)}>Retry</Button>}>{error}</Alert>}
    {pending ? <CircularProgress aria-label="Loading words" /> : !error && page && <>
      {page.items.length ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }, gap: 2 }}>
        {page.items.map(word => <WordThumb key={word.id} word={word}
          returnTo={`${location.pathname}${location.search}`} returnState={location.state} />)}
      </Box> : <Typography>{cursor ? "No words on this page." : "No words yet. Add a new word to get started."}</Typography>}
    </>}
    <Stack component="nav" aria-label="Words pagination" direction="row" spacing={2} sx={{ mt: 3, alignItems: "center" }}>
      <Button disabled={pending || !cursor} onClick={() => go(previous.at(-1) || undefined, previous.slice(0, -1))}>Previous</Button>
      <Button disabled={pending || Boolean(error) || !page?.nextCursor}
        onClick={() => { if (page?.nextCursor) go(page.nextCursor, [...previous, cursor ?? ""]); }}>Next</Button>
    </Stack>
  </>;
}
