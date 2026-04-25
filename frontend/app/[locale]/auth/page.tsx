"use client";

import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { TabSwitcher } from "@/components/auth/TabSwitcher";
import { SignupForm } from "@/components/auth/SignupForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

/**
 * Auth page – auth-only route (US5).
 * Accessible only to unauthenticated users.
 * Middleware redirects authenticated users to /[locale]/dashboard.
 */
export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("signup");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-background-light">
      <AuthCard>
        <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
        
        {activeTab === "signup" ? (
          <div>
            <SignupForm />
            <GoogleButton />
          </div>
        ) : (
          <div>
            <LoginForm />
            <GoogleButton />
          </div>
        )}
      </AuthCard>
    </main>
  );
}
