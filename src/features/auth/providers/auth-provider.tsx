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
      convex.clearAuth();
      return;
    }

    convex.setAuth(async () => await user.getIdToken());

    return () => {
      convex.clearAuth();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void bootstrapUserInConvex({
      email: user.email,
      displayName: user.displayName,
    });
  }, [user]);

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
