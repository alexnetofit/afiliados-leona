"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AffiliateFilterState {
  search: string;
  tier: string;
  status: string;
  sortBy: string;
  onlyWithSales: boolean;
}

interface AffiliateFiltersProps {
  filters: AffiliateFilterState;
  onChange: (filters: AffiliateFilterState) => void;
  totalCount: number;
  filteredCount: number;
}

const SORT_OPTIONS = [
  { value: "created-desc", label: "Mais recentes" },
  { value: "created-asc", label: "Mais antigos" },
  { value: "sales-desc", label: "Mais vendas" },
  { value: "sales-asc", label: "Menos vendas" },
  { value: "commissions-desc", label: "Maior comissão" },
  { value: "commissions-asc", label: "Menor comissão" },
  { value: "name-asc", label: "Nome A-Z" },
  { value: "name-desc", label: "Nome Z-A" },
];

const TIER_OPTIONS = [
  { value: "all", label: "Todos os tiers" },
  { value: "1", label: "Bronze (30%)" },
  { value: "2", label: "Prata (35%)" },
  { value: "3", label: "Ouro (40%)" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

export function AffiliateFilters({ filters, onChange, totalCount, filteredCount }: AffiliateFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onChange({ ...filters, search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateFilter = useCallback((key: keyof AffiliateFilterState, value: string | boolean) => {
    onChange({ ...filters, [key]: value });
  }, [filters, onChange]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    onChange({
      search: "",
      tier: "all",
      status: "all",
      sortBy: "created-desc",
      onlyWithSales: false,
    });
  }, [onChange]);

  const hasActiveFilters = 
    filters.search !== "" || 
    filters.tier !== "all" || 
    filters.status !== "all" || 
    filters.sortBy !== "created-desc" || 
    filters.onlyWithSales;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar afiliado, código ou email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              "w-full h-9 pl-9 pr-3 text-sm",
              "bg-zinc-50 border border-zinc-200 rounded-lg",
              "placeholder:text-zinc-400 text-zinc-900",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
              "transition-all"
            )}
          />
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-zinc-200" />

        {/* Tier Filter */}
        <select
          value={filters.tier}
          onChange={(e) => updateFilter("tier", e.target.value)}
          className={cn(
            "h-9 px-3 text-sm rounded-lg border cursor-pointer",
            "bg-zinc-50 border-zinc-200 text-zinc-700",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
            filters.tier !== "all" && "bg-primary-50 border-primary-200 text-primary-700"
          )}
        >
          {TIER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className={cn(
            "h-9 px-3 text-sm rounded-lg border cursor-pointer",
            "bg-zinc-50 border-zinc-200 text-zinc-700",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
            filters.status !== "all" && "bg-primary-50 border-primary-200 text-primary-700"
          )}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) => updateFilter("sortBy", e.target.value)}
          className={cn(
            "h-9 px-3 text-sm rounded-lg border cursor-pointer",
            "bg-zinc-50 border-zinc-200 text-zinc-700",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          )}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-zinc-200" />

        {/* Only with sales toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={filters.onlyWithSales}
            onClick={() => updateFilter("onlyWithSales", !filters.onlyWithSales)}
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              filters.onlyWithSales ? "bg-primary-500" : "bg-zinc-300"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                filters.onlyWithSales && "translate-x-4"
              )}
            />
          </button>
          <span className="text-sm text-zinc-600 whitespace-nowrap">Com vendas</span>
        </label>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className={cn(
              "flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg",
              "bg-zinc-100 hover:bg-zinc-200 text-zinc-600",
              "transition-colors"
            )}
          >
            <X className="h-3.5 w-3.5" />
            Limpar
          </button>
        )}

        {/* Results count */}
        <div className="hidden lg:flex items-center gap-1.5 ml-auto text-sm text-zinc-500">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{filteredCount} de {totalCount}</span>
        </div>
      </div>
    </div>
  );
}
