import { create } from 'zustand';
import { Appointment } from '@/types';

interface OkraState {
  appointments: Appointment[];
  selectedAppointment: Appointment | null;
  providerServices: string[];

  setAppointments: (appts: Appointment[]) => void;
  addAppointment: (appt: Appointment) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  setSelectedAppointment: (appt: Appointment | null) => void;
  setProviderServices: (services: string[]) => void;
}

export const useOkraStore = create<OkraState>((set) => ({
  appointments: [],
  selectedAppointment: null,
  providerServices: [],

  setAppointments: (appointments) => set({ appointments }),
  addAppointment: (appt) => set((state) => {
    // Avoid duplicates (Realtime can sometimes fire twice)
    if (state.appointments.some(a => a.id === appt.id)) return state;
    return { appointments: [appt, ...state.appointments] };
  }),
  updateAppointment: (id, updates) =>
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  setSelectedAppointment: (appt) => set({ selectedAppointment: appt }),
  setProviderServices: (services) => set({ providerServices: services }),
}));
