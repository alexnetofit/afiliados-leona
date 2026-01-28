"use client";

import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { COMMISSION_TIERS, type CommissionTier } from "@/types";

interface TierProgressProps {
  currentTier: CommissionTier;
  paidSubscriptions: number;
  className?: string;
}

const tierConfig = {
  1: { name: "Bronze", color: "bg-amber-500" },
  2: { name: "Prata", color: "bg-slate-400" },
  3: { name: "Ouro", color: "bg-yellow-500" },
};

export function TierProgress({
  currentTier,
  paidSubscriptions,
  className,
}: TierProgressProps) {
  const currentTierConfig = COMMISSION_TIERS[currentTier];
  const tierStyle = tierConfig[currentTier];
  const nextTier = currentTier < 3 ? ((currentTier + 1) as CommissionTier) : null;
  const nextTierConfig = nextTier ? COMMISSION_TIERS[nextTier] : null;

  const progress = nextTierConfig
    ? Math.min((paidSubscriptions / nextTierConfig.minSubscriptions) * 100, 100)
    : 100;

  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]",
      className
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", tierStyle.color)}>
            <Trophy className="h-5 w-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm text-[#6B6F8D]">Nível de comissões</p>
            <p className="text-xl font-semibold text-[#1F1F2E]">
              {tierStyle.name} • {currentTierConfig.percent}%
            </p>
          </div>
        </div>
        
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#1F1F2E]">{paidSubscriptions}</p>
            <p className="text-xs text-[#6B6F8D]">Vendas</p>
          </div>
          {nextTierConfig && (
            <div className="text-center">
              <p className="text-2xl font-semibold text-[#3A1D7A]">
                {nextTierConfig.minSubscriptions - paidSubscriptions}
              </p>
              <p className="text-xs text-[#6B6F8D]">Para próximo</p>
            </div>
          )}
        </div>
      </div>

      {nextTierConfig ? (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#6B6F8D]">Progresso para {tierConfig[nextTier!].name}</span>
            <span className="font-medium text-[#1F1F2E]">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#EEF0F6] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#3A1D7A] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Trophy className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-sm font-medium text-amber-800">Parabéns! Você atingiu o nível máximo.</p>
        </div>
      )}
    </div>
  );
}
