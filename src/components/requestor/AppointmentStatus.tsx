'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { Appointment } from '@/types';
import { getUrgencyColor, formatTimeAgo, getTimeIcon } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface Props {
  userId: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-500/10 text-gray-600 dark:text-gray-300 border-gray-400/30',
  caregiver_accepted: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  confirmed: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30',
  in_progress: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  completed: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  caregiver_accepted: 'Awaiting Your Confirmation',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export default function AppointmentStatus({ userId }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/appointments');
      if (!res.ok) return;
      const data: Appointment[] = await res.json();
      setAppointments(data.filter(a => a.requestor_id === userId));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: watch for status changes on this user's appointments
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`requestor-appts-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (payload) => {
          const updated = payload.new as Appointment;
          if (updated.requestor_id !== userId) return;
          setAppointments(prev =>
            prev.map(a => a.id === updated.id ? updated : a)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments' },
        (payload) => {
          const inserted = payload.new as Appointment;
          if (inserted.requestor_id !== userId) return;
          setAppointments(prev => [inserted, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'appointments' },
        (payload) => {
          const deleted = payload.old as { id: string };
          setAppointments(prev => prev.filter(a => a.id !== deleted.id));
        }
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [userId]);

  const handleConfirm = async (appt: Appointment) => {
    setResponding(appt.id + '_confirm');
    try {
      await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appt.id, updates: { status: 'confirmed' } }),
      });
      setAppointments(prev =>
        prev.map(a => a.id === appt.id ? { ...a, status: 'confirmed' } : a)
      );
    } catch {
      // ignore
    } finally {
      setResponding(null);
    }
  };

  const handleReject = async (appt: Appointment) => {
    setResponding(appt.id + '_reject');
    try {
      await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appt.id, updates: { status: 'pending', provider_id: null, provider_name: null, watsonx_care_plan: null } }),
      });
      setAppointments(prev =>
        prev.map(a => a.id === appt.id ? { ...a, status: 'pending', provider_id: null, provider_name: null, watsonx_care_plan: null } : a)
      );
    } catch {
      // ignore
    } finally {
      setResponding(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-base">
        No appointments yet. Submit your first care request above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Appointments</h3>
      {appointments.map(appt => (
        <div key={appt.id}>
          {/* Caregiver-accepted: show confirmation banner */}
          <AnimatePresence>
            {appt.status === 'caregiver_accepted' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-1 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-300 dark:border-yellow-500/30 rounded-2xl p-4"
              >
                <div className="flex items-start gap-3 mb-3">
                  <Clock size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 dark:text-yellow-200 font-semibold text-sm">
                      A caregiver wants to take your appointment
                    </p>
                    {appt.provider_name && (
                      <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-0.5">
                        {appt.provider_name} has accepted your request for{' '}
                        <span className="font-medium">{appt.services_requested.slice(0, 2).join(', ')}</span>
                        {appt.services_requested.length > 2 && ` +${appt.services_requested.length - 2} more`}.
                      </p>
                    )}
                    <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">Do you want to confirm this caregiver?</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(appt)}
                    disabled={!!responding}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
                  >
                    {responding === appt.id + '_confirm' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Confirm
                  </button>
                  <button
                    onClick={() => handleReject(appt)}
                    disabled={!!responding}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 disabled:opacity-50 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl py-2.5 transition-colors border border-gray-200 dark:border-white/10"
                  >
                    {responding === appt.id + '_reject' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <XCircle size={14} />
                    )}
                    Decline
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Standard appointment card */}
          <div
            className={cn(
              'bg-gray-50 dark:bg-white/5 border rounded-2xl p-4 flex items-start gap-3 shadow-sm dark:shadow-none transition-colors',
              appt.status === 'caregiver_accepted'
                ? 'border-yellow-300 dark:border-yellow-500/30'
                : 'border-gray-200 dark:border-white/10'
            )}
          >
            {/* Urgency dot */}
            <div
              className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: getUrgencyColor(appt.highest_urgency) }}
            />

            <div className="flex-1 min-w-0">
              {/* Services */}
              <p className="text-gray-900 dark:text-white font-medium text-base leading-tight">
                {appt.services_requested.slice(0, 2).join(', ')}
                {appt.services_requested.length > 2 && ` +${appt.services_requested.length - 2} more`}
              </p>

              {/* Time & created */}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  {getTimeIcon(appt.time_preference)} {appt.time_preference}
                </span>
                <span className="text-gray-400 dark:text-gray-600 text-xs">{formatTimeAgo(appt.created_at)}</span>
              </div>

              {/* Provider name if assigned */}
              {appt.provider_name && appt.status !== 'pending' && (
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  Caregiver: {appt.provider_name}
                </p>
              )}
            </div>

            {/* Status badge */}
            <span
              className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0',
                STATUS_STYLES[appt.status] ?? STATUS_STYLES.pending
              )}
            >
              {STATUS_LABELS[appt.status] ?? appt.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
