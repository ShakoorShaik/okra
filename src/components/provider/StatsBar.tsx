'use client';

import { Appointment } from '@/types';

interface Props {
  appointments: Appointment[];
}

export default function StatsBar({ appointments }: Props) {
  const pending = appointments.filter(a => a.status === 'pending').length;
  const highPriority = appointments.filter(a => a.highest_urgency === 'High' && a.status !== 'completed').length;
  const confirmed = appointments.filter(a => a.status === 'confirmed').length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 bg-gray-500/10 border border-gray-400/30 rounded-full px-3 py-1">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-gray-600 dark:text-gray-300 text-xs font-medium">{pending} pending</span>
      </div>
      <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-red-600 dark:text-red-300 text-xs font-medium">{highPriority} high priority</span>
      </div>
      <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-green-700 dark:text-green-300 text-xs font-medium">{confirmed} confirmed</span>
      </div>
    </div>
  );
}
