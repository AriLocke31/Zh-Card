import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",

    primary: {
      main: "#a78d8a",
    },

    background: {
      default: "#eeb9a2",
      paper: "#fdf6f2",
    },
  },

  shape: {
    borderRadius: 12,
  },

  typography: {
    fontFamily: [
      "Inter",
      "Noto Sans SC",
      "Noto Sans TC",
      "Arial",
      "sans-serif",
    ].join(","),

    h3: {
      fontWeight: 600,
    },

    h5: {
      fontWeight: 600,
    },
  },
});
