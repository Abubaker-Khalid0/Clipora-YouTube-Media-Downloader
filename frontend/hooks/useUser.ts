"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // NOTE: createClient() always returns a live browser client — it cannot
    // return null. If Supabase env vars are missing, lib/env.ts throws at
    // module-evaluation time (before this hook runs), crashing the bundle with
    // a clear error message. No null-guard is needed or useful here.
    const supabase = createClient();

    // SECURITY: Use getUser() — not getSession() — for the initial auth check.
    // getSession() only reads from the cookie/localStorage without making a
    // network request, so expired or tampered tokens pass unchecked.
    // getUser() validates the JWT with Supabase's auth server every time.
    // Subsequent updates are handled by onAuthStateChange (no extra polling).
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        // Token is invalid, expired, or revoked — treat as signed-out.
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(user);

      if (user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            setProfile(data);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    // onAuthStateChange handles all subsequent session changes (sign-in,
    // sign-out, token refresh). The session object here is already validated
    // by the Supabase client internally — no extra getUser() call needed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single()
          .then(({ data }) => {
            setProfile(data);
          });
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // NOTE: `session` is intentionally NOT returned here. Components that
  // need access_token for API calls should call supabase.auth.getSession()
  // locally and document why (e.g. to attach Authorization headers).
  return { user, profile, loading };
}
