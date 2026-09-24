import { useState, type KeyboardEvent } from "react";

import { Autocomplete, TextField, Box, Typography } from "@mui/material";
import { getToneOptions, parsePinyin, type ToneOption } from "../utils/pinyin";

interface PinyinInputProps {
  romanization: string;
  display?: string | undefined;
  onChange: (romanization: string, display: string) => void;
}

function getActiveSyllable(text: string): string {
  if (/\s$/.test(text))
    return "";

  return text.split(/\s+/).at(-1) ?? "";
}

export default function PinyinInput({ romanization, display, onChange }: PinyinInputProps) {
  const [inputValue, setInputValue] = useState(() => {
    return (
      parsePinyin(romanization)?.editingText ?? romanization
    );
  });

  const [open, setOpen] = useState(false);
  const [hasBlurred, setHasBlurred] = useState(false);
  const activeSyllable = getActiveSyllable(inputValue);
  const options = getToneOptions(activeSyllable);

  const updateText = (text: string) => {
    setHasBlurred(false);
    setInputValue(text);
    const parsed = parsePinyin(text);
    if (parsed) {
      onChange(parsed.canonical, parsed.display);
    } else {
      onChange(text, "");
    }

    setOpen(getToneOptions(getActiveSyllable(text)).length > 0);
  };

  const selectTone = (option: ToneOption) => {
    const tokens = inputValue.trim().split(/\s+/);
    tokens.pop();
    const selectedText = option.tone === 5 ? option.canonical : option.display;
    const nextText = [...tokens.filter(Boolean), selectedText].join(" ") + " ";

    updateText(nextText);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing)
      return;

    if (!/^[1-5]$/.test(event.key))
      return;

    if (event.ctrlKey || event.altKey || event.metaKey)
      return;

    if (options.length === 0)
      return;

    const tone = Number(event.key);

    const option = options.find(option => option.tone === tone);

    if (!option)
      return;

    (event as typeof event & {
      defaultMuiPrevented: boolean;
    }).defaultMuiPrevented = true;
    event.preventDefault();

    selectTone(option);
  };


  const parsed = parsePinyin(inputValue);

  const isIncomplete = hasBlurred && inputValue.trim().length > 0 && parsed === null;

  return (
    <Autocomplete<ToneOption, false, false, true>
      options={options}
      open={open && options.length > 0}
      onOpen={() => { if (options.length > 0) setOpen(true); }}
      onClose={(_, reason) => {
        if (reason === "blur" || reason === "escape") {
          setOpen(false);
        }
      }}
      value={null}
      inputValue={inputValue}
      getOptionLabel={(option) => typeof option === "string" ? option : option.display}
      isOptionEqualToValue={(option, value) => typeof value !== "string" && option.canonical === value.canonical}
      onInputChange={(_, value, reason) => {
        if (reason !== "input" && reason !== "clear")
          return;

        updateText(value);
      }}
      onChange={(_, option) => {
        if (option && typeof option !== "string") {
          selectTone(option);
        }
      }}
      filterOptions={(options) => options}
      autoHighlight selectOnFocus freeSolo clearOnBlur={false}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        return (
          <Box component="li" key={key} {...otherProps} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
            <Typography variant="body1">{option.display}</Typography>
            <Typography variant="caption" color="textSecondary">{option.label}</Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField {...params} label="Pinyin" placeholder="Type a syllable"
          onBlur={() => setHasBlurred(true)}
          onKeyDown={handleKeyDown}
          error={isIncomplete}
          helperText={isIncomplete ? "Complete each syllable by selecting a tone" : parsed ? `Canonical: ${parsed.canonical}` : "Enter a syllable to see its tone options"} fullWidth />
      )}
    />
  );
}
