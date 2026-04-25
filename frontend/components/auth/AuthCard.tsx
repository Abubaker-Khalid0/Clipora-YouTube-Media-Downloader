"use client";

import { ReactNode } from "react";

interface AuthCardProps {
  children: ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="w-full max-w-[440px] glass bg-surface-light border border-white/50 rounded-lg shadow-glass flex flex-col p-8 sm:p-10">
      {children}
    </div>
  );
}
