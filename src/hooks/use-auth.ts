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

    // 1. Initial check
    getCurrentUser().then((u) => {
      if (isMounted) {
        setUser(u);
        setLoading(false);
      }
    });

    // 2. Listen to Supabase auth events
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const u = await getCurrentUser();
        if (isMounted) setUser(u);
      } else {
        if (isMounted) setUser(null);
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
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
