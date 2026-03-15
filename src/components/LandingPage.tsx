'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Heart, Map, ChevronRight } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import OkraLogo from './OkraLogo';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f0d] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(20,83,45,0.12)_0%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(20,83,45,0.25)_0%,_transparent_70%)]" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,197,94,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Floating orbs */}
      {[
        { size: 320, color: '#22c55e', left: 8, top: 15, delay: 0 },
        { size: 220, color: '#16a34a', left: 78, top: 55, delay: 1 },
        { size: 260, color: '#22c55e', left: 48, top: 78, delay: 2 },
        { size: 190, color: '#16a34a', left: 18, top: 68, delay: 3 },
        { size: 230, color: '#22c55e', left: 68, top: 8, delay: 4 },
        { size: 170, color: '#14532d', left: 38, top: 38, delay: 5 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl opacity-[0.06] dark:opacity-10 pointer-events-none"
          style={{
            width: orb.size,
            height: orb.size,
            background: orb.color,
            left: `${orb.left}%`,
            top: `${orb.top}%`,
          }}
          animate={{ x: [0, 30, -30, 0], y: [0, -20, 20, 0] }}
          transition={{ duration: 8 + orb.delay * 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto w-full">
        {/* Logo + Main title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-4 mb-4"
        >
          <OkraLogo size={80} />
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter">
            <span className="text-gray-900 dark:text-white">Okra</span>
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-4 font-light"
        >
          Rooted in Care, Built for the Home.
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-gray-400 dark:text-gray-500 mb-12 text-sm md:text-base"
        >
          Voice-powered requests · IBM watsonx.ai routing · Real-time provider dispatch
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <button
            onClick={() => router.push('/auth')}
            className="group flex items-center justify-center gap-3 bg-green-500 hover:bg-green-400 text-white font-bold px-10 py-6 rounded-2xl text-xl transition-all duration-200 hover:scale-105 hover:shadow-[0_0_40px_rgba(34,197,94,0.4)] shadow-lg shadow-green-500/20"
          >
            <Heart size={24} />
            I Need Care
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => router.push('/auth')}
            className="group flex items-center justify-center gap-3 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 hover:border-green-500/40 dark:border-white/20 dark:hover:border-green-500/50 text-gray-800 dark:text-white font-bold px-10 py-6 rounded-2xl text-xl transition-all duration-200 hover:scale-105"
          >
            <Map size={24} />
            I&apos;m a Care Provider
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-wrap justify-center gap-8 md:gap-16 text-center"
        >
          {[
            { value: '50K+', label: 'Seniors Require Long-Term Care' },
            { value: '87%', label: 'Need Support with Routine' },
            { value: '<7K', label: 'Caregivers in Ontario' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <span className="text-3xl font-bold text-green-500 dark:text-green-400">{stat.value}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stat.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

    </div>
  );
}
