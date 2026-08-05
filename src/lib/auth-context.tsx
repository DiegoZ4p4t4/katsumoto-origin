import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "./supabase";
import type { UserRole } from "./types";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  organization_id: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(userId: string, retries = 2): Promise<AuthUser | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, organization_id, role")
        .eq("id", userId)
        .eq("is_active", true)
        .single();

      if (error) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        email: data.email,
        full_name: data.full_name || data.email.split("@")[0],
        organization_id: data.organization_id,
        role: data.role,
      };
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const isSigningInRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;

        if (event === "INITIAL_SESSION") {
          if (session?.user) {
            fetchProfile(session.user.id).then((profile) => {
              if (mountedRef.current) {
                setUser(profile);
                setLoading(false);
              }
            });
          } else {
            setUser(null);
            setLoading(false);
          }
        } else if (event === "SIGNED_IN") {
          if (isSigningInRef.current) {
            return;
          }
          if (session?.user) {
            fetchProfile(session.user.id).then((profile) => {
              if (mountedRef.current) {
                setUser(profile);
                setLoading(false);
              }
            });
          }
        } else if (event === "SIGNED_OUT") {
          if (isSigningInRef.current) {
            return;
          }
          setUser(null);
          setLoading(false);
        } else if (event === "TOKEN_REFRESHED") {
          if (session?.user) {
            fetchProfile(session.user.id).then((profile) => {
              if (mountedRef.current) {
                setUser(profile);
              }
            });
          }
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    isSigningInRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(
          error.message === "Invalid login credentials"
            ? "Credenciales inválidas"
            : error.message
        );
      }
      if (data.user) {
        const profile = await fetchProfile(data.user.id);
        if (profile && mountedRef.current) {
          setUser(profile);
          setLoading(false);
          return;
        }
        if (!profile && mountedRef.current) {
          for (let retry = 0; retry < 4; retry++) {
            await new Promise((r) => setTimeout(r, 1500 * (retry + 1)));
            const retryProfile = await fetchProfile(data.user.id);
            if (retryProfile) {
              setUser(retryProfile);
              setLoading(false);
              return;
            }
          }
          await supabase.auth.signOut();
          throw new Error("Perfil no encontrado. Contacte al administrador.");
        }
      }
    } finally {
      isSigningInRef.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
