'use client';

import { CarePlan } from '@/types';
import { AlertTriangle, Package, Clock } from 'lucide-react';

interface Props {
  carePlan: CarePlan;
}

export default function CarePlanView({ carePlan }: Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-gray-900 dark:text-white font-bold text-base">IBM watsonx.ai Care Plan</h3>
        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-md">
          IBM
        </span>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-3 py-2">
        <Clock size={14} />
        <span>{carePlan.duration_estimate}</span>
      </div>

      {/* Care plan steps */}
      <div className="space-y-2">
        {carePlan.care_plan.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-600 dark:text-green-400 text-xs font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{step.replace(/^Step \d+:\s*/i, '')}</p>
          </div>
        ))}
      </div>

      {/* Required items */}
      {carePlan.required_items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
            <Package size={12} />
            Required Items
          </div>
          <div className="flex flex-wrap gap-2">
            {carePlan.required_items.map(item => (
              <span
                key={item}
                className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 text-xs px-2.5 py-1 rounded-full"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Safety notes */}
      {carePlan.safety_notes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
            <AlertTriangle size={12} />
            Safety Notes
          </div>
          {carePlan.safety_notes.map((note, i) => (
            <div
              key={i}
              className="flex gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-2"
            >
              <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700 dark:text-amber-200/80 text-sm">{note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
