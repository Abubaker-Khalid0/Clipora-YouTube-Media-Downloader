"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Mail, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ForgotPasswordData {
  email: string;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const t = useTranslations("auth.reset");
  const { resetPassword, loading } = useAuth();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>();

  if (!isOpen) return null;

  const onSubmit = async (data: ForgotPasswordData) => {
    await resetPassword(data.email);
    // Always show the neutral sent screen regardless of the outcome.
    // Displaying different states (error vs success) would reveal whether
    // the email address is registered — a user enumeration vulnerability.
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl p-8 max-w-[400px] mx-4 shadow-2xl w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-[#1b0e0e]">
              {t("sent")}
            </h3>
            <p className="text-sm text-[#994d51]/60">
              If an account exists with this email, you will receive a password reset link.
            </p>
            <Button
              onClick={onClose}
              className="mt-4 w-full rounded-full h-12 px-8 bg-primary hover:bg-primary-dark text-white font-bold transition-colors duration-200"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-[#1b0e0e] mb-2">
              {t("trigger")}
            </h3>
            <p className="text-sm text-[#994d51]/60 mb-6">
              {t("email")}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {/* Email */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="reset-email" className="text-sm font-medium text-[#1b0e0e]">
                  Email
                </Label>
                <Input
                  id="reset-email"
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
                  <span className="text-xs text-primary">
                    {errors.email.message || "Email is required"}
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center rounded-full h-12 px-8 bg-primary hover:bg-primary-dark text-white font-bold transition-colors duration-200"
              >
                {loading ? "..." : t("submit")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}