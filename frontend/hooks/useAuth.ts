"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
}

interface SignUpResult {
  success: boolean;
  error?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
  errorType?: "invalid" | "unverified" | "locked";
  lockedUntil?: Date;
}

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Derive locale from the current pathname (e.g. "/en/auth" → "en")
  const locale = pathname?.split("/")[1] ?? "en";

  const signUp = async ({ email, password, fullName }: SignUpData): Promise<SignUpResult> => {
    const supabase = createClient();
    if (!supabase) {
      return { success: false, error: "Supabase is not configured. Please fill in .env.local." };
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("already registered") ||
          msg.includes("user already registered") ||
          msg.includes("email already in use")
        ) {
          return { success: false, error: "email_taken" };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setLoading(false);
    }
  };

  const login = async ({ email, password }: LoginData): Promise<LoginResult> => {
    const supabase = createClient();
    if (!supabase) {
      return { success: false, error: "Supabase is not configured" };
    }

    setLoading(true);
    try {
      // Step 1: Attempt sign in
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // Check if the server-side auth hook blocked this login due to lockout (L-05 fix).
        // The hook raises 'Account is locked' before any session token is issued,
        // so there is no session to sign out — just surface the friendly message.
        if (error.message.toLowerCase().includes("locked")) {
          return {
            success: false,
            error: "Your account has been locked. Please contact support to restore access.",
            errorType: "locked",
          };
        }
        // Wrong credentials — we can't get the user ID to update failed_login_count
        // because signInWithPassword returns no user on failure. Return generic error.
        return { success: false, error: "invalid", errorType: "invalid" };
      }

      if (!data.user) {
        return { success: false, error: "invalid", errorType: "invalid" };
      }

      // Step 2: Check if email is verified
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        return { success: false, error: "unverified", errorType: "unverified" };
      }

      // Step 3: Client-side lockout fast-path (defense-in-depth / UX layer).
      //
      // Primary enforcement: the `handle_custom_access_token` DB hook runs
      // server-side BEFORE Supabase issues a JWT, so locked users are blocked
      // before signInWithPassword() returns — their error is caught above at
      // the `if (error)` block and no session is ever created.
      //
      // This secondary check handles the edge case where the hook is active but
      // the profiles row is updated between the hook invocation and this point
      // (extremely rare), or provides a readable UI message when the client
      // reads a stale locked_until value. No signOut() is needed — if we reach
      // this point the session was legitimately issued (lock expired server-
      // side) or the hook caught it already and we never get here.
      const { data: profile } = await supabase
        .from("profiles")
        .select("locked_until, failed_login_count")
        .eq("id", data.user.id)
        .single();

      if (profile?.locked_until) {
        const lockedUntil = new Date(profile.locked_until);
        if (lockedUntil > new Date()) {
          // Server hook should have caught this — surface the message anyway.
          return {
            success: false,
            error: "Your account has been locked. Please contact support to restore access.",
            errorType: "locked",
            lockedUntil,
          };
        }
        // locked_until is in the past — lockout has expired, allow login.
      }

      // Step 4: Successful login — reset failed count and lockout
      await supabase
        .from("profiles")
        .update({ failed_login_count: 0, locked_until: null })
        .eq("id", data.user.id);

      // Redirect to dashboard with locale prefix
      router.push(`/${locale}/dashboard`);
      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async (email: string): Promise<SignUpResult> => {
    const supabase = createClient();
    if (!supabase) {
      return { success: false, error: "Supabase is not configured" };
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/${locale}/auth/callback`,
        },
      });

      if (error) {
        console.error("Google OAuth error:", error.message);
      }
      // On success, user is redirected to Google, so no redirect needed here
    } catch (err) {
      console.error("Google OAuth error:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Security: always return the same response regardless of whether the email
   * exists — this prevents user enumeration attacks via the password reset flow.
   * The caller receives an identical message for both registered and unregistered
   * addresses, and for rate-limit errors, so an attacker gains no information.
   */
  const resetPassword = async (email: string): Promise<{ success: true; message: string }> => {
    const supabase = createClient();

    // Even when Supabase is misconfigured we return the generic message —
    // revealing a configuration error to the caller is itself an info leak.
    if (!supabase) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[resetPassword] Supabase client is not configured')
      }
      return {
        success: true,
        message: "If an account exists for this email, a reset link has been sent.",
      };
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/${locale}/auth/reset`,
      });

      if (error) {
        // Log for debugging only — never surface to the user.
        if (process.env.NODE_ENV === 'development') {
          console.error('[resetPassword] Supabase error:', error.message)
        }
      }

      // ALWAYS return this — never reveal if email exists, if rate-limited,
      // or if any other error occurred. One uniform response for every outcome.
      return {
        success: true,
        message: "If an account exists for this email, a reset link has been sent.",
      };
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[resetPassword] Unexpected error:', err)
      }
      return {
        success: true,
        message: "If an account exists for this email, a reset link has been sent.",
      };
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (newPassword: string): Promise<SignUpResult> => {
    const supabase = createClient();
    if (!supabase) {
      return { success: false, error: "Supabase is not configured" };
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.push(`/${locale}/auth`);
  };

  return { signUp, login, resendVerification, loginWithGoogle, resetPassword, updatePassword, logout, loading };
}
