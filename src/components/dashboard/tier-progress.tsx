"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, Award, Zap, Trophy } from "lucide-react";
import { COMMISSION_TIERS, type CommissionTier } from "@/types";

interface TierProgressProps {
  currentTier: CommissionTier;
  paidSubscriptions: number;
  className?: string;
}

const tierConfig = {
  1: { name: "Bronze", icon: TrendingUp, bgColor: "bg-amber-100", textColor: "text-amber-700" },
  2: { name: "Prata", icon: Award, bgColor: "bg-gray-200", textColor: "text-gray-700" },
  3: { name: "Ouro", icon: Zap, bgColor: "bg-yellow-100", textColor: "text-yellow-700" },
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
  const TierIcon = tierStyle.icon;

  const progress = nextTierConfig
    ? Math.min((paidSubscriptions / nextTierConfig.minSubscriptions) * 100, 100)
    : 100;

  const subscriptionsToNext = nextTierConfig
    ? nextTierConfig.minSubscriptions - paidSubscriptions
    : 0;

  return (
    <div className={cn("bg-white rounded-2xl p-6 border border-gray-100 shadow-sm", className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Tier Info */}
        <div className="flex items-center gap-4">
          <div className={cn("h-14 w-14 rounded-xl flex items-center justify-center", tierStyle.bgColor)}>
            <TierIcon className={cn("h-7 w-7", tierStyle.textColor)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nível de Comissões</p>
            <p className="text-xl font-bold text-gray-900">
              Plano {tierStyle.name}
              <span className={cn("ml-2 text-lg font-bold", tierStyle.textColor)}>
                {currentTierConfig.percent}%
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Assinaturas Pagas</p>
            <p className="text-2xl font-bold text-gray-900">{paidSubscriptions}</p>
          </div>
          {nextTierConfig && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Faltam para Próximo</p>
              <p className="text-2xl font-bold text-violet-600">{subscriptionsToNext}</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {nextTierConfig && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-gray-600">
              Evolução do Nível
              <span className="text-gray-400 ml-1">• Rumo ao nível {tierConfig[nextTier!].name}</span>
            </p>
            <p className="text-sm font-bold text-violet-600">{Math.round(progress)}%</p>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3A1D7A] to-[#8E7EEA] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Max Tier */}
      {!nextTierConfig && (
        <div className="mt-6 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 p-4 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-white" />
          <div>
            <p className="font-bold text-white">Parabéns!</p>
            <p className="text-sm text-white/80">Você atingiu o nível máximo de comissões.</p>
          </div>
        </div>
      )}
    </div>
  );
}
