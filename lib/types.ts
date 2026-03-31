export interface Exhibitor {
  nom: string;
  description: string;
  site_web: string;
  logo: string;
  stand: string;
  pays: string;
  linkedin: string;
  twitter: string;
  categories: string;
  email: string;
  telephone: string;
}

export const EXHIBITOR_KEYS: (keyof Exhibitor)[] = [
  "nom", "description", "site_web", "logo", "stand", "pays",
  "linkedin", "twitter", "categories", "email", "telephone",
];

export type SortDirection = "asc" | "desc" | null;
export type SortKey = keyof Exhibitor;
