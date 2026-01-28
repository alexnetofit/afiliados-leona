"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, Award, Zap } from "lucide-react";
import { COMMISSION_TIERS, type CommissionTier } from "@/types";

interface TierProgressProps {
  currentTier: CommissionTier;
  paidSubscriptions: number;
  className?: string;
}

const tierIcons = {
  1: TrendingUp,
  2: Award,
  3: Zap,
};

const tierNames = {
  1: "Bronze",
  2: "Prata",
  3: "Ouro",
};

export function TierProgress({
  currentTier,
  paidSubscriptions,
  className,
}: TierProgressProps) {
  const currentTierConfig = COMMISSION_TIERS[currentTier];
  const nextTier = currentTier < 3 ? ((currentTier + 1) as CommissionTier) : null;
  const nextTierConfig = nextTier ? COMMISSION_TIERS[nextTier] : null;

  const progress = nextTierConfig
    ? Math.min(
        (paidSubscriptions / nextTierConfig.minSubscriptions) * 100,
        100
      )
    : 100;

  const subscriptionsToNext = nextTierConfig
    ? nextTierConfig.minSubscriptions - paidSubscriptions
    : 0;

  const TierIcon = tierIcons[currentTier];

  return (
    <div
      className={cn(
        "rounded-xl bg-surface p-6 shadow-card",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-leona p-3">
            <TierIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-secondary">Seu Tier</p>
            <p className="text-xl font-bold text-text-primary">
              {tierNames[currentTier]} - {currentTierConfig.percent}%
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">
            {paidSubscriptions}
          </p>
          <p className="text-sm text-text-secondary">assinaturas pagas</p>
        </div>
      </div>

      {nextTierConfig && (
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-secondary">
              Próximo tier: {tierNames[nextTier!]} ({nextTierConfig.percent}%)
            </span>
            <span className="font-medium text-primary">
              Faltam {subscriptionsToNext} assinaturas
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-background overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-leona transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-text-secondary">
            <span>0</span>
            <span>{nextTierConfig.minSubscriptions}</span>
          </div>
        </div>
      )}

      {!nextTierConfig && (
        <div className="mt-6 rounded-lg bg-success-light p-4 text-center">
          <p className="text-sm font-medium text-success">
            Parabéns! Você atingiu o tier máximo!
          </p>
        </div>
      )}
    </div>
  );
}
