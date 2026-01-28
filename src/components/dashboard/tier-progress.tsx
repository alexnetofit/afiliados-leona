"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, Award, Zap, Trophy, Sparkles } from "lucide-react";
import { COMMISSION_TIERS, type CommissionTier } from "@/types";

interface TierProgressProps {
  currentTier: CommissionTier;
  paidSubscriptions: number;
  className?: string;
}

const tierConfig = {
  1: { name: "Bronze", icon: TrendingUp, color: "from-amber-500 to-amber-600", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  2: { name: "Prata", icon: Award, color: "from-slate-400 to-slate-500", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  3: { name: "Ouro", icon: Zap, color: "from-yellow-400 to-yellow-500", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
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
        "bg-white rounded-[32px] p-8 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
        <TierIcon className="h-32 w-32" />
      </div>

      <div className="relative z-10 flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("rounded-2xl p-4 bg-gradient-to-br shadow-lg", tierStyle.color)}>
              <TierIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nível de Comissões</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Plano {tierStyle.name}
              </h3>
            </div>
          </div>
          <div className={cn("px-4 py-2 rounded-2xl border-2 font-black text-lg", tierStyle.bg, tierStyle.text, tierStyle.border)}>
            {currentTierConfig.percent}%
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assinaturas Pagas</p>
            <p className="text-2xl font-black text-slate-900">{paidSubscriptions}</p>
          </div>
          {nextTierConfig ? (
            <div className="p-5 rounded-2xl bg-[#EDE9FE] border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Faltam para Próximo</p>
              <p className="text-2xl font-black text-[#3A1D7A]">{subscriptionsToNext}</p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-yellow-50 border border-yellow-100 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
            </div>
          )}
        </div>

        {/* Progress Section */}
        {nextTierConfig ? (
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm font-bold text-slate-900">Evolução do Nível</p>
                <p className="text-xs font-medium text-slate-400">Rumo ao nível {tierConfig[nextTier!].name}</p>
              </div>
              <p className="text-lg font-black text-[#3A1D7A]">{Math.round(progress)}%</p>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3A1D7A] via-[#5B3FA6] to-[#8E7EEA] transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 p-6 flex items-center gap-4 shadow-lg shadow-yellow-200">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-black text-white tracking-tight">Status Lendário</p>
              <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Comissão máxima de 40% ativa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
