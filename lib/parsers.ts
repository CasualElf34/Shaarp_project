import type { UIMessage } from "ai";
import type { Exhibitor } from "@/lib/types";
import { EXHIBITOR_KEYS } from "@/lib/types";

export function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function parseExhibitors(text: string): Exhibitor[] {
  const regex = /<exhibitors>\s*([\s\S]*?)\s*<\/exhibitors>/g;
  const allExhibitors: Exhibitor[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const exhibitor: Exhibitor = {
            nom: "",
            description: "",
            site_web: "",
            logo: "",
            stand: "",
            pays: "",
            linkedin: "",
            twitter: "",
            categories: "",
            email: "",
            telephone: "",
          };
          for (const key of EXHIBITOR_KEYS) {
            if (typeof item[key] === "string") {
              exhibitor[key] = item[key];
            }
          }
          if (item.secteur && !exhibitor.categories) {
            exhibitor.categories = item.secteur;
          }
          if (exhibitor.nom) {
            allExhibitors.push(exhibitor);
          }
        }
      }
    } catch {
      // ignore malformed JSON during streaming
    }
  }
  return allExhibitors;
}
