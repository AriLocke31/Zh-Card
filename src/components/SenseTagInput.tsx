import { useState } from "react";

import { Stack, TextField, MenuItem, Button } from "@mui/material";

import AddIcon from "@mui/icons-material/Add";

import type { SenseTag } from "../types";

interface SenseTagInputProps {
  onAdd: (tag: SenseTag) => void;
}

const categories: SenseTag["category"][] = [
  "register",
  "region",
  "period",
  "domain",
  "usage",
  "custom",
];

export default function SenseTagInput({ onAdd, }: SenseTagInputProps) {
  const [category, setCategory] = useState<SenseTag["category"]>("register");
  const [value, setValue] = useState("");
  const handleAdd = () => {
    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    onAdd({
      category,
      value: trimmed,
    });

    setValue("");
  };

  return (
    <Stack direction="row" spacing={2}>
      <TextField select label="Category" value={category} onChange={(event) =>
        setCategory(event.target.value as SenseTag["category"])
      } sx={{ flex: 1 }}>
        {categories.map((option) => (
          <MenuItem key={option} value={option}>{option}</MenuItem>
        ))}
      </TextField>

      <TextField label="Tag" value={value} onChange={(event) => setValue(event.target.value)}
        sx={{ flex: 2 }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleAdd();
          }
        }} placeholder="e.g. archaic" fullWidth />

      <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAdd} disabled={!value.trim()}>Add</Button>
    </Stack>
  );
}


