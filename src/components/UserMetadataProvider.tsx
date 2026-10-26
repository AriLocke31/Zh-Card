import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Alert, Button } from "@mui/material";
import type { UserMetadata } from "../validation/metadata";

interface MetadataState {
  metadata: UserMetadata | null;
  refreshMetadata: () => Promise<void>;
}
const MetadataContext = createContext<MetadataState>({ metadata: null, refreshMetadata: async () => {} });
export const useUserMetadata = () => useContext(MetadataContext);

/** Load once after sign-in and refresh after successful word mutations. */
export default function UserMetadataProvider({ repository, children }: {
  repository: { getMetadata: () => Promise<UserMetadata> }; children: ReactNode;
}) {
  const [metadata, setMetadata] = useState<UserMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Replaced on unmount so late network responses cannot restore another session.
  const [lifetime] = useState(() => ({ active: false, request: 0 }));
  const refreshMetadata = useCallback(async () => {
    const request = ++lifetime.request;
    try {
      const result = await repository.getMetadata();
      if (lifetime.active && request === lifetime.request) { setMetadata(result); setError(null); }
    } catch (error) {
      if (lifetime.active && request === lifetime.request) {
        setMetadata(null); setError(error instanceof Error ? error.message : "Could not load dictionary totals.");
      }
    }
  }, [repository, lifetime]);
  useEffect(() => {
    lifetime.active = true;
    void refreshMetadata();
    return () => { lifetime.active = false; lifetime.request++; };
  }, [refreshMetadata, lifetime]);
  return <MetadataContext.Provider value={{ metadata, refreshMetadata }}>
    {error && <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={() => void refreshMetadata()}>Retry</Button>}>{error}</Alert>}
    {children}
  </MetadataContext.Provider>;
}
