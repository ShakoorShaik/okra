import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Urgency, TimePreference } from '@/types';
import { SERVICE_URGENCY } from '@/lib/services';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUrgencyColor(urgency: Urgency): string {
  switch (urgency) {
    case 'High': return '#ef4444';
    case 'Medium': return '#f59e0b';
    case 'Low': return '#22c55e';
  }
}

export function getUrgencyLabel(urgency: Urgency): string {
  switch (urgency) {
    case 'High': return '🔴 High';
    case 'Medium': return '🟡 Medium';
    case 'Low': return '🟢 Low';
  }
}

export function getHighestUrgency(services: string[]): Urgency {
  if (services.some(s => SERVICE_URGENCY[s] === 'High')) return 'High';
  if (services.some(s => SERVICE_URGENCY[s] === 'Medium')) return 'Medium';
  return 'Low';
}

export function getTimeIcon(time: TimePreference): string {
  switch (time) {
    case 'Morning': return '🌅';
    case 'Afternoon': return '☀️';
    case 'Night': return '🌙';
    case 'Flexible': return '⏰';
  }
}

export function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
