export type Urgency = 'High' | 'Medium' | 'Low';
export type AppointmentStatus = 'pending' | 'caregiver_accepted' | 'confirmed' | 'in_progress' | 'completed';
export type TimePreference = 'Morning' | 'Afternoon' | 'Night' | 'Flexible';

export interface Appointment {
  id: string;
  requestor_id: string;
  requestor_name: string;
  requestor_address: string;
  provider_id: string | null;
  provider_name: string | null;
  status: AppointmentStatus;
  time_preference: TimePreference;
  services_requested: string[];
  highest_urgency: Urgency;
  watsonx_care_plan: CarePlan | null;
  location_lat: number;
  location_lng: number;
  notes: string;
  created_at: string;
  scheduled_for: string | null;
}

export interface CarePlan {
  care_plan: string[];
  required_items: string[];
  duration_estimate: string;
  safety_notes: string[];
}

export interface MockUser {
  id: string;
  type: 'requestor' | 'provider';
  name: string;
  location_lat: number;
  location_lng: number;
  preferred_services: string[];
  services_offered: string[];
}

export interface WatsonxRouterResult {
  services: string[];
  time_suggestion: TimePreference | null;
  notes: string;
}
