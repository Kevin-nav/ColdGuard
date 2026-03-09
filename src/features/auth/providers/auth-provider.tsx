import { onAuthStateChanged, User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getConvexClient } from "../../../lib/convex/client";
import { getFirebaseAuth } from "../../../lib/firebase/client";
import { bootstrapUserInConvex } from "../services/user-bootstrap";

type AuthSessionContext = {
  user: User | null;
  isLoading: boolean;
  providerId: string | null;
};

const AuthContext = createContext<AuthSessionContext>({
  user: null,
  isLoading: true,
  providerId: null,
});

function getPrimaryProviderId(user: User | null) {
  return user?.providerData?.[0]?.providerId ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConvexAuthenticated, setIsConvexAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const convex = getConvexClient();

    if (!user) {
      setIsConvexAuthenticated(false);
      convex.clearAuth();
      return;
    }

    let isActive = true;
    setIsConvexAuthenticated(false);

    convex.setAuth(
      async () => await user.getIdToken(),
      (nextIsAuthenticated) => {
        if (isActive) {
          setIsConvexAuthenticated(nextIsAuthenticated);
        }
      },
    );

    return () => {
      isActive = false;
      convex.clearAuth();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !isConvexAuthenticated) return;
    void bootstrapUserInConvex({
      email: user.email,
      displayName: user.displayName,
    });
  }, [isConvexAuthenticated, user]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      providerId: getPrimaryProviderId(user),
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  return useContext(AuthContext);
}
