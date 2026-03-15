'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Eye, EyeOff, Loader2, AlertCircle, MapPin, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MockUser } from '@/types';
import ThemeToggle from '../ThemeToggle';

type Mode = 'signin' | 'signup';
type Role = 'requestor' | 'provider';

const PROVIDER_SERVICES = [
  'Post-surgery care', 'Vital signs monitoring', 'Night care',
  'Medical appointment escort', 'Bed transfer', 'Personal hygiene',
  'Assistance with daily living', 'Dementia care', 'Check-in visits',
  'Companionship', 'Meal preparations and grocery shopping',
  'Light mobility exercises', 'Medication reminders',
  'Activities for dementia patients',
];

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('requestor');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyPrompt, setVerifyPrompt] = useState(false);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [locating, setLocating] = useState(false);

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationLabel('Geolocation not supported by your browser.');
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
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const data = await res.json();
          const addr = data.address;
          const label = [addr.road, addr.city || addr.town || addr.village, addr.state]
            .filter(Boolean).join(', ');
          setLocationLabel(label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
          setLocationLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setLocating(false);
      },
      () => {
        setLocationLabel('Location access denied — Toronto will be used as default.');
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) { setError('Supabase is not configured.'); return; }
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        const user = data.user;
        if (!user) { setVerifyPrompt(true); setLoading(false); return; }

        const lat = locationLat ?? 43.6532;
        const lng = locationLng ?? -79.3832;

        const { error: profileError } = await supabase.from('profiles').insert({
          id: user.id,
          name,
          role,
          location_lat: lat,
          location_lng: lng,
        });
        if (profileError) throw profileError;

        storeAndRedirect(user.id, name, role, lat, lng);
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        const userId = data.user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        // If no profile yet, default to provider so they can still get in
        storeAndRedirect(
          userId,
          profile?.name ?? data.user.email ?? 'User',
          (profile?.role as Role) ?? 'provider',
          profile?.location_lat,
          profile?.location_lng,
        );
      }
    } catch (err: unknown) {
      console.error('[Auth] error:', err);
      const raw =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message)
        : 'Something went wrong.';
      const msg = raw.toLowerCase().includes('rate limit')
        ? 'Too many sign-up attempts. Please wait a few minutes or use a different email.'
        : raw;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function storeAndRedirect(
    id: string,
    displayName: string,
    userRole: Role,
    lat = 43.6532,
    lng = -79.3832,
  ) {
    const mockUser: MockUser = {
      id,
      type: userRole,
      name: displayName,
      location_lat: lat,
      location_lng: lng,
      preferred_services: userRole === 'requestor'
        ? ['Companionship', 'Meal preparations and grocery shopping', 'Medication reminders']
        : [],
      services_offered: userRole === 'provider' ? PROVIDER_SERVICES : [],
    };
    localStorage.setItem('okra_mock_user', JSON.stringify(mockUser));
    router.push(userRole === 'provider' ? '/provider' : '/requestor');
  }

  if (verifyPrompt) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0f0d] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
            <Leaf size={24} className="text-green-500 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Check your email</h2>
          <p className="text-gray-500 dark:text-gray-400">
            We sent a confirmation link to <span className="font-semibold text-gray-900 dark:text-white">{email}</span>. Click it to activate your account, then sign in.
          </p>
          <button
            onClick={() => { setVerifyPrompt(false); setMode('signin'); }}
            className="text-green-500 dark:text-green-400 font-semibold hover:underline text-sm"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f0d] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(20,83,45,0.08)_0%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(20,83,45,0.2)_0%,_transparent_70%)]" />

      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <button onClick={() => router.push('/')} className="inline-flex items-center gap-2 mb-2">
            <Leaf size={22} className="text-green-400" />
            <span className="font-black text-2xl text-gray-900 dark:text-white">Okra</span>
          </button>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Rooted in Care, Built for the Home.</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#111814] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-sm dark:shadow-none space-y-6">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setLocationLat(null); setLocationLng(null); setLocationLabel(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === m
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Full name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Martha Jenkins"
                      required={mode === 'signup'}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:border-green-400 dark:focus:border-green-500/50"
                    />
                  </div>

                  {/* Location — requestors only */}
                  {role === 'requestor' && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Your location</label>
                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={locating}
                        className="w-full flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-green-400 dark:hover:border-green-500/50 rounded-xl px-4 py-3 text-sm transition-colors disabled:opacity-50"
                      >
                        {locating ? (
                          <Loader2 size={15} className="animate-spin text-green-500 flex-shrink-0" />
                        ) : locationLat ? (
                          <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                        ) : (
                          <MapPin size={15} className="text-gray-400 flex-shrink-0" />
                        )}
                        <span className={locationLat ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                          {locating ? 'Detecting...' : locationLabel || 'Use my current location'}
                        </span>
                      </button>
                      {!locationLat && !locating && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 pl-1">
                          Helps us match you with nearby caregivers. Defaults to Toronto if skipped.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Role */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">I am a...</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['requestor', 'provider'] as Role[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => { setRole(r); setLocationLat(null); setLocationLng(null); setLocationLabel(''); }}
                          className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                            role === r
                              ? 'bg-green-500/10 border-green-400 dark:border-green-500/50 text-green-600 dark:text-green-400'
                              : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {r === 'requestor' ? '🧓 Care Seeker' : '🩺 Care Provider'}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:border-green-400 dark:focus:border-green-500/50"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 pr-11 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:border-green-400 dark:focus:border-green-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3 py-2"
                >
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
