import React from "react";
import { Filter } from 'lucide-react';
import type { TierFilter, LevelFilter, PriceFilter } from "./CatalogView.types";

interface CatalogViewFiltersProps {
  tierFilter: TierFilter;
  setTierFilter: (tier: TierFilter) => void;
  levelFilter: LevelFilter;
  setLevelFilter: (level: LevelFilter) => void;
  priceFilter: PriceFilter;
  setPriceFilter: (price: PriceFilter) => void;
}

export const CatalogViewFilters: React.FC<CatalogViewFiltersProps> = ({
  tierFilter,
  setTierFilter,
  levelFilter,
  setLevelFilter,
  priceFilter,
  setPriceFilter,
}) => {
  const selectStyles = "p-1.5 px-3 bg-[var(--bg-tertiary,#18181b)] border border-solid border-[var(--border-subtle,#27272a)] rounded-md text-[var(--text-primary,#e5e5e5)] text-[13px] outline-none transition-colors focus:border-[var(--accent,#7c3aed)]";

  return (
    <div className="p-3 px-8 border-b border-solid border-[var(--border-subtle,#27272a)] flex gap-3 items-center bg-[var(--bg-secondary,#111113)]">
      <Filter size={16} className="text-[#a1a1aa]" />
      
      {/* Tier Filter */}
      <select aria-label="Selection" value={tierFilter}
        onChange={(e) => setTierFilter(e.target.value as TierFilter)}
        className={selectStyles}
      >
        <option value="ALL">All Tiers</option>
        <option value="CORE">CORE (Foundations)</option>
        <option value="OPS">OPS (Operations)</option>
        <option value="AGENTS">AGENTS (Advanced)</option>
      </select>

      {/* Level Filter */}
      <select aria-label="Selection" value={levelFilter}
        onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
        className={selectStyles}
      >
        <option value="all">All Levels</option>
        <option value="Beginner">Beginner</option>
        <option value="Intermediate">Intermediate</option>
        <option value="Expert">Expert</option>
      </select>

      {/* Price Filter */}
      <select aria-label="Selection" value={priceFilter}
        onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}
        className={selectStyles}
      >
        <option value="free">Free Only</option>
        <option value="paid">Paid Only</option>
        <option value="all">All Prices</option>
      </select>
    </div>
  );
};
