import { useState } from "react";

import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";

import WordDetail from "./components/WordDetail";
import WordEditor from "./components/WordEditor";

import { mockWord } from "./data/mockWords";

import type { WordEntry } from "./types";

type EditorMode = "view" | "edit" | "create";

export default function App() {
  const [word, setWord] = useState<WordEntry>(
    () => structuredClone(mockWord)
  );

  const [mode, setMode] =
    useState<EditorMode>("view");

  const handleSave = (updatedWord: WordEntry) => {
    setWord(updatedWord);
    setMode("view");
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 6 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Typography variant="h4" component="h1">Chinese Dictionary</Typography>

          {mode === "view" && (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setMode("create")}>New word</Button>

              <Button variant="contained" startIcon={<EditIcon />} onClick={() => setMode("edit")}>Edit word</Button>
            </Stack>
          )}
        </Stack>

        {mode === "view" ? (
          <WordDetail word={word} />
        ) : (
          <WordEditor
            key={mode === "edit" ? `edit-${word.id}` : "create"}
            word={mode === "edit" ? word : undefined}
            onSave={handleSave}
            onCancel={() => setMode("view")}
          />
        )}
      </Box>
    </Container>
  );
}
