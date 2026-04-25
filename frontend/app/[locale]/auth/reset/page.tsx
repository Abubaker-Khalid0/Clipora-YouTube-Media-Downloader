"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

/**
 * Reset Password Page – T053/T054/T055/T067
 * Handles the second step of password reset: user sets a new password
 * after clicking the reset link from email.
 *
 * Supabase automatically sets the session from the reset link hash.
 * We just call updateUser with the new password.
 */
export default function ResetPasswordPage() {
  const t = useTranslations("auth.reset");
  const { updatePassword, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>();

  // eslint-disable-next-line react-hooks/incompatible-library
  const password = watch("password");

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null);
    const result = await updatePassword(data.password);

    if (result.success) {
      setSuccess(true);
    } else {
      // Check for expired / invalid session
      if (result.error?.toLowerCase().includes("expired") || result.error?.toLowerCase().includes("invalid")) {
        setServerError("expired");
      } else {
        setServerError(result.error ?? "An error occurred");
      }
    }
  };

  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-background-light">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-[#1b0e0e]">{t("success")}</h1>
          <Link
            href="/en/auth"
            className="mt-2 flex w-full items-center justify-center rounded-full h-12 px-8 bg-primary hover:bg-primary-dark text-white font-bold transition-colors duration-200 text-sm"
          >
            {t("save")}
          </Link>
        </div>
      </main>
    );
  }

  if (serverError === "expired") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-background-light">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-bold text-[#1b0e0e]">Link Expired</h1>
          <p className="text-sm text-[#994d51]/60">Your password reset link has expired.</p>
          <Link
            href="/en/auth"
            className="mt-2 flex w-full items-center justify-center rounded-full h-12 px-8 bg-primary hover:bg-primary-dark text-white font-bold transition-colors duration-200 text-sm"
          >
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-background-light">
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-lg p-8 flex flex-col gap-6">
        <h1 className="text-xl font-bold text-[#1b0e0e]">{t("newPassword")}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* New Password */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password" className="text-sm font-medium text-[#1b0e0e]">
              {t("newPassword")}
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                className="form-input pr-12"
                {...register("password", {
                  required: true,
                  minLength: { value: 8, message: "Password must be at least 8 characters." },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#994d51]/60 hover:text-[#994d51] transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-xs text-primary">{errors.password.message}</span>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium text-[#1b0e0e]">
              {t("confirmPassword")}
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                className="form-input pr-12"
                {...register("confirmPassword", {
                  required: true,
                  validate: (value) => value === password || "Passwords do not match.",
                })}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#994d51]/60 hover:text-[#994d51] transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="text-xs text-primary">{errors.confirmPassword.message}</span>
            )}
          </div>

          {serverError && serverError !== "expired" && (
            <div className="text-xs text-primary text-center">{serverError}</div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-full h-12 px-8 bg-primary hover:bg-primary-dark text-white font-bold transition-colors duration-200"
          >
            {loading ? "..." : t("save")}
          </Button>
        </form>
      </div>
    </main>
  );
}
