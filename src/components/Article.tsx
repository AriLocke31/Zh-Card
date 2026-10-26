import { Box, Stack, Typography } from "@mui/material";
import type { ArticleData } from "../types";

interface ArticleProps { article: ArticleData }

export default function Article({ article }: ArticleProps) {
  return <Box component="article">
    <Typography component="h2" variant="h4" sx={{ mb: 3, textAlign: "center", fontFamily: 'Georgia, "Times New Roman", serif' }}>{article.title}</Typography>
    <Stack spacing={0}>
      {article.sections.map(section => <Box component="section" key={section.id} role="region"
        aria-label={section.title} tabIndex={0} sx={{
          border: "1px solid #000", borderRadius: 0, backgroundColor: "transparent",
          p: { xs: 2, sm: 3 }, maxHeight: 320, overflowY: "auto", overflowWrap: "anywhere",
          scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" },
          "& + section": { borderTop: 0 },
          "&:focus-visible": { outline: "2px solid #8b1e1e", outlineOffset: 3 },
        }}>
        <Typography component="h3" variant="h5" sx={{ mb: 2 }}>{section.title}</Typography>
        {section.paragraphs.map((paragraph, index) => <Typography key={index} component="p"
          sx={{ m: 0, mb: 2, lineHeight: 1.8, whiteSpace: "pre-wrap", "&:last-child": { mb: 0 } }}>{paragraph}</Typography>)}
      </Box>)}
    </Stack>
  </Box>;
}
