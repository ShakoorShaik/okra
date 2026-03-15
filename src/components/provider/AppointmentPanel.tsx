'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Clock, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { Appointment, CarePlan } from '@/types';
import { getUrgencyColor, getUrgencyLabel, getTimeIcon } from '@/lib/utils';
import CarePlanView from './CarePlanView';

interface Props {
  appointment: Appointment | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Appointment>) => void;
}

export default function AppointmentPanel({ appointment, onClose, onUpdate }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleAccept = async () => {
    if (!appointment) return;
    setIsGenerating(true);
    try {
      // Read the logged-in provider from localStorage
      const stored = typeof window !== 'undefined' ? localStorage.getItem('okra_mock_user') : null;
      const providerUser = stored ? JSON.parse(stored) : null;
      const providerId = providerUser?.id ?? null;
      const providerName = providerUser?.name ?? null;

      const res = await fetch('/api/generate-care-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: appointment.id,
          services: appointment.services_requested,
          timePreference: appointment.time_preference,
          notes: appointment.notes,
          providerId,
          providerName,
        }),
      });
      const { carePlan }: { carePlan: CarePlan } = await res.json();
      // Update local store — Supabase Realtime will push this to the care seeker
      onUpdate(appointment.id, {
        status: 'caregiver_accepted',
        watsonx_care_plan: carePlan,
        provider_id: providerId,
        provider_name: providerName,
      });
    } catch {
      // ignore
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!appointment) return;
    setIsMarkingComplete(true);
    try {
      await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointment.id, updates: { status: 'completed' } }),
      });
      onUpdate(appointment.id, { status: 'completed' });
    } catch {
      // ignore
    } finally {
      setIsMarkingComplete(false);
    }
  };

  return (
    <AnimatePresence>
      {appointment && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/40"
          />

          {/* Panel — bottom sheet on mobile, right slide-in on desktop */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed z-40 bg-white dark:bg-[#0f1a12] overflow-y-auto flex flex-col shadow-xl dark:shadow-none ${
              isMobile
                ? 'bottom-0 left-0 right-0 max-h-[88vh] rounded-t-2xl border-t border-gray-200 dark:border-white/10'
                : 'top-0 right-0 bottom-0 w-full max-w-sm border-l border-gray-200 dark:border-white/10'
            }`}
          >
            {/* Drag handle (mobile only) */}
            {isMobile && (
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
              </div>
            )}
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-start justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: getUrgencyColor(appointment.highest_urgency) }}
                />
                <span className="text-gray-900 dark:text-white font-bold text-lg">{appointment.requestor_name}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                  style={{
                    background: getUrgencyColor(appointment.highest_urgency) + '20',
                    borderColor: getUrgencyColor(appointment.highest_urgency) + '50',
                    color: getUrgencyColor(appointment.highest_urgency),
                  }}
                >
                  {getUrgencyLabel(appointment.highest_urgency)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0"
                aria-label="Close panel"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-5 flex-1">
              {/* Services */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Services</p>
                <div className="space-y-1.5">
                  {appointment.services_requested.map(s => (
                    <div key={s} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: getUrgencyColor(appointment.highest_urgency) }}
                      />
                      <span className="text-gray-700 dark:text-gray-200 text-sm">{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time preference */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time Preference</p>
                <p className="text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
                  <Clock size={14} className="text-gray-400" />
                  {getTimeIcon(appointment.time_preference)} {appointment.time_preference}
                </p>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</p>
                <p className="text-gray-600 dark:text-gray-300 text-sm flex items-center gap-1.5">
                  <MapPin size={14} className="text-gray-400" />
                  {appointment.requestor_address || `${appointment.location_lat.toFixed(4)}, ${appointment.location_lng.toFixed(4)}`}
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs">
                  {appointment.location_lat.toFixed(5)}, {appointment.location_lng.toFixed(5)}
                </p>
              </div>

              {/* Notes */}
              {appointment.notes && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient Notes</p>
                  <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 flex gap-2">
                    <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-600 dark:text-gray-300 text-sm">{appointment.notes}</p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</p>
                <span className="text-sm capitalize font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-3 py-1 inline-block">
                  {appointment.status.replace('_', ' ')}
                </span>
              </div>

              {/* Accept button */}
              {appointment.status === 'pending' && !isGenerating && !appointment.watsonx_care_plan && (
                <button
                  onClick={handleAccept}
                  className="w-full min-h-12 bg-green-500 hover:bg-green-400 text-white font-bold text-base rounded-2xl transition-all focus:outline-none focus:ring-4 focus:ring-green-500/30"
                >
                  Accept &amp; Send to Patient
                </button>
              )}

              {/* Generating state */}
              {isGenerating && (
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl px-4 py-4">
                  <Loader2 size={20} className="text-blue-500 dark:text-blue-400 animate-spin flex-shrink-0" />
                  <p className="text-blue-600 dark:text-blue-300 text-sm">Generating care plan &amp; notifying patient...</p>
                </div>
              )}

              {/* Awaiting patient confirmation */}
              {appointment.status === 'caregiver_accepted' && (
                <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-2xl px-4 py-4">
                  <Loader2 size={18} className="text-yellow-500 dark:text-yellow-400 animate-spin flex-shrink-0" />
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">Waiting for patient to confirm this visit.</p>
                </div>
              )}

              {/* Care plan */}
              {appointment.watsonx_care_plan && (
                <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4">
                  <CarePlanView carePlan={appointment.watsonx_care_plan} />
                </div>
              )}

              {/* Mark complete button */}
              {(appointment.status === 'confirmed' || appointment.status === 'in_progress') && (
                <button
                  onClick={handleMarkComplete}
                  disabled={isMarkingComplete}
                  className="w-full min-h-12 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white font-semibold text-base rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-white/20 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <CheckCircle2 size={18} />
                  {isMarkingComplete ? 'Updating...' : 'Mark Complete'}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
