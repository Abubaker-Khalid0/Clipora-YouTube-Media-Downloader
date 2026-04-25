"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function SignupForm() {
  const t = useTranslations("auth.signup");
  const tVerification = useTranslations("auth.verification");
  const { signUp, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>();

  // eslint-disable-next-line react-hooks/incompatible-library
  const password = watch("password");

  const onSubmit = async (data: SignupFormData) => {
    setServerError(null);
    
    const result = await signUp({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
    });

    if (result.success) {
      setSuccess(true);
    } else {
      if (result.error === "email_taken") {
        setServerError(t("errors.emailTaken"));
      } else {
        setServerError(result.error || "An error occurred");
      }
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <p className="text-sm text-[#1b0e0e] font-medium">
          {tVerification("sent")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Full Name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName" className="text-sm font-medium text-[#1b0e0e]">
          {t("fullName")}
        </Label>
        <Input
          id="fullName"
          type="text"
          className="form-input"
          {...register("fullName", { required: true })}
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-sm font-medium text-[#1b0e0e]">
          {t("email")}
        </Label>
        <Input
          id="email"
          type="email"
          className="form-input"
          {...register("email", {
            required: true,
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: "Invalid email format",
            },
          })}
        />
        {errors.email && (
          <span className="text-xs text-primary">{errors.email.message}</span>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-sm font-medium text-[#1b0e0e]">
          {t("password")}
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            className="form-input pr-12"
            {...register("password", {
              required: true,
              minLength: {
                value: 8,
                message: t("errors.passwordTooShort"),
              },
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
        <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#1b0e0e]">
          {t("confirmPassword")}
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            className="form-input pr-12"
            {...register("confirmPassword", {
              required: true,
              validate: (value) =>
                value === password || t("errors.passwordMismatch"),
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

      {/* Server Error */}
      {serverError && (
        <div className="text-xs text-primary text-center">{serverError}</div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center rounded-full h-12 px-8 bg-primary hover:bg-primary-dark text-white font-bold transition-colors duration-200"
      >
        {loading ? "..." : t("submit")}
      </Button>
    </form>
  );
}
