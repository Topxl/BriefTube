/**
 * BriefTube — Design System
 *
 * Source de vérité unique pour tous les tokens visuels du projet.
 * Importer ces constantes dans les composants plutôt que d'écrire
 * des strings Tailwind ad-hoc partout.
 *
 * Philosophie :
 *  • Dark-first, fond quasi-noir avec surfaces étagées par luminosité
 *  • Le rouge (#dc2626) est la SEULE couleur brand — réservé aux CTAs primaires
 *  • Glassmorphism subtil : borders en white/opacity pour la profondeur sans bruit
 *  • Typo compacte : xs/sm pour la donnée, base pour les titres de page
 */

// ─── Surfaces ─────────────────────────────────────────────────────────────────

/**
 * Hiérarchie de surfaces (du plus sombre au plus clair).
 * Utilisées en inline style ou dans des utilitaires custom.
 */
export const surface = {
  /** Fond de page — le plus sombre */
  page: "oklch(0.20 0 0)",
  /** Modal / Dialog — légèrement au-dessus de la page */
  dialog: "oklch(0.22 0 0)",
  /** Card / Panel standard */
  card: "oklch(0.27 0 0)",
  /** Élément survolé ou légèrement relevé */
  hover: "rgba(255, 255, 255, 0.04)",
} as const;

// ─── Borders ──────────────────────────────────────────────────────────────────

/**
 * Bordures en white/opacity — toujours utiliser ces valeurs,
 * jamais la variable --border (trop visible sur fond sombre).
 */
export const border = {
  /** Séparateurs entre lignes de liste */
  faint: "rgba(255, 255, 255, 0.04)",
  /** Contour de card / panel */
  subtle: "rgba(255, 255, 255, 0.06)",
  /** Inputs, panneaux */
  default: "rgba(255, 255, 255, 0.10)",
  /** Boutons, focus rings */
  strong: "rgba(255, 255, 255, 0.18)",
} as const;

// ─── Brand ────────────────────────────────────────────────────────────────────

/**
 * Rouge brand — UNIQUEMENT pour les CTA primaires (boutons d'action,
 * indicateurs actifs, éléments sélectionnés).
 * Ne pas utiliser pour décorer ou mettre en évidence du texte.
 */
export const brand = {
  DEFAULT: "#dc2626", // red-600
  hover: "#ef4444", // red-500
  glow: "rgba(239, 68, 68, 0.25)",
  glowSm: "rgba(239, 68, 68, 0.15)",
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadow = {
  card: "0 2px 8px rgba(0, 0, 0, 0.25)",
  dialog: "0 24px 80px rgba(0, 0, 0, 0.6)",
  brandSm: "0 0 12px rgba(239, 68, 68, 0.15)",
  brand: "0 0 20px rgba(239, 68, 68, 0.25)",
  brandLg: "0 0 30px rgba(239, 68, 68, 0.35)",
} as const;

// ─── Tailwind class strings ────────────────────────────────────────────────────

/**
 * Strings de classes Tailwind prêts à l'emploi pour les patterns récurrents.
 * Combiner avec cn() si besoin de conditionner.
 *
 * @example
 *   import { tw } from "@/styles/design-tokens";
 *   <div className={tw.card}>…</div>
 */
export const tw = {
  // ── Layout ─────────────────────────────────────────────────────────────────
  /** Conteneur de page */
  page: "space-y-6",
  /** Section avec titre + contenu */
  section: "space-y-3",

  // ── Cards / Listes ─────────────────────────────────────────────────────────
  /** Conteneur card avec bord subtil */
  card: "overflow-hidden rounded-xl border border-white/[0.06]",
  /** Séparateurs entre lignes */
  rows: "divide-y divide-white/[0.04]",
  /** Ligne de liste standard */
  row: "flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]",
  /** Ligne de liste cliquable */
  rowLink:
    "flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.03]",

  // ── Typographie ────────────────────────────────────────────────────────────
  /**
   * Hiérarchie typographique :
   *   pageTitle    — titre H1 de page      (base / semibold)
   *   sectionTitle — titre de section      (sm / semibold)
   *   body         — texte courant         (sm)
   *   subtext      — texte secondaire      (xs / muted)
   *   micro        — labels, métadonnées   (11px / muted)
   */
  pageTitle: "text-base font-semibold",
  sectionTitle: "text-sm font-semibold",
  body: "text-sm",
  subtext: "text-muted-foreground text-xs",
  micro: "text-muted-foreground text-[11px]",
  label: "text-muted-foreground text-xs font-medium",

  // ── Boutons (override / extension du composant Button) ─────────────────────
  /** CTA primaire — rouge brand */
  btnPrimary:
    "bg-red-600 text-white hover:bg-red-500 border-transparent shadow-[0_0_16px_rgba(239,68,68,0.2)]",
  /** Action secondaire neutre */
  btnGhost: "text-muted-foreground hover:text-foreground transition-colors",
  /** Action destructive inline (pas de bouton rouge complet) */
  btnDanger: "text-muted-foreground hover:text-red-400 transition-colors",

  // ── Chips / Tags de catégorie ───────────────────────────────────────────────
  chip: "rounded-full border border-white/[0.08] px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-white/20",
  chipActive: "border-red-500/30 bg-red-500/[0.08] text-red-400",
} as const;

// ─── Typographie — référence rapide ───────────────────────────────────────────

/**
 * Scale typographique de référence.
 * À consulter avant d'ajouter une nouvelle taille de texte.
 *
 * | Niveau        | Taille  | Poids     | Couleur          |
 * |---------------|---------|-----------|------------------|
 * | Page title    | base    | semibold  | foreground       |
 * | Section title | sm      | semibold  | foreground       |
 * | Body          | sm      | normal    | foreground       |
 * | Subtext       | xs      | normal    | muted-foreground |
 * | Micro / meta  | 11px    | normal    | muted-foreground |
 */
export const typography = {
  pageTitle: "text-base font-semibold",
  sectionTitle: "text-sm font-semibold",
  body: "text-sm",
  subtext: "text-xs text-muted-foreground",
  micro: "text-[11px] text-muted-foreground",
  label: "text-xs font-medium text-muted-foreground",
} as const;
