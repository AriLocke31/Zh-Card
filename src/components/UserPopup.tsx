import { useState } from "react";
import { Button, IconButton, Menu, MenuItem } from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

interface UserPopupProps {
  loggedIn: boolean;
  label?: string;
  disabled?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function UserPopup({ loggedIn, disabled = false, onSignIn, onSignOut, label }: UserPopupProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  return <>
    {label ? <Button aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? "user-menu" : undefined} disabled={disabled}
      onClick={event => setAnchor(event.currentTarget)}>{label}</Button> : <IconButton aria-label="User menu" aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? "user-menu" : undefined} disabled={disabled}
      onClick={event => setAnchor(event.currentTarget)}>
      <AccountCircleIcon />
    </IconButton>}
    <Menu id="user-menu" anchorEl={anchor} open={open} onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}>
      <MenuItem component="a" href="" onClick={event => { event.preventDefault(); setAnchor(null); }}>Account</MenuItem>
      <MenuItem onClick={() => { setAnchor(null); (loggedIn ? onSignOut : onSignIn)(); }}>
        {loggedIn ? "Sign out" : "Sign in"}
      </MenuItem>
    </Menu>
  </>;
}
