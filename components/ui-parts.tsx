"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function ToolCallIndicator({ toolName, state, input }: { toolName: string; state: string; input: unknown }) {
  const url = (input as { url?: string })?.url ?? "";
  const isRunning = state === "input-streaming" || state === "input-available";

  const labels: Record<string, string> = {
    scrape_page: "Scraping",
    map_site: "Découverte des URLs",
  };

  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg my-1 ${isRunning ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
      {isRunning && (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!isRunning && <span>✓</span>}
      <span className="font-medium">{labels[toolName] ?? toolName}</span>
      {url && <span className="truncate max-w-[300px] opacity-70">{url}</span>}
    </div>
  );
}

export function GradientText({ children }: { children: ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

export function SoftBadge({ children }: { children: ReactNode }) {
  return (
    <Badge className="rounded-full border border-violet-200 bg-white text-violet-700 hover:bg-white dark:border-violet-500/30 dark:bg-zinc-900 dark:text-violet-300 dark:hover:bg-zinc-900">
      {children}
    </Badge>
  );
}

export function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 text-violet-600 dark:from-violet-500/15 dark:to-pink-500/15 dark:text-violet-300">
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
