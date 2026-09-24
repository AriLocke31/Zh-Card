import { Box, Paper, Typography, Chip, Stack, Divider, Button, IconButton } from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";

import type { WordEntry } from "../types";

interface WordDetailsProps {
  word: WordEntry;
  onCreateFlashcard?: (word: WordEntry) => void;
}

export default function WordDetail({ word, onCreateFlashcard }: WordDetailsProps) {
  const preferredForm = word.forms.find((form) => form.isPreferred) ?? word.forms[0];
  const alternativeForms = word.forms.filter(form => form.id !== preferredForm?.id);;
  const primaryReading = word.readings.find(reading => reading.variety === "cmn" && reading.isStandard) ?? word.readings[0];

  return (
    <Paper elevation={0} sx={{ maxWidth: 800, mx: "auto", p: { xs: 2, sm: 4 }, border: "1px solid", borderColor: "divider", borderRadius: 3, }} >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="overline" color="primary">Word Detail </Typography>
        <IconButton aria-label="Bookmark word" disabled>
          <BookmarkBorderIcon />
        </IconButton>
      </Stack>

      <Box sx={{ mt: 2 }}>
        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: "2.8rem", sm: "3.5rem" }, }} >
          {preferredForm?.text ?? "-"}
        </Typography>
        <Typography variant="h6" color="text-secondary" sx={{ mt: 1 }}>
          {primaryReading?.display ?? primaryReading?.romanization ?? "No pronunciation"}
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
          {alternativeForms.map(form => (
            <Chip key={form.id} label={`${form.text} · ${form.script}`} variant="outlined" size="small" />
          ))}
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
          {word.tags.map(tag => (
            <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" />
          ))}
        </Stack>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box>
        <Typography variant="h5" gutterBottom>Definitions</Typography>
        <Stack spacing={3} sx={{ mt: 3 }}>
          {word.senses.map((sense, index) => (
            <Stack key={sense.id} direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
              <Box sx={{ bgcolor: "action.hover", borderRadius: 1, minWidth: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", }}>
                <Typography variant="body2">
                  {index + 1}
                </Typography>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{sense.definition}</Typography>
                {sense.partOfSpeech && (
                  <Typography variant="caption" color="text.secondary">{sense.partOfSpeech}</Typography>
                )}

                <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap" }}>
                  {sense.tags.map((tag) => (
                    <Chip key={`${tag.category}-${tag.value}`} label={tag.value} size="small" variant="outlined" />
                  ))}
                </Stack>

                {sense.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {sense.notes}
                  </Typography>
                )}

              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box>
        <Typography variant="h5" gutterBottom>
          Components
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", }, gap: 2, mt: 3, }}>
          {word.components.map((component) => (
            <Paper key={component.id} variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2, }}>
              <Typography variant="h4">
                {component.text}
              </Typography>

              <Typography variant="caption" color="text.secondary" >
                {component.type}
              </Typography>

              {component.notes && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {component.notes}
                </Typography>
              )}
            </Paper>
          ))}
        </Box>
      </Box>

      {onCreateFlashcard && (
        <Button variant="contained" fullWidth startIcon={<AddIcon />} onClick={() => onCreateFlashcard(word)} sx={{ mt: 4, py: 1.5 }}>Create Flashcard</Button>
      )}
    </Paper>
  );
}
