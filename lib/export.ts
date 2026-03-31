"use client";

import type { Exhibitor } from "@/lib/types";
import { EXHIBITOR_KEYS } from "@/lib/types";

export function downloadCSV(exhibitors: Exhibitor[]) {
  const headers = [
    "Nom", "Description", "Site Web", "Logo", "Stand", "Pays",
    "LinkedIn", "Twitter/X", "Catégories", "Email", "Téléphone",
  ];
  const keys: (keyof Exhibitor)[] = [
    "nom", "description", "site_web", "logo", "stand", "pays",
    "linkedin", "twitter", "categories", "email", "telephone",
  ];
  const rows = exhibitors.map((e) =>
    keys.map((k) => `"${(e[k] ?? "").replace(/"/g, '""')}"`)
  );

  const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "exposants.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadXLSX(exhibitors: Exhibitor[]) {
  import("xlsx").then((XLSX) => {
    const headers = [
      "Nom", "Description", "Site Web", "Logo", "Stand", "Pays",
      "LinkedIn", "Twitter/X", "Catégories", "Email", "Téléphone",
    ];
    const keys: (keyof Exhibitor)[] = [
      "nom", "description", "site_web", "logo", "stand", "pays",
      "linkedin", "twitter", "categories", "email", "telephone",
    ];
    const data = exhibitors.map((e) => {
      const row: Record<string, string> = {};
      keys.forEach((k, i) => { row[headers[i]] = e[k] ?? ""; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exposants");
    XLSX.writeFile(wb, "exposants.xlsx");
  });
}
