"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface TabSwitcherProps {
  activeTab: "login" | "signup";
  onTabChange: (tab: "login" | "signup") => void;
}

export function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  const t = useTranslations("auth.tabs");

  return (
    <div className="flex border-b border-[#e7d0d1] relative mb-6">
      <button
        type="button"
        onClick={() => onTabChange("login")}
        className={`flex-1 pb-4 text-center transition-colors ${
          activeTab === "login" ? "tab-active" : "tab-inactive"
        }`}
      >
        {t("login")}
      </button>
      <button
        type="button"
        onClick={() => onTabChange("signup")}
        className={`flex-1 pb-4 text-center transition-colors ${
          activeTab === "signup" ? "tab-active" : "tab-inactive"
        }`}
      >
        {t("signup")}
      </button>
      {/* Use insetInlineStart instead of left so it respects RTL direction */}
      <motion.div
        layoutId="activeTabIndicator"
        className="absolute bottom-0 h-0.5 w-1/2 bg-primary"
        style={{
          insetInlineStart: activeTab === "login" ? "0%" : "50%",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </div>
  );
}

