'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, AlertCircle, MapPin, Loader2, Navigation } from 'lucide-react';
import OkraLogo from '../OkraLogo';
import { v4 as uuidv4 } from 'uuid';
import { MockUser, Appointment, TimePreference, WatsonxRouterResult } from '@/types';
import { getHighestUrgency, getUrgencyColor, getUrgencyLabel } from '@/lib/utils';
import { SERVICE_URGENCY } from '@/lib/services';
import MicButton from './MicButton';
import ServiceSelector from './ServiceSelector';
import SchedulePicker from './SchedulePicker';
import AppointmentStatus from './AppointmentStatus';
import ThemeToggle from '../ThemeToggle';

export default function RequestorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<MockUser | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [timePreference, setTimePreference] = useState<string>('Flexible');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [parsedResult, setParsedResult] = useState<WatsonxRouterResult | null>(null);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('okra_mock_user');
    if (!stored) { router.push('/'); return; }
    const u: MockUser = JSON.parse(stored);
    if (u.type !== 'requestor') { router.push('/'); return; }
    setUser(u);
  }, [router]);

  const handleTranscript = useCallback(async (text: string) => {
    setTranscript(text);
    setIsParsingVoice(true);
    setParsedResult(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const res = await fetch('/api/parse-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      const result: WatsonxRouterResult = await res.json();
      setParsedResult(result);
      setSelectedServices(result.services);
      if (result.time_suggestion) setTimePreference(result.time_suggestion);
      if (result.notes) setNotes(result.notes);
    } catch {
      // fallback: just show transcript, services stay empty
    } finally {
      clearTimeout(timer);
      setIsParsingVoice(false);
    }
  }, []);

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationAddress('Geolocation not supported — please enter your address manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocationLat(lat);
        setLocationLng(lng);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const data = await res.json();
          const addr = data.address;
          const label = [addr.road, addr.city || addr.town || addr.village, addr.state]
            .filter(Boolean).join(', ');
          setLocationAddress(label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
          setLocationAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setLocating(false);
      },
      () => {
        setLocationAddress('Location access denied — your profile location will be used.');
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const geocodeAddress = useCallback(async (address: string) => {
    if (!address.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
      const data = await res.json();
      if (data[0]) {
        setLocationLat(parseFloat(data[0].lat));
        setLocationLng(parseFloat(data[0].lon));
      }
    } catch { /* ignore — will fall back to profile location */ }
  }, []);

  const handleSubmit = async () => {
    if (!user || selectedServices.length === 0) return;
    setIsSubmitting(true);
    setSubmitError('');

    const finalLat = locationLat ?? user.location_lat;
    const finalLng = locationLng ?? user.location_lng;
    const finalAddress = locationAddress.trim() || 'Toronto, ON';

    const appointment: Appointment = {
      id: `appt_${uuidv4()}`,
      requestor_id: user.id,
      requestor_name: user.name,
      requestor_address: finalAddress,
      provider_id: null,
      provider_name: null,
      status: 'pending',
      time_preference: timePreference as TimePreference,
      services_requested: selectedServices,
      highest_urgency: getHighestUrgency(selectedServices),
      watsonx_care_plan: null,
      location_lat: finalLat,
      location_lng: finalLng,
      notes: notes || transcript,
      created_at: new Date().toISOString(),
      scheduled_for: null,
    };

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointment),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSubmitSuccess(true);
      setSelectedServices([]);
      setTranscript('');
      setParsedResult(null);
      setNotes('');
      setTimePreference('Flexible');
      setLocationLat(null);
      setLocationLng(null);
      setLocationAddress('');
    } catch {
      setSubmitError('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0f0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f0d] text-gray-900 dark:text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0a0f0d]/90 backdrop-blur-sm border-b border-gray-200 dark:border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OkraLogo size={28} />
            <span className="font-black text-lg text-gray-900 dark:text-white">Okra</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">{user.name}</span>
            <ThemeToggle />
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-24">
        {/* Welcome */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
            {getGreeting()}, {user.name.split(' ')[0]}.
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 mt-2">How can we help today?</p>
        </motion.section>

        {/* Quick service buttons from preferred services */}
        {user.preferred_services.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-3"
          >
            <h2 className="text-base font-semibold text-gray-600 dark:text-gray-300">Quick request:</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {user.preferred_services.map(service => {
                const urgency = SERVICE_URGENCY[service] ?? 'Low';
                const color = getUrgencyColor(urgency);
                return (
                  <button
                    key={service}
                    onClick={() => {
                      setSelectedServices(prev =>
                        prev.includes(service)
                          ? prev.filter(s => s !== service)
                          : [...prev, service]
                      );
                    }}
                    className="min-h-16 flex items-center gap-3 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/8 border border-gray-200 hover:border-green-500/30 dark:border-white/10 dark:hover:border-green-500/30 rounded-2xl px-4 py-4 text-left transition-all shadow-sm dark:shadow-none"
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-gray-800 dark:text-white text-base font-medium leading-snug">{service}</span>
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
          <span className="text-gray-400 dark:text-gray-500 text-sm whitespace-nowrap">or describe what you need</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
        </div>

        {/* Mic button */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center"
        >
          <MicButton onTranscript={handleTranscript} isProcessing={isParsingVoice} />
        </motion.section>

        {/* Transcript + parsed result */}
        <AnimatePresence>
          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-2"
            >
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">You said:</p>
              <p className="text-gray-900 dark:text-white text-base italic">&ldquo;{transcript}&rdquo;</p>
              {isParsingVoice && (
                <p className="text-blue-500 dark:text-blue-400 text-sm flex items-center gap-2">
                  <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                  Parsing with IBM watsonx.ai...
                </p>
              )}
              {parsedResult && !isParsingVoice && (
                <p className="text-green-600 dark:text-green-400 text-sm">
                  Detected: {parsedResult.services.join(', ')}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Service selector */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <ServiceSelector selectedServices={selectedServices} onChange={setSelectedServices} />
        </motion.section>

        {/* Urgency indicator */}
        <AnimatePresence>
          {selectedServices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-2 text-base"
            >
              <span className="text-gray-500 dark:text-gray-400">Priority level:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {getUrgencyLabel(getHighestUrgency(selectedServices))}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedule picker */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <SchedulePicker value={timePreference} onChange={setTimePreference} />
        </motion.section>

        {/* Location */}
        <div className="space-y-3">
          <label className="text-sm text-gray-500 dark:text-gray-400 font-medium">Care location</label>

          {/* Manual address input */}
          <input
            type="text"
            value={locationAddress}
            onChange={e => { setLocationAddress(e.target.value); setLocationLat(null); setLocationLng(null); }}
            onBlur={() => locationAddress.trim() && geocodeAddress(locationAddress)}
            placeholder="Type your address, e.g. 123 King St W, Toronto"
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50 dark:focus:border-green-500/40"
          />

          {/* Auto-detect button */}
          <button
            type="button"
            onClick={detectLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-green-400 dark:hover:border-green-500/50 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
          >
            {locating
              ? <Loader2 size={14} className="animate-spin text-green-500" />
              : locationLat
              ? <Navigation size={14} className="text-green-500" />
              : <MapPin size={14} />
            }
            {locating ? 'Detecting your location...' : locationLat ? 'Location detected' : 'Auto-detect my location'}
          </button>

          {locationLat && locationAddress && (
            <p className="text-xs text-green-600 dark:text-green-400">Location set — {locationAddress}</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 font-medium">Additional notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any specific instructions, medical conditions, or special requirements..."
            rows={3}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-base focus:outline-none focus:border-green-500/50 dark:focus:border-green-500/40 resize-none"
          />
        </div>

        {/* Submit button */}
        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedServices.length === 0}
            className="w-full min-h-14 bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xl rounded-2xl transition-all duration-200 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] focus:outline-none focus:ring-4 focus:ring-green-500/30 shadow-lg shadow-green-500/20"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              'Request Care'
            )}
          </button>

          {selectedServices.length === 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm">Select at least one service to continue</p>
          )}
        </div>

        {/* Success/error feedback */}
        <AnimatePresence>
          {submitSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-2xl px-4 py-4"
            >
              <CheckCircle2 size={22} className="text-green-500 dark:text-green-400 flex-shrink-0" />
              <div>
                <p className="text-green-700 dark:text-green-300 font-semibold text-base">Care request submitted!</p>
                <p className="text-green-600/70 dark:text-green-400/70 text-sm">A care worker will be assigned shortly.</p>
              </div>
            </motion.div>
          )}
          {submitError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl px-4 py-4"
            >
              <AlertCircle size={22} className="text-red-500 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-600 dark:text-red-300 text-base">{submitError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Appointment status */}
        <div className="pt-4 border-t border-gray-100 dark:border-white/5">
          <AppointmentStatus userId={user.id} />
        </div>
      </main>
    </div>
  );
}
