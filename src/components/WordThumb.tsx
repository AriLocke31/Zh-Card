import { Box, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import type { WordEntry } from "../types";
import { printedInkSx } from "../styles/printedInk";

interface WordThumbProps {
  word: WordEntry;
  returnTo?: string;
  returnState?: unknown;
}

/** A word's preferred written form, linked to its detail route. */
export default function WordThumb({ word, returnTo = "/words", returnState }: WordThumbProps) {
  const hanzi = (word.forms.find(form => form.isPreferred) ?? word.forms[0])?.text ?? "-";
  return <Box component={Link} to={`/words/${encodeURIComponent(word.id)}`}
      state={{ returnTo, returnState }} sx={{
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: 140, p: 3, color: "#241b12", textDecoration: "none",
        "&:hover span, &:focus-visible span": {
          textDecorationLine: "underline", textDecorationColor: "#b22222",
          textDecorationThickness: "2px", textUnderlineOffset: "0.18em",
        },
      }}>
      <Typography component="span" variant="h4" sx={{
        ...printedInkSx,
        display: "block", textAlign: "center", overflowWrap: "anywhere",
        fontFamily: '"Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif',
        fontWeight: 700,
      }}>
        {hanzi}
      </Typography>
    </Box>;
}
