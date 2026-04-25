"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal";

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tVerification = useTranslations("auth.verification");
  const { login, resendVerification, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const {
    register,
    handleSubmit,
  } = useForm<LoginFormData>();

  // Countdown timer for lockout
  useEffect(() => {
    if (isLocked && lockoutMinutes > 0) {
      const timer = setInterval(() => {
        setLockoutMinutes((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 60000); // Update every minute

      return () => clearInterval(timer);
    }
  }, [isLocked, lockoutMinutes]);

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsUnverified(false);
    setIsLocked(false);
    setResendSuccess(false);
    setUserEmail(data.email);

    const result = await login({
      email: data.email,
      password: data.password,
    });

    if (!result.success) {
      if (result.errorType === "unverified") {
        setIsUnverified(true);
      } else if (result.errorType === "locked" && result.lockedUntil) {
        setIsLocked(true);
        const nowMs = result.lockedUntil.getTime() - new Date().getTime();
        const minutesLeft = Math.ceil(nowMs / 60000);
        setLockoutMinutes(minutesLeft);
      } else {
        setError(t("errors.invalid"));
      }
    }
  };

  const handleResendVerification = async () => {
    const result = await resendVerification(userEmail);
    if (result.success) {
      setResendSuccess(true);
    }
  };

  // Unverified state UI
  if (isUnverified) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="text-center">
          <p className="text-sm text-primary font-medium mb-2">
            {tVerification("status")}
          </p>
          <p className="text-xs text-[#994d51]/60 mb-4">
            {t("errors.unverified")}
          </p>
        </div>
        {resendSuccess ? (
          <p className="text-xs text-center text-[#1b0e0e]">
            {tVerification("sent")}
          </p>
        ) : (
          <Button
            type="button"
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full rounded-full h-12 px-8 bg-primary hover:bg-primary-dark text-white font-bold transition-colors duration-200"
          >
            {loading ? "..." : tVerification("resend")}
          </Button>
        )}
      </div>
    );
  }

  // Lockout state UI
  if (isLocked) {
    return (
      <div className="flex flex-col gap-4 py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <span className="text-2xl">🔒</span>
        </div>
        <p className="text-sm text-primary font-medium">
          {t("errors.locked", { minutes: lockoutMinutes })}
        </p>
        <p className="text-xs text-[#994d51]/60">
          Please try again in {lockoutMinutes} minute{lockoutMinutes !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email" className="text-sm font-medium text-[#1b0e0e]">
            {t("email")}
          </Label>
          <Input
            id="login-email"
            type="email"
            className="form-input"
            {...register("email", { required: true })}
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-password" className="text-sm font-medium text-[#1b0e0e]">
            {t("password")}
          </Label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className="form-input pr-12"
              {...register("password", { required: true })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#994d51]/60 hover:text-[#994d51] transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-xs text-primary text-center">{error}</div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center rounded-full h-12 px-8 bg-primary hover:bg-primary-dark text-white font-bold transition-colors duration-200"
        >
          {loading ? "..." : t("submit")}
        </Button>

        {/* Forgot Password Link */}
        <button
          type="button"
          onClick={() => setShowForgotModal(true)}
          className="text-xs text-[#994d51]/60 hover:text-[#994d51] transition-colors text-center"
        >
          {t("forgotPassword")}
        </button>
      </form>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </>
  );
}

