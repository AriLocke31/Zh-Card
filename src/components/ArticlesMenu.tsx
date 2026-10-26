import { Box, Pagination, Stack, Typography } from "@mui/material";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { articles as localArticles } from "../data/articles";
import type { ArticleData } from "../types";

interface ArticlesMenuProps { articles?: ArticleData[] }
const PAGE_SIZE = 3;

export default function ArticlesMenu({ articles = localArticles }: ArticlesMenuProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const count = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const requested = Number(params.get("page") ?? 1);
  const page = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, count) : 1;
  const items = articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <>
    <Stack spacing={3}>
      {items.map(article => <Box key={article.id} component={Link} to={`/articles/${encodeURIComponent(article.id)}`}
        state={{ returnTo: `${location.pathname}${location.search}` }} sx={{
          display: "block", color: "inherit", textDecoration: "none", pb: 3, borderBottom: "1px solid #000",
          "&:hover h2, &:focus-visible h2": { textDecoration: "underline", textDecorationColor: "#8b1e1e" },
        }}>
        <Typography component="h2" variant="h5" sx={{ mb: 1, fontFamily: 'Georgia, "Times New Roman", serif' }}>{article.title}</Typography>
        <Typography sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.summary}</Typography>
      </Box>)}
      {!articles.length && <Typography>No articles yet.</Typography>}
    </Stack>
    {count > 1 && <Pagination aria-label="Articles pagination" count={count} page={page} shape="rounded" sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}
      onChange={(_, page) => { const next = new URLSearchParams(params); if (page === 1) next.delete("page"); else next.set("page", String(page)); setParams(next); }} />}
  </>;
}
