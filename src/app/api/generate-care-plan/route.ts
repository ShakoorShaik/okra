import { NextRequest, NextResponse } from 'next/server';
import { generateCarePlan } from '@/lib/watsonx';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { appointmentId, services, timePreference, notes, providerId, providerName } = await request.json();

  const carePlan = await generateCarePlan(services, timePreference, notes || '');

  // Set status to caregiver_accepted — care seeker must still confirm
  if (supabase && appointmentId) {
    await supabase
      .from('appointments')
      .update({
        watsonx_care_plan: carePlan,
        status: 'caregiver_accepted',
        provider_id: providerId ?? null,
        provider_name: providerName ?? null,
      })
      .eq('id', appointmentId);
  }

  return NextResponse.json({ carePlan });
}
