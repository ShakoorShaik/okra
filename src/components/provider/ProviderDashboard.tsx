'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CalendarDays, Bot, Search, X as XIcon, Sparkles, Loader2, MapPin, ArrowLeftRight, Plus } from 'lucide-react';
import OkraLogo from '../OkraLogo';
import { MockUser, Appointment } from '@/types';
import { supabase } from '@/lib/supabase';
import { useOkraStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';
import StatsBar from './StatsBar';
import AppointmentPanel from './AppointmentPanel';
import ThemeToggle from '../ThemeToggle';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

export default function ProviderDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser] = useState<MockUser | null>(null);
  const { appointments, setAppointments, addAppointment, updateAppointment, selectedAppointment, setSelectedAppointment, setProviderServices } = useOkraStore();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bestPicks, setBestPicks] = useState<Appointment[] | null>(null);
  const [pickingBest, setPickingBest] = useState(false);
  const [picksError, setPicksError] = useState('');
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<'search' | 'picks' | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('okra_mock_user');
    if (!stored) { router.push('/'); return; }
    const u: MockUser = JSON.parse(stored);
    if (u.type !== 'provider') { router.push('/'); return; }
    setUser(u);
    setProviderServices(u.services_offered);
  }, [router, setProviderServices]);

  const loadAppointments = useCallback(async () => {
    try {
      const res = await fetch('/api/appointments');
      if (!res.ok) return;
      const data: Appointment[] = await res.json();
      setAppointments(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [setAppointments]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' },
        (payload) => { addAppointment(payload.new as Appointment); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (payload) => { updateAppointment((payload.new as Appointment).id, payload.new as Appointment); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'appointments' },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setAppointments(useOkraStore.getState().appointments.filter(a => a.id !== id));
        })
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [addAppointment, updateAppointment, setAppointments]);

  useEffect(() => {
    const interval = setInterval(loadAppointments, 20000);
    return () => clearInterval(interval);
  }, [loadAppointments]);

  const handleAppointmentClick = useCallback((appt: Appointment) => {
    setSelectedAppointment(appt);
  }, [setSelectedAppointment]);

  const handleUpdate = useCallback((id: string, updates: Partial<Appointment>) => {
    updateAppointment(id, updates);
    setSelectedAppointment(useOkraStore.getState().appointments.find(a => a.id === id) ?? null);
  }, [updateAppointment, setSelectedAppointment]);

  function geoDistKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  function scorePending(lat: number, lng: number, pool: Appointment[]): Appointment[] {
    if (!user) return [];
    const urgencyPenalty: Record<string, number> = { High: 0, Medium: 3, Low: 6 };
    return pool
      .filter(a =>
        a.status === 'pending' && a.location_lat && a.location_lng &&
        a.services_requested.some(s => user.services_offered.includes(s))
      )
      .map(a => ({ appt: a, score: geoDistKm(lat, lng, a.location_lat, a.location_lng) + (urgencyPenalty[a.highest_urgency] ?? 3) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(s => s.appt);
  }

  function findBestPicks() {
    if (!user) return;
    if (!navigator.geolocation) { setPicksError('Geolocation not supported.'); return; }
    setPickingBest(true);
    setPicksError('');
    setBestPicks(null);
    if (isMobile) setMobileSheet('picks');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLastLocation({ lat, lng });
        setBestPicks(scorePending(lat, lng, appointments));
        setPickingBest(false);
      },
      () => {
        const urgencyRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
        const pending = appointments
          .filter(a => a.status === 'pending' && a.services_requested.some(s => user.services_offered.includes(s)))
          .sort((a, b) => (urgencyRank[a.highest_urgency] ?? 1) - (urgencyRank[b.highest_urgency] ?? 1))
          .slice(0, 3);
        setBestPicks(pending);
        setPicksError('Location unavailable — sorted by urgency instead.');
        setPickingBest(false);
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }

  async function handleAcceptAll() {
    if (!bestPicks || bestPicks.length === 0 || !user) return;
    setAcceptingAll(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('okra_mock_user') : null;
    const providerUser = stored ? JSON.parse(stored) : null;
    const providerId = providerUser?.id ?? null;
    const providerName = providerUser?.name ?? null;

    await Promise.all(
      bestPicks.map(appt =>
        fetch('/api/generate-care-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: appt.id,
            services: appt.services_requested,
            timePreference: appt.time_preference,
            notes: appt.notes,
            providerId,
            providerName,
          }),
        })
          .then(r => r.json())
          .then(({ carePlan }) => {
            updateAppointment(appt.id, {
              status: 'caregiver_accepted',
              watsonx_care_plan: carePlan,
              provider_id: providerId,
              provider_name: providerName,
            });
          })
          .catch(() => {})
      )
    );

    const updatedAppts = useOkraStore.getState().appointments;
    if (lastLocation) {
      const newPicks = scorePending(lastLocation.lat, lastLocation.lng, updatedAppts);
      setBestPicks(newPicks.length > 0 ? newPicks : null);
      if (newPicks.length === 0) setMobileSheet(null);
    } else {
      setBestPicks(null);
      setMobileSheet(null);
    }
    setPicksError('');
    setSwapIndex(null);
    setAcceptingAll(false);
  }

  const relevantAppointments = user
    ? appointments.filter(a =>
        (a.status === 'pending' && a.services_requested.some(s => user.services_offered.includes(s))) ||
        a.provider_id === user.id
      )
    : appointments;

  const q = searchQuery.toLowerCase().trim();
  const searchResults = q
    ? relevantAppointments.filter(a =>
        a.requestor_name.toLowerCase().includes(q) ||
        a.services_requested.some(s => s.toLowerCase().includes(q)) ||
        a.status.replace('_', ' ').includes(q) ||
        a.highest_urgency.toLowerCase().includes(q) ||
        a.time_preference.toLowerCase().includes(q)
      )
    : [];

  const mapStyle = theme === 'dark'
    ? 'mapbox://styles/mapbox/dark-v11'
    : 'mapbox://styles/mapbox/light-v11';

  // Shared picks panel content (used in desktop sidebar + mobile sheet)
  function renderPicksContent(compact = false) {
    if (!user) return null;
    const picks = bestPicks ?? [];
    const pickedIds = new Set(picks.map(a => a.id));
    const swapCandidates = appointments.filter(a =>
      a.status === 'pending' && a.location_lat && a.location_lng &&
      a.services_requested.some(s => user.services_offered.includes(s)) &&
      !pickedIds.has(a.id)
    );
    const px = compact ? 'px-2' : 'px-4';
    const py = compact ? 'py-2' : 'py-3';
    const textSm = compact ? 'text-xs' : 'text-sm';
    const iconSz = compact ? 11 : 14;

    if (pickingBest) {
      return (
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 size={18} className="animate-spin text-green-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Finding nearby picks...</span>
        </div>
      );
    }

    return (
      <>
        {picksError && (
          <p className={`text-xs text-amber-600 dark:text-amber-400 ${px} pt-2`}>{picksError}</p>
        )}
        {picks.length === 0 && swapCandidates.length === 0 ? (
          <p className={`${textSm} text-gray-400 dark:text-gray-500 ${px} ${py}`}>No matching pending requests.</p>
        ) : (
          <>
            {picks.map((appt, i) => (
              <div key={appt.id} className="border-b border-gray-100 dark:border-white/5">
                <div className={`flex items-center gap-1 ${px} ${py}`}>
                  <button
                    onClick={() => { setSelectedAppointment(appt); setSwapIndex(null); setMobileSheet(null); }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`${textSm} font-black text-green-500 flex-shrink-0`}>#{i + 1}</span>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: appt.highest_urgency === 'High' ? '#ef4444' : appt.highest_urgency === 'Medium' ? '#f97316' : '#22c55e' }} />
                      <span className={`text-gray-900 dark:text-white ${textSm} font-semibold truncate`}>{appt.requestor_name}</span>
                    </div>
                    <p className={`text-gray-500 dark:text-gray-400 text-xs truncate pl-5`}>{appt.highest_urgency} · {appt.services_requested[0]}</p>
                  </button>
                  <button
                    title="Swap"
                    onClick={() => setSwapIndex(swapIndex === i ? null : i)}
                    className={`flex-shrink-0 p-1.5 rounded transition-colors ${swapIndex === i ? 'text-green-500 bg-green-50 dark:bg-green-500/10' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                  >
                    <ArrowLeftRight size={iconSz} />
                  </button>
                  <button
                    title="Remove"
                    onClick={() => { setBestPicks(picks.filter((_, j) => j !== i)); setSwapIndex(null); }}
                    className="flex-shrink-0 p-1.5 rounded text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <XIcon size={iconSz} />
                  </button>
                </div>
                {swapIndex === i && (
                  <div className="border-t border-gray-100 dark:border-white/5 max-h-40 overflow-y-auto bg-gray-50 dark:bg-white/5">
                    {swapCandidates.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">No other candidates.</p>
                    ) : swapCandidates.map(c => (
                      <button key={c.id}
                        onClick={() => { setBestPicks(picks.map((p, j) => j === i ? c : p)); setSwapIndex(null); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.highest_urgency === 'High' ? '#ef4444' : c.highest_urgency === 'Medium' ? '#f97316' : '#22c55e' }} />
                          <span className="text-gray-900 dark:text-white text-xs font-medium truncate">{c.requestor_name}</span>
                        </div>
                        <p className="text-gray-400 dark:text-gray-500 text-xs truncate pl-3">{c.highest_urgency} · {c.services_requested[0]}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {picks.length < 3 && swapCandidates.length > 0 && (
              <div className="border-b border-gray-100 dark:border-white/5">
                <button
                  onClick={() => setSwapIndex(swapIndex === -1 ? null : -1)}
                  className={`w-full flex items-center gap-2 ${px} ${py} ${textSm} transition-colors ${swapIndex === -1 ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  <Plus size={iconSz} /> Add a pick
                </button>
                {swapIndex === -1 && (
                  <div className="border-t border-gray-100 dark:border-white/5 max-h-40 overflow-y-auto bg-gray-50 dark:bg-white/5">
                    {swapCandidates.map(c => (
                      <button key={c.id}
                        onClick={() => { setBestPicks([...picks, c]); setSwapIndex(null); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.highest_urgency === 'High' ? '#ef4444' : c.highest_urgency === 'Medium' ? '#f97316' : '#22c55e' }} />
                          <span className="text-gray-900 dark:text-white text-xs font-medium truncate">{c.requestor_name}</span>
                        </div>
                        <p className="text-gray-400 dark:text-gray-500 text-xs truncate pl-3">{c.highest_urgency} · {c.services_requested[0]}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {picks.length > 0 && (
              <div className={`${px} ${py}`}>
                <button
                  onClick={handleAcceptAll}
                  disabled={acceptingAll}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {acceptingAll ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {acceptingAll ? 'Sending requests...' : 'Accept All & Notify Patients'}
                </button>
              </div>
            )}
          </>
        )}
      </>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0f0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-white dark:bg-[#0a0f0d] text-gray-900 dark:text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 z-20 bg-white/90 dark:bg-[#0a0f0d]/90 backdrop-blur-sm border-b border-gray-200 dark:border-white/5 px-4 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OkraLogo size={26} />
            <span className="font-black text-base text-gray-900 dark:text-white">Okra</span>
            <span className="text-gray-500 dark:text-gray-500 text-sm hidden sm:block">Provider: {user.name}</span>
          </div>
          <StatsBar appointments={relevantAppointments} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back</span>
            </button>
          </div>
        </div>
      </header>

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden" onClick={() => setSearchOpen(false)}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Loading appointments...</p>
            </div>
          </div>
        ) : (
          <MapView
            key={mapStyle}
            appointments={relevantAppointments}
            providerServices={user.services_offered}
            onAppointmentClick={handleAppointmentClick}
            mapStyle={mapStyle}
            isDark={theme === 'dark'}
            bestPickIds={bestPicks?.map(a => a.id) ?? []}
          />
        )}

        {/* Mobile stats pill */}
        {!loading && (
          <div className="md:hidden absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/90 dark:bg-[#0a0f0d]/80 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-full px-4 py-1.5 shadow-sm pointer-events-none">
            <p className="text-xs font-semibold text-gray-900 dark:text-white whitespace-nowrap">
              {relevantAppointments.filter(a => a.status !== 'completed').length} active · tap a dot to view
            </p>
          </div>
        )}

        {/* Desktop left overlays */}
        {!loading && (
          <div className="hidden md:flex absolute top-3 left-3 z-10 flex-col gap-2 w-56">
            {/* Search */}
            <div className="bg-white/90 dark:bg-[#0a0f0d]/80 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl shadow-sm dark:shadow-none overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search patients, services..."
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none min-w-0"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchOpen(false); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
                    <XIcon size={13} />
                  </button>
                )}
              </div>
              {searchOpen && searchQuery && (
                <div className="border-t border-gray-200 dark:border-white/10 max-h-64 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-500 text-xs px-3 py-2">No results found.</p>
                  ) : searchResults.map(appt => (
                    <button key={appt.id}
                      onClick={() => { setSelectedAppointment(appt); setSearchOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: appt.highest_urgency === 'High' ? '#ef4444' : appt.highest_urgency === 'Medium' ? '#f97316' : '#22c55e' }} />
                        <span className="text-gray-900 dark:text-white text-sm font-medium truncate">{appt.requestor_name}</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-xs truncate mt-0.5 pl-4">
                        {appt.services_requested[0]}{appt.services_requested.length > 1 ? ` +${appt.services_requested.length - 1}` : ''} · {appt.status.replace('_', ' ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="bg-white/90 dark:bg-[#0a0f0d]/80 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 shadow-sm dark:shadow-none">
              <p className="text-gray-900 dark:text-white text-sm font-semibold">{relevantAppointments.filter(a => a.status !== 'completed').length} active appointments</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Click a dot to view details</p>
            </div>
            <button onClick={() => router.push('/provider/schedule')}
              className="flex items-center gap-2 bg-white/90 dark:bg-[#0a0f0d]/80 backdrop-blur-sm border border-green-300 dark:border-green-500/30 hover:border-green-400 dark:hover:border-green-500/60 rounded-xl px-3 py-2 shadow-sm dark:shadow-none transition-colors text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
            >
              <CalendarDays size={15} />
              <span className="text-sm font-semibold">Daily Schedule</span>
            </button>
            <button onClick={() => router.push('/provider/agent')}
              className="flex items-center gap-2 bg-white/90 dark:bg-[#0a0f0d]/80 backdrop-blur-sm border border-green-300 dark:border-green-500/30 hover:border-green-400 dark:hover:border-green-500/60 rounded-xl px-3 py-2 shadow-sm dark:shadow-none transition-colors text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
            >
              <Bot size={15} />
              <span className="text-sm font-semibold">AI Assistant</span>
            </button>
            <button onClick={findBestPicks} disabled={pickingBest}
              className="flex items-center gap-2 bg-white/90 dark:bg-[#0a0f0d]/80 backdrop-blur-sm border border-green-300 dark:border-green-500/30 hover:border-green-400 dark:hover:border-green-500/60 rounded-xl px-3 py-2 shadow-sm dark:shadow-none transition-colors text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50"
            >
              {pickingBest ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              <span className="text-sm font-semibold">Best Picks</span>
            </button>

            {/* Desktop picks panel */}
            {(bestPicks !== null || pickingBest) && (
              <div className="bg-white/95 dark:bg-[#0a0f0d]/95 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl shadow-sm dark:shadow-none overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-white/10">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1">
                    <Sparkles size={12} className="text-green-500" /> Top Picks
                  </span>
                  <button onClick={() => { setBestPicks(null); setPicksError(''); setSwapIndex(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XIcon size={13} />
                  </button>
                </div>
                {renderPicksContent(true)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom bar */}
      {!loading && (
        <div className="flex md:hidden flex-shrink-0 bg-white/95 dark:bg-[#0a0f0d]/95 backdrop-blur-sm border-t border-gray-200 dark:border-white/10">
          <button onClick={() => setMobileSheet(mobileSheet === 'search' ? null : 'search')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${mobileSheet === 'search' ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}
          >
            <Search size={20} />
            <span className="text-[10px] font-semibold">Search</span>
          </button>
          <button onClick={() => router.push('/provider/schedule')}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <CalendarDays size={20} />
            <span className="text-[10px] font-semibold">Schedule</span>
          </button>
          <button onClick={() => router.push('/provider/agent')}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <Bot size={20} />
            <span className="text-[10px] font-semibold">AI</span>
          </button>
          <button onClick={findBestPicks} disabled={pickingBest}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors disabled:opacity-50 ${mobileSheet === 'picks' || bestPicks !== null ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {pickingBest ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            <span className="text-[10px] font-semibold">Best Picks</span>
          </button>
        </div>
      )}

      {/* Mobile sheets */}
      <AnimatePresence>
        {isMobile && mobileSheet === 'search' && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setMobileSheet(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#0f1a12] rounded-t-2xl border-t border-gray-200 dark:border-white/10 shadow-xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
                <Search size={18} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search patients, services..."
                  className="flex-1 bg-transparent text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-gray-400 flex-shrink-0">
                    <XIcon size={16} />
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {!searchQuery ? (
                  <p className="text-gray-400 dark:text-gray-500 text-sm px-4 py-4">Type to search patients or services.</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-500 text-sm px-4 py-4">No results found.</p>
                ) : searchResults.map(appt => (
                  <button key={appt.id}
                    onClick={() => { setSelectedAppointment(appt); setMobileSheet(null); setSearchQuery(''); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: appt.highest_urgency === 'High' ? '#ef4444' : appt.highest_urgency === 'Medium' ? '#f97316' : '#22c55e' }} />
                      <span className="text-gray-900 dark:text-white font-semibold">{appt.requestor_name}</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm truncate mt-0.5 pl-5">
                      {appt.services_requested[0]}{appt.services_requested.length > 1 ? ` +${appt.services_requested.length - 1}` : ''} · {appt.status.replace('_', ' ')}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}

        {isMobile && mobileSheet === 'picks' && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setMobileSheet(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#0f1a12] rounded-t-2xl border-t border-gray-200 dark:border-white/10 shadow-xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
                <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-green-500" /> Top Picks
                </span>
                <button onClick={() => { setMobileSheet(null); setBestPicks(null); setPicksError(''); setSwapIndex(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                  <XIcon size={18} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {renderPicksContent(false)}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Appointment panel */}
      <AppointmentPanel
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
