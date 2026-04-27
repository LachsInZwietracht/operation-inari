"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: User | null;
}) {
  const hasInitialUser = initialUser !== undefined;
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [loading, setLoading] = useState(!hasInitialUser);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    if (!hasInitialUser) {
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user);
        setLoading(false);
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [hasInitialUser]);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return value;
}
