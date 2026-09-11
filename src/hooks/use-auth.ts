import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  resetPassword,
  type AuthSessionUser,
} from "@/lib/api/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: ensure loading state clears within 2.5s even if network is slow
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
      }
    }, 2500);

    // 1. Initial check
    getCurrentUser()
      .then((u) => {
        if (isMounted) {
          setUser(u);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Initial auth load failed:", err);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      });

    // 2. Listen to Supabase auth events
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const u = await getCurrentUser();
          if (isMounted) setUser(u);
        } else {
          if (isMounted) setUser(null);
        }
      } catch (err) {
        console.warn("Auth change resolution failed:", err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut: async () => {
      await signOut();
      setUser(null);
    },
    resetPassword,
  };
}
