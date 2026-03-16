"use client";

import { useState } from "react";
import { Check, Star } from "@/lib/icons";
import { languages } from "@/lib/languages";
import type { Language } from "@/lib/languages";

export type { Language };

export function LanguagePicker({
  currentCode,
  favorites,
  onSelect,
  onToggleFavorite,
}: {
  currentCode: string;
  favorites: string[];
  onSelect: (lang: Language) => void;
  onToggleFavorite: (code: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showOthers, setShowOthers] = useState(false);

  const q = search.trim().toLowerCase();
  const allFiltered = q
    ? languages.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.nativeName.toLowerCase().includes(q),
      )
    : null;

  const favLangs = languages.filter((l) => favorites.includes(l.code));
  const otherLangs = languages.filter((l) => !favorites.includes(l.code));

  const displayFavs = allFiltered
    ? allFiltered.filter((l) => favorites.includes(l.code))
    : favLangs;
  const displayOthers = allFiltered
    ? allFiltered.filter((l) => !favorites.includes(l.code))
    : otherLangs;

  const showOthersSection = allFiltered ? displayOthers.length > 0 : showOthers;

  function LangButton({ l }: { l: Language }) {
    const isFav = favorites.includes(l.code);
    return (
      <div
        className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 transition-all duration-200 ${
          currentCode === l.code
            ? "nm-inset text-foreground"
            : "nm-raised-sm text-muted-foreground hover:text-foreground"
        }`}
      >
        <button
          onClick={() => onSelect(l)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-[12px] leading-none font-medium">{l.nativeName}</p>
          <p className="text-muted-foreground mt-0.5 text-[10px]">{l.name}</p>
        </button>
        {currentCode === l.code && (
          <Check className="h-3 w-3 shrink-0 text-red-400" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(l.code);
          }}
          className={`shrink-0 transition-colors ${isFav ? "hover:text-muted-foreground text-yellow-400" : "text-muted-foreground/30 hover:text-yellow-400"}`}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className="h-3 w-3" fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search language..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="nm-inset text-foreground placeholder:text-muted-foreground w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/20"
      />
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {/* Favorites */}
        {displayFavs.length > 0 && (
          <div className="space-y-1.5">
            {!allFiltered && (
              <p className="text-muted-foreground/50 px-1 text-[10px] font-medium tracking-wide uppercase">
                Favorites
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {displayFavs.map((l) => (
                <LangButton key={l.code} l={l} />
              ))}
            </div>
          </div>
        )}

        {/* Other languages */}
        {!allFiltered && displayOthers.length > 0 && (
          <div className="space-y-1.5">
            <button
              onClick={() => setShowOthers((v) => !v)}
              className="text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1 px-1 text-[10px] font-medium tracking-wide uppercase transition-colors"
            >
              Other languages
              <span className="text-[9px]">{showOthers ? "▲" : "▼"}</span>
            </button>
            {showOthers && (
              <div className="grid grid-cols-2 gap-1.5">
                {displayOthers.map((l) => (
                  <LangButton key={l.code} l={l} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search results — others */}
        {allFiltered && showOthersSection && (
          <div className="grid grid-cols-2 gap-1.5">
            {displayOthers.map((l) => (
              <LangButton key={l.code} l={l} />
            ))}
          </div>
        )}

        {allFiltered &&
          displayFavs.length === 0 &&
          displayOthers.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No language found
            </p>
          )}
      </div>
    </div>
  );
}
