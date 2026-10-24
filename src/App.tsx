import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Container, Typography } from "@mui/material";
import UserPopup from "./components/UserPopup";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import WordsPage from "./pages/WordsPage";
import WordPage from "./pages/WordPage";
import { configurationError, repository, session } from "./config";
import { printedInkSx } from "./styles/printedInk";

export default function App() {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (configurationError) return;
    let active = true;
    session.completeSignIn().then(() => { if (active) setReady(true); })
      .catch(error => { if (active) { setError(error instanceof Error ? error.message : "Could not sign in."); setReady(true); } });
    return () => { active = false; };
  }, []);

  return <Container maxWidth="lg"><Box sx={{ py: 6 }}>
    <Box component="header" sx={{ mb: 4, color: "#241b12" }}>
      <Typography component="h1" sx={{
        ...printedInkSx,
        m: 0, mb: 2, textAlign: "center", fontSize: { xs: "3.5rem", sm: "5rem" },
        fontFamily: '"Noto Serif CJK SC", "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif',
        fontWeight: 900, lineHeight: 1.2, letterSpacing: "0.12em", textIndent: "0.12em",
      }}>{"\u4e2d\u7eb8"}</Typography>
      <Box component="nav" aria-label="Main navigation" sx={{
        display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        borderBottom: "1px solid currentColor", py: 0.75,
        fontFamily: 'Georgia, "Times New Roman", serif',
        "& > a, & > button": {
          minWidth: 0, p: "8px 4px", border: 0, borderRadius: 0, boxShadow: "none",
          backgroundColor: "transparent", color: "inherit", fontFamily: "inherit",
          fontSize: { xs: "1rem", sm: "1.15rem" }, textTransform: "none", fontWeight: 400,
          "&:hover, &:focus-visible": {
            backgroundColor: "transparent", textDecoration: "underline", textDecorationColor: "#b22222",
            textUnderlineOffset: "0.25em",
          },
          "&.active": { color: "#8b1e1e" },
          "&.Mui-disabled": { backgroundColor: "transparent", color: "rgba(36, 27, 18, 0.38)" },
        },
      }}>
        <Button component={NavLink} to="/words" end disabled={saving}>Words</Button>
        <Button component={NavLink} to="/words/new" disabled={saving || !ready || !session.hasSession()}>Create</Button>
        <Button component={NavLink} to="/articles" disabled={saving}>Articles</Button>
        <UserPopup label="Account" loggedIn={session.hasSession()} disabled={Boolean(configurationError) || !ready || saving}
          onSignOut={() => { session.signOut(); setError(null); navigate("/words"); }}
          onSignIn={() => { void session.signIn().catch(error => setError(error instanceof Error ? error.message : "Could not sign in.")); }} />
      </Box>
    </Box>
    {configurationError ? <Alert severity="warning">Dictionary connection is not configured. Set {configurationError} in .env.local using .env.example, then restart Vite.</Alert> : <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!ready ? <CircularProgress aria-label="Completing sign-in" /> : session.hasSession() ? <Routes>
        <Route path="/articles" element={<Typography>Articles are coming soon.</Typography>} />
        <Route path="/words" element={<WordsPage repository={repository} />} />
        <Route path="/words/new" element={<WordPage key="new" repository={repository} creating onSavingChange={setSaving} />} />
        <Route path="/words/:id" element={<WordPage repository={repository} onSavingChange={setSaving} />} />
        <Route path="*" element={<Navigate to="/words" replace />} />
      </Routes> : <Typography>Sign in to load and save your dictionary.</Typography>}
    </>}
  </Box></Container>;
}
