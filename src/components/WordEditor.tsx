import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { Box, Paper, Stack, Typography, TextField, Button, IconButton, Chip, Divider, MenuItem, FormControlLabel, Checkbox, Autocomplete, Alert } from "@mui/material";
import { WordEntry, WrittenForm, Reading, Sense, SenseTag, WordComponent, PartOfSpeech, } from "../types";
import { isValidNumberedPinyin, parsePinyin } from "../utils/pinyin";
import { convertHanzi } from "../utils/hanziConversion";
import SenseTagInput from "./SenseTagInput";
import PinyinInput from "./PinyinInput";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";

interface WordEditorProps {
  word?: WordEntry | undefined;
  onSave: (word: WordEntry) => void;
  onCancel: () => void;
}

const createEmptyWord = (): WordEntry => {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    forms: [],
    readings: [],
    senses: [],
    components: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
};

const partOfSpeechOptions: PartOfSpeech[] = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "classifier",
  "particle",
  "conjunction",
  "preposition",
  "interjection",
  "other",
];

export default function WordEditor({ word, onSave, onCancel }: WordEditorProps) {
  const [draft, setDraft] = useState<WordEntry>(() => structuredClone(word ?? createEmptyWord()));
  const [error, setError] = useState<string | null>(null);

  const addForm = () => {
    const newForm: WrittenForm = {
      id: uuidv4(),
      text: "",
      script: "simplified",
      isPreferred: draft.forms.length === 0,
    };

    setDraft(prev => ({ ...prev, forms: [...prev.forms, newForm], }));
  };

  const updateForm = (id: string, changes: Partial<WrittenForm>) => {
    setDraft(prev => ({
      ...prev,
      forms: prev.forms.map(form => form.id === id ? { ...form, ...changes } : form),
    })
    );
  }

  const removeForm = (id: string) => {
    setDraft(prev => {
      const remaining = prev.forms.filter(form => form.id !== id);
      const hasPreferred = remaining.some(form => form.isPreferred);

      const forms = remaining.map((form, idx) => ({
        ...form,
        isPreferred: hasPreferred ? form.isPreferred : idx === 0
      }));

      return { ...prev, forms };
    });
  };

  const setPreferredForm = (id: string) => {
    setDraft(prev => ({
      ...prev,
      forms: prev.forms.map(form => ({
        ...form,
        isPreferred: form.id === id,
      })),
    }));
  }

  const addReading = () => {
    const reading: Reading = {
      id: uuidv4(),
      variety: "cmn",
      system: "pinyin",
      romanization: "",
      display: "",
      senseIds: [],
      isStandard: true,
      tags: [],
    };

    setDraft((prev) => ({ ...prev, readings: [...prev.readings, reading], }));
  }

  const updateReading = (id: string, changes: Partial<Reading>) => {
    setDraft((prev) => ({ ...prev, readings: prev.readings.map(reading => reading.id === id ? { ...reading, ...changes } : reading), }));
  }

  const removeReading = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      readings: prev.readings.filter(reading => reading.id !== id),
      senses: prev.senses.map(sense => ({ ...sense, readingIds: sense.readingIds.filter(readingId => readingId !== id) })),
    }));
  };

  const addSense = () => {
    const now = new Date().toISOString();

    const sense: Sense = {
      id: uuidv4(),
      definition: "",
      language: "en",
      tags: [],
      readingIds: [],
      notes: "",
      createdAt: now,
      updatedAt: now,
    };

    setDraft((prev) => ({ ...prev, senses: [...prev.senses, sense], }));
  };

  const updateSense = (id: string, changes: Partial<Sense>) => {
    setDraft((prev) => ({
      ...prev,
      senses: prev.senses.map((sense) => sense.id === id ? { ...sense, ...changes } : sense),
    }));
  };

  const removeSense = (id: string) => {
    setDraft((prev) => ({
      ...prev,

      senses: prev.senses.filter(
        (sense) => sense.id !== id
      ),

      readings: prev.readings.map((reading) => ({
        ...reading,
        senseIds: reading.senseIds.filter(
          (senseId) => senseId !== id
        ),
      })),
    }));
  };

  const addSenseTag = (senseId: string, tag: SenseTag) => {
    setDraft((prev) => ({
      ...prev,

      senses: prev.senses.map((sense) => {
        if (sense.id !== senseId) {
          return sense;
        }

        const exists = sense.tags.some(
          (existing) =>
            existing.category === tag.category &&
            existing.value === tag.value
        );

        if (exists) {
          return sense;
        }

        return {
          ...sense,
          tags: [...sense.tags, tag],
        };
      }),
    }));
  };

  const removeSenseTag = (senseId: string, tag: SenseTag) => {
    setDraft((prev) => ({
      ...prev,

      senses: prev.senses.map((sense) =>
        sense.id === senseId ? {
          ...sense,
          tags: sense.tags.filter(
            (existing) =>
              existing.category !== tag.category ||
              existing.value !== tag.value
          ),
        }
          : sense
      ),
    }));
  };

  const acceptConvertedForm = (convertedText: string, targetScript: "simplified" | "traditional") => {
    setDraft(prev => {
      const existing = prev.forms.find(form => form.script === targetScript);

      if (existing)
        return prev;

      return {
        ...prev,
        forms: [
          ...prev.forms,
          {
            id: uuidv4(),
            text: convertedText,
            script: targetScript,
            isPreferred: false,
          },
        ],
      };
    });
  };

  const handleSave = () => {
    const forms = draft.forms.map((form) => ({
      ...form, text: form.text.trim(),
    }));

    const readings = draft.readings.map((reading) => {
      const display = reading.display?.trim();

      return {
        ...reading,
        romanization: reading.romanization.trim(),
        ...(display ? { display } : { display: "" }),
      };
    });

    const senses = draft.senses.map((sense) => ({
      ...sense,
      definition: sense.definition.trim(),
      language: sense.language.trim(),
      updatedAt: new Date().toISOString(),
    }));

    if (
      forms.length === 0 ||
      forms.some((form) => !form.text)
    ) {
      setError("Add at least one complete written form.");
      return;
    }

    if (
      senses.length === 0 ||
      senses.some((sense) => !sense.definition || !sense.language)
    ) {
      setError("Add at least one complete definition.");
      return;
    }

    if (readings.some((reading) => !reading.romanization)) {
      setError("Complete or remove empty pronunciations.");
      return;
    }

    if (readings.some(reading => reading.system === "pinyin" && parsePinyin(reading.romanization) === null)) {
      setError("Every syllable must be valid and have an explicit tone.");
      return;
    }

    const readingIds = new Set(readings.map((r) => r.id));
    const senseIds = new Set(senses.map((s) => s.id));

    if (
      senses.some((sense) =>
        sense.readingIds.some((id) => !readingIds.has(id))
      )
    ) {
      setError("A definition references a missing pronunciation.");
      return;
    }

    if (readings.some((reading) => reading.system === "pinyin" && !isValidNumberedPinyin(reading.romanization))) {
      setError("Select a valid Pinyin syllable and tone");
      return;
    }

    // Sense.readingIds is the editable source of truth.
    const synchronizedReadings: Reading[] = readings.map(
      (reading) => {
        const parsed = reading.system === "pinyin" ? parsePinyin(reading.romanization) : null;

        const senseIdsForReading = senses.filter(
          (sense) => sense.readingIds.includes(reading.id))
          .map((sense) => sense.id);

        // Remove display from the original object so that
        // exactOptionalPropertyTypes is satisfied.
        const { display: _oldDisplay, ...rest } = reading;

        const normalizedDisplay = parsed?.display ?? reading.display?.trim();

        return {
          ...rest,
          romanization: parsed?.canonical ?? reading.romanization,
          senseIds: senseIdsForReading,
          ...(normalizedDisplay ? { display: normalizedDisplay } : {}),
        };
      }
    );
    setError(null);

    onSave({
      ...draft,
      forms,
      readings: synchronizedReadings,
      senses,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        maxWidth: 900,
        mx: "auto",
        p: { xs: 2, sm: 4 },
        borderRadius: 3,
      }}
    >
      {/* Header */}

      <Stack direction="row" sx={{ mb: 4, justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4">{word ? "Edit word" : "New word"}</Typography>

          <Typography color="text.secondary">Manage dictionary information</Typography>
        </Box>

        <Chip label="Draft" color="primary" />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Written forms */}

      <Typography variant="h5" gutterBottom>Written forms</Typography>

      <Stack spacing={2} sx={{ mt: 2 }}>
        {draft.forms.map((form) => {
          const targetScript = form.script === "simplified" ? "traditional"
            : form.script === "traditional" ? "simplified" : null;

          const suggestion = targetScript ? convertHanzi(form.text, form.script as "simplified" | "traditional") : "";
          const targetAlreadyExists = targetScript ? draft.forms.some(other => other.script === targetScript) : true;

          const showSuggestion = targetScript !== null && suggestion.length > 0 && suggestion !== form.text && !targetAlreadyExists;

          return (
            <Paper key={form.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: "center" }}>
                  <TextField
                    label="Hanzi"
                    value={form.text}
                    onChange={(event) =>
                      updateForm(form.id, {
                        text: event.target.value,
                      })
                    }
                    fullWidth
                    required
                  />

                  <IconButton aria-label="Remove written form" onClick={() => removeForm(form.id)}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>

                <TextField select label="Script" value={form.script}
                  onChange={(event) =>
                    updateForm(form.id, {
                      script: event.target.value as WrittenForm["script"],
                    })
                  }
                  fullWidth>
                  <MenuItem value="simplified">Simplified</MenuItem>
                  <MenuItem value="traditional">Traditional</MenuItem>
                  <MenuItem value="both">Both</MenuItem>
                  <MenuItem value="variant">Variant</MenuItem>
                </TextField>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.isPreferred}
                      onChange={() =>
                        setPreferredForm(form.id)
                      }
                    />
                  }
                  label="Preferred form"
                />
              </Stack>

              {showSuggestion && targetScript && (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="body2" color="textSecondary">Suggested {targetScript}: </Typography>
                  <Button size="small" variant="outlined" onClick={() => acceptConvertedForm(suggestion, targetScript)}>+ {suggestion}</Button>
                </Stack>
              )}
            </Paper>
          );
        })}

        <Button startIcon={<AddIcon />} onClick={addForm} variant="outlined">Add written form</Button>
      </Stack>

      <Divider sx={{ my: 4 }} />

      {/* Pronunciations */}

      <Typography variant="h5" gutterBottom>Pronunciations</Typography>

      <Stack spacing={2} sx={{ mt: 2 }}>
        {draft.readings.map((reading) => (
          <Paper key={reading.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <TextField select label="Language variety" value={reading.variety}
                  onChange={(event) => {
                    const variety =
                      event.target.value as Reading["variety"];

                    updateReading(reading.id, {
                      variety,
                      system:
                        variety === "cmn"
                          ? "pinyin"
                          : "jyutping",
                      romanization: "",
                      display: "",
                    });
                  }}
                  fullWidth>
                  <MenuItem value="cmn">Mandarin</MenuItem>
                  <MenuItem value="yue">Cantonese</MenuItem>
                </TextField>

                <IconButton aria-label="Remove pronunciation" onClick={() => removeReading(reading.id)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>

              {reading.system === "pinyin" ? (
                <PinyinInput key={`${reading.id}-${reading.system}`} romanization={reading.romanization} display={reading.display}
                  onChange={(romanization, display) => {
                    updateReading(reading.id, { romanization, display });
                  }}
                />
              ) : (
                <TextField label="Jyutping" value={reading.romanization}
                  onChange={(event) =>
                    updateReading(reading.id, { romanization: event.target.value, })
                  }
                  placeholder="din6 nou5" fullWidth
                />
              )}

              <TextField label="Display pronunciation" value={reading.display ?? ""} onChange={(event) =>
                updateReading(reading.id, {
                  display: event.target.value,
                })
              }
                placeholder="diànnǎo" fullWidth />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={reading.isStandard}
                    onChange={(event) =>
                      updateReading(reading.id, {
                        isStandard: event.target.checked,
                      })
                    }
                  />
                }
                label="Standard pronunciation" />
            </Stack>
          </Paper>
        ))}

        <Button startIcon={<AddIcon />} onClick={addReading} variant="outlined">Add pronunciation</Button>
      </Stack>

      <Divider sx={{ my: 4 }} />

      {/* Definitions */}

      <Typography variant="h5" gutterBottom>Definitions</Typography>

      <Stack spacing={2} sx={{ mt: 2 }}>
        {draft.senses.map((sense, index) => (
          <Paper key={sense.id} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack spacing={3}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle1">Sense {index + 1}</Typography>

                <IconButton aria-label="Remove definition" onClick={() => removeSense(sense.id)}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>

              <TextField
                label="Definition"
                value={sense.definition}
                onChange={(event) =>
                  updateSense(sense.id, {
                    definition: event.target.value,
                  })
                }
                multiline minRows={2} fullWidth required />

              <TextField
                select
                label="Part of speech"
                value={sense.partOfSpeech ?? ""}
                onChange={(event) =>
                  updateSense(sense.id, {
                    partOfSpeech:
                      event.target.value
                        ? event.target.value as PartOfSpeech
                        : undefined,
                  })
                }
                fullWidth>
                <MenuItem value="">Unspecified</MenuItem>

                {partOfSpeechOptions.map((pos) => (
                  <MenuItem key={pos} value={pos}>
                    {pos}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Definition language"
                value={sense.language}
                onChange={(event) =>
                  updateSense(sense.id, {
                    language: event.target.value,
                  })
                }
                helperText="BCP 47 language tag, e.g. en or zh"
                fullWidth
              />

              {/* Link definition to readings */}

              <Autocomplete
                multiple
                options={draft.readings}
                value={draft.readings.filter((reading) =>
                  sense.readingIds.includes(reading.id)
                )}
                getOptionLabel={(reading) =>
                  `${reading.romanization || "(empty)"} · ${reading.variety}`
                }
                isOptionEqualToValue={(option, value) =>
                  option.id === value.id
                }
                onChange={(_, selected) =>
                  updateSense(sense.id, {
                    readingIds: selected.map((r) => r.id),
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Associated pronunciations"
                    helperText="Optional: leave empty if this sense is not tied to a particular reading."
                  />
                )}
              />

              {/* Sense tags */}

              <Box>
                <Typography variant="subtitle2" gutterBottom>Usage tags</Typography>

                <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: "wrap" }}>
                  {sense.tags.map((tag) => (
                    <Chip
                      key={`${tag.category}-${tag.value}`}
                      label={`${tag.category}: ${tag.value}`}
                      onDelete={() =>
                        removeSenseTag(sense.id, tag)
                      }
                    />
                  ))}
                </Stack>

                <SenseTagInput onAdd={(tag: SenseTag) => addSenseTag(sense.id, tag)} />
              </Box>

              <TextField
                label="Notes"
                value={sense.notes ?? ""}
                onChange={(event) =>
                  updateSense(sense.id, {
                    notes: event.target.value,
                  })
                }
                multiline minRows={2} fullWidth />
            </Stack>
          </Paper>
        ))}

        <Button startIcon={<AddIcon />} onClick={addSense} variant="outlined">Add definition</Button>
      </Stack>

      <Divider sx={{ my: 4 }} />

      {/* General tags */}

      <Typography variant="h5" gutterBottom>Word tags</Typography>

      <Autocomplete multiple freeSolo options={[]}
        value={draft.tags}
        onChange={(_, tags) =>
          setDraft((prev) => ({
            ...prev,
            tags,
          }))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Tags"
            placeholder="Type a tag and press Enter"
          />
        )}
        sx={{ mt: 2 }}
      />

      {/* Actions */}

      <Divider sx={{ my: 4 }} />

      <Stack direction="row" sx={{ justifyContent: "flex-end" }} spacing={2}>
        <Button variant="outlined" onClick={onCancel}>Cancel</Button>

        <Button variant="contained" onClick={handleSave}>Save word</Button>
      </Stack>
    </Paper>
  );
}

