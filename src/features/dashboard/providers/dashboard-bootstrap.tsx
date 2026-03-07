import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { initializeSQLite } from "../../../lib/storage/sqlite/client";

type DashboardBootstrapContextValue = {
  error: string | null;
  isReady: boolean;
};

const DashboardBootstrapContext = createContext<DashboardBootstrapContextValue>({
  error: null,
  isReady: false,
});

export function DashboardBootstrapProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        await initializeSQLite();
        if (isMounted) setIsReady(true);
      } catch (nextError) {
        if (isMounted) {
          setError(nextError instanceof Error ? nextError.message : "SQLite initialization failed.");
        }
      }
    }

    void boot();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      error,
      isReady,
    }),
    [error, isReady],
  );

  return (
    <DashboardBootstrapContext.Provider value={value}>
      {children}
    </DashboardBootstrapContext.Provider>
  );
}

export function useDashboardBootstrap() {
  return useContext(DashboardBootstrapContext);
}
