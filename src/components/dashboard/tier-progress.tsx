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
  1: { name: "Bronze", icon: TrendingUp, color: "from-amber-600 to-amber-500", bg: "bg-amber-100", text: "text-amber-700" },
  2: { name: "Prata", icon: Award, color: "from-gray-500 to-gray-400", bg: "bg-gray-100", text: "text-gray-600" },
  3: { name: "Ouro", icon: Zap, color: "from-yellow-500 to-yellow-400", bg: "bg-yellow-100", text: "text-yellow-700" },
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
    ? Math.min(
        (paidSubscriptions / nextTierConfig.minSubscriptions) * 100,
        100
      )
    : 100;

  const subscriptionsToNext = nextTierConfig
    ? nextTierConfig.minSubscriptions - paidSubscriptions
    : 0;

  return (
    <div
      className={cn(
        "bg-white rounded-2xl p-6 shadow-sm border border-gray-100",
        className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Current Tier Info */}
        <div className="flex items-center gap-4">
          <div className={cn("rounded-2xl p-4 bg-gradient-to-br", tierStyle.color)}>
            <TierIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Seu Tier Atual</p>
            <p className="text-2xl font-bold text-gray-900">
              {tierStyle.name}
              <span className={cn("ml-2 text-lg font-semibold", tierStyle.text)}>
                {currentTierConfig.percent}%
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-8">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#5B3FA6]">
              {paidSubscriptions}
            </p>
            <p className="text-sm text-gray-500">Assinaturas pagas</p>
          </div>
          
          {nextTierConfig && (
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">
                {subscriptionsToNext}
              </p>
              <p className="text-sm text-gray-500">Para próximo tier</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {nextTierConfig && (
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">
              Progresso para <span className="font-semibold text-gray-700">{tierConfig[nextTier!].name}</span> ({nextTierConfig.percent}%)
            </span>
            <span className="font-semibold text-[#5B3FA6]">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3A1D7A] to-[#8E7EEA] transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>0 assinaturas</span>
            <span>{nextTierConfig.minSubscriptions} assinaturas</span>
          </div>
        </div>
      )}

      {/* Max Tier Reached */}
      {!nextTierConfig && (
        <div className="mt-6 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-100">
            <Trophy className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p className="font-semibold text-yellow-800">Parabéns!</p>
            <p className="text-sm text-yellow-700">Você atingiu o tier máximo de comissões!</p>
          </div>
        </div>
      )}
    </div>
  );
}
