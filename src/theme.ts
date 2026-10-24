import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { minHeight: "100%" },
        body: {
          minHeight: "100vh",
          // Different scales and offsets keep the paper from looking like a flat fill
          // or a regular dot pattern. All texture is procedural CSS, with no assets.
          backgroundColor: "#d2ae70",
          backgroundImage: [
            "radial-gradient(ellipse at 8% 12%, rgba(107, 66, 22, 0.22), transparent 48%)",
            "radial-gradient(ellipse at 82% 18%, rgba(133, 76, 25, 0.18), transparent 42%)",
            "radial-gradient(ellipse at 38% 58%, rgba(255, 237, 181, 0.36), transparent 58%)",
            "radial-gradient(ellipse at 94% 88%, rgba(102, 61, 23, 0.24), transparent 52%)",
            "radial-gradient(ellipse at 14% 92%, rgba(240, 211, 143, 0.30), transparent 40%)",
            "radial-gradient(ellipse at 28% 37%, rgba(94, 61, 25, 0.12) 0%, transparent 65%)",
            "radial-gradient(ellipse at 72% 64%, rgba(255, 243, 207, 0.14) 0%, transparent 68%)",
            "radial-gradient(circle, rgba(71, 45, 16, 0.13) 0.5px, transparent 0.9px)",
            "radial-gradient(circle, rgba(255, 245, 211, 0.24) 0.5px, transparent 1px)",
            "repeating-linear-gradient(8deg, transparent 0 3px, rgba(96, 64, 25, 0.025) 3px 4px, transparent 4px 9px)",
          ].join(","),
          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 337px 463px, 521px 379px, 7px 11px, 13px 9px, auto",
          backgroundPosition: "center, center, center, center, center, 19px 53px, 157px 89px, 0 0, 3px 5px, center",
          backgroundAttachment: "fixed",
        },
        "#root": { minHeight: "100vh" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          backgroundColor: "#fff",
          color: "#000",
          "&:hover": { backgroundColor: "#f5f5f5" },
          "&.Mui-disabled": { backgroundColor: "#fff", color: "rgba(0, 0, 0, 0.38)" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          backgroundColor: "#fff",
          color: "#000",
          "&:hover": { backgroundColor: "#f5f5f5" },
          "&.Mui-disabled": { backgroundColor: "#fff", color: "rgba(0, 0, 0, 0.38)" },
        },
      },
    },
  },
  palette: {
    mode: "light",

    primary: {
      main: "#a78d8a",
    },

    background: {
      default: "#d2ae70",
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
