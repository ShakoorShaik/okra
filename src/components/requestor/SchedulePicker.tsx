'use client';

import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const OPTIONS = [
  { value: 'Morning', emoji: '🌅', label: 'Morning', sub: '8am – 12pm' },
  { value: 'Afternoon', emoji: '☀️', label: 'Afternoon', sub: '12pm – 5pm' },
  { value: 'Night', emoji: '🌙', label: 'Night', sub: '5pm – 10pm' },
  { value: 'Flexible', emoji: '⏰', label: 'Flexible', sub: 'Any time works' },
];

export default function SchedulePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">When do you need care?</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {OPTIONS.map(opt => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                'min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl border py-4 px-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/50',
                isSelected
                  ? 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300'
                  : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-green-400 dark:hover:border-green-500/40 hover:bg-gray-100 dark:hover:bg-white/8'
              )}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="font-semibold text-sm">{opt.label}</span>
              <span className="text-xs opacity-60">{opt.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
