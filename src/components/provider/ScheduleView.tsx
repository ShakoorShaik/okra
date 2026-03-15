'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import OkraLogo from '../OkraLogo';
import { getUrgencyColor } from '@/lib/utils';
import { buildOptimalRoute, haversine } from '@/lib/route';
import { useOkraStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Appointment, MockUser } from '@/types';
import ThemeToggle from '../ThemeToggle';

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
  in_progress: 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300 border-green-200 dark:border-green-500/20',
  completed: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400 border-gray-200 dark:border-white/10',
};

export default function ScheduleView() {
  const router = useRouter();
  const storeAppointments = useOkraStore((s) => s.appointments);
  const setAppointments = useOkraStore((s) => s.setAppointments);
  const [loading, setLoading] = useState(storeAppointments.length === 0);
  const [providerUser, setProviderUser] = useState<MockUser | null>(null);

  // Load provider from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('okra_mock_user');
    if (stored) setProviderUser(JSON.parse(stored));
  }, []);

  // Fetch from DB if store is empty (direct navigation to this page)
  useEffect(() => {
    if (storeAppointments.length > 0) { setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch('/api/appointments');
        if (!res.ok) return;
        const data: Appointment[] = await res.json();
        setAppointments(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, [storeAppointments.length, setAppointments]);

  // Realtime: keep schedule live
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('schedule-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' }, (payload) => {
        const updated = payload.new as Appointment;
        useOkraStore.setState(s => ({
          appointments: s.appointments.map(a => a.id === updated.id ? updated : a),
        }));
      })
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, []);

  // Only show provider's own confirmed/in_progress appointments
  const myAppointments = providerUser
    ? storeAppointments.filter(a =>
        a.provider_id === providerUser.id &&
        (a.status === 'confirmed' || a.status === 'in_progress')
      )
    : storeAppointments.filter(a => a.status === 'confirmed' || a.status === 'in_progress');

  const route = buildOptimalRoute(myAppointments);

  const totalKm = route.reduce((sum, appt, i) => {
    if (i === 0) return sum;
    return sum + haversine(route[i - 1], appt);
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0f0d] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f0d] text-gray-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0a0f0d]/90 backdrop-blur-sm border-b border-gray-200 dark:border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OkraLogo size={26} />
            <span className="font-black text-base">Okra</span>
            <span className="text-gray-400 dark:text-gray-500 text-sm hidden sm:block">/ Daily Schedule</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6 pb-16">
        {/* Title + summary */}
        <div>
          <h1 className="text-2xl font-bold">Today&apos;s Route</h1>
          {route.length > 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {route.length} confirmed {route.length === 1 ? 'visit' : 'visits'} · ~{totalKm.toFixed(1)} km total · Optimised route
            </p>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Only patient-confirmed appointments appear here.</p>
          )}
        </div>

        {route.length === 0 && (
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-4">
            <AlertCircle size={18} className="text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">No confirmed appointments yet. Accept requests and wait for patients to confirm.</p>
          </div>
        )}

        {/* Visit cards */}
        {route.length > 0 && (
          <div className="relative">
            {route.length > 1 && (
              <div className="absolute left-5 top-10 bottom-10 w-px bg-green-200 dark:bg-green-500/20" />
            )}

            <div className="space-y-4">
              {route.map((appt, i) => {
                const distFromPrev = i > 0 ? haversine(route[i - 1], appt) : null;
                const color = getUrgencyColor(appt.highest_urgency);
                const scheduledTime = appt.scheduled_for
                  ? new Date(appt.scheduled_for).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
                  : null;

                return (
                  <div key={appt.id} className="flex gap-4">
                    {/* Step number */}
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm z-10"
                      style={{ background: color }}
                    >
                      {i + 1}
                    </div>

                    {/* Card */}
                    <div className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{appt.requestor_name}</p>
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                            <MapPin size={12} />
                            <span>{appt.requestor_address}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[appt.status] ?? ''}`}>
                          {STATUS_LABEL[appt.status] ?? appt.status}
                        </span>
                      </div>

                      {/* Services */}
                      <div className="flex flex-wrap gap-1.5">
                        {appt.services_requested.map((s) => (
                          <span
                            key={s}
                            className="text-xs px-2 py-0.5 rounded-full border"
                            style={{ background: color + '15', borderColor: color + '40', color }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* Time + distance */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {scheduledTime ?? appt.time_preference}
                        </span>
                        {distFromPrev !== null && (
                          <span className="flex items-center gap-1">
                            <span className="text-green-500">↑</span>
                            {distFromPrev.toFixed(1)} km from previous
                          </span>
                        )}
                        {appt.status === 'completed' && (
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 size={11} />
                            Done
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
