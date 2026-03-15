'use client';

import { SERVICES, SERVICE_URGENCY } from '@/lib/services';
import { cn } from '@/lib/utils';

interface Props {
  selectedServices: string[];
  onChange: (services: string[]) => void;
}

const URGENCY_COLORS = {
  High: {
    header: 'text-red-500 dark:text-red-400',
    dot: 'bg-red-500',
    selected: 'bg-red-500/20 border-red-500 text-red-700 dark:text-red-300',
    unselected: 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-red-400 dark:hover:border-red-500/40',
  },
  Medium: {
    header: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    selected: 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300',
    unselected: 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500/40',
  },
  Low: {
    header: 'text-green-600 dark:text-green-400',
    dot: 'bg-green-500',
    selected: 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300',
    unselected: 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-green-400 dark:hover:border-green-500/40',
  },
};

export default function ServiceSelector({ selectedServices, onChange }: Props) {
  function toggle(service: string) {
    if (selectedServices.includes(service)) {
      onChange(selectedServices.filter(s => s !== service));
    } else {
      onChange([...selectedServices, service]);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Select all services needed:</p>
      {(['High', 'Medium', 'Low'] as const).map(urgency => {
        const colors = URGENCY_COLORS[urgency];
        return (
          <div key={urgency}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('w-2 h-2 rounded-full', colors.dot)} />
              <span className={cn('text-xs font-semibold uppercase tracking-wider', colors.header)}>
                {urgency} Priority
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SERVICES[urgency].map(service => {
                const isSelected = selectedServices.includes(service);
                const _ = SERVICE_URGENCY[service]; // ensure import used
                void _;
                return (
                  <button
                    key={service}
                    onClick={() => toggle(service)}
                    className={cn(
                      'px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-[#0a0f0d]',
                      isSelected ? colors.selected : colors.unselected
                    )}
                  >
                    {service}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
