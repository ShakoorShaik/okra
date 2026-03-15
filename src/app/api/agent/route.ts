import { NextRequest, NextResponse } from 'next/server';
import { agentChat, ChatMessage, extractJSON } from '@/lib/watsonx';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types';

const SYSTEM_PROMPT = `You are a decisive, proactive scheduling assistant for Project Okra, a home care platform in Toronto. You help caregivers manage their appointment schedule autonomously.

You have access to all appointments and can perform these actions:

ACTIONS:
- confirm_appointment: Accept a pending appointment (sends it to the patient for their final confirmation)
- remove_appointment: Remove one of your accepted appointments (sets it back to pending)
- delete_appointment: Permanently delete an appointment from the system
- update_time: Change the time_preference of an appointment (Morning/Afternoon/Night/Flexible)
- list_schedule: Summarise the caregiver's current accepted/in-progress appointments
- list_pending: Summarise the available pending appointments
- none: Just respond conversationally (use for summaries, counts, questions about the data)

You MUST respond with ONLY valid JSON in this exact format:
{
  "message": "Your conversational reply to the caregiver",
  "action": null | {
    "type": "confirm_appointment" | "remove_appointment" | "delete_appointment" | "update_time" | "list_schedule" | "list_pending",
    "appointment_id": "appt_xxx",
    "time_preference": "Morning" | "Afternoon" | "Night" | "Flexible"
  }
}

CRITICAL RULES — follow these exactly:
- BE DECISIVE. When asked to choose, pick ONE appointment and execute the action immediately. Never ask the user to decide for you.
- When the caregiver says "choose for me", "pick one", "decide", "just do it" → pick the HIGHEST urgency pending appointment and confirm it. Do not list options.
- When asked to optimise or fill the schedule → pick the best pending appointment based on: 1) urgency (High first), 2) time slot gaps in the existing schedule.
- When the caregiver says "remove", "drop", "take off" → use remove_appointment
- When the caregiver says "delete", "cancel" → use delete_appointment
- When the caregiver says "add", "accept", "take on", "book" → use confirm_appointment
- When asked for a summary, count, or overview (e.g. "how many", "what do I have", "summarise", "show me") → use action: null and answer directly from the appointment data in your message. Be specific: list names, services, urgency levels.
- For "morning visits", "high urgency", "pending count" etc. → answer with action: null and give the exact details from the data
- Always refer to patients by NAME, never by ID in your message
- Only return ONE action per response — pick the single most important one
- Keep messages short and confident — 1-3 sentences max
- After executing an action, briefly confirm what you did and the patient's name`;

export async function POST(request: NextRequest) {
  const { message, history, appointments, providerId, providerName } = await request.json() as {
    message: string;
    history: ChatMessage[];
    appointments: Appointment[];
    providerId?: string | null;
    providerName?: string | null;
  };

  const mySchedule = appointments.filter((a) =>
    a.status === 'confirmed' || a.status === 'in_progress' || a.status === 'caregiver_accepted'
  );
  const pending = appointments.filter((a) => a.status === 'pending');

  const fmt = (list: typeof appointments) =>
    list.length === 0 ? 'None.' : list.map((a) =>
      `- ID: ${a.id} | Patient: ${a.requestor_name} | Urgency: ${a.highest_urgency} | Time: ${a.time_preference} | Status: ${a.status} | Services: ${a.services_requested.join(', ')}`
    ).join('\n');

  const systemWithContext = `${SYSTEM_PROMPT}

YOUR SCHEDULE (confirmed/in-progress/awaiting patient confirmation):
${fmt(mySchedule)}

PENDING APPOINTMENTS (available to accept):
${fmt(pending)}`;

  const updatedHistory: ChatMessage[] = [...history, { role: 'user', content: message }];

  const raw = await agentChat(systemWithContext, updatedHistory);

  if (!raw) {
    return NextResponse.json({
      message: "I'm having trouble connecting to WatsonX right now. Please try again.",
      action: null,
    });
  }

  const parsed = extractJSON(raw) as {
    message: string;
    action: null | {
      type: string;
      appointment_id?: string;
      time_preference?: string;
    };
  } | null;

  if (!parsed) {
    return NextResponse.json({ message: raw, action: null });
  }

  // Execute the action against Supabase
  let actionResult = null;
  if (parsed.action && supabase) {
    const { type, appointment_id, time_preference } = parsed.action;

    if (type === 'confirm_appointment' && appointment_id) {
      // Set caregiver_accepted so the patient still needs to confirm
      await supabase.from('appointments').update({
        status: 'caregiver_accepted',
        provider_id: providerId ?? null,
        provider_name: providerName ?? null,
      }).eq('id', appointment_id);
      actionResult = { type, appointment_id };
    }

    if (type === 'remove_appointment' && appointment_id) {
      await supabase.from('appointments').update({
        status: 'pending',
        provider_id: null,
        provider_name: null,
        watsonx_care_plan: null,
      }).eq('id', appointment_id);
      actionResult = { type, appointment_id };
    }

    if (type === 'delete_appointment' && appointment_id) {
      await supabase.from('appointments').delete().eq('id', appointment_id);
      actionResult = { type, appointment_id };
    }

    if (type === 'update_time' && appointment_id && time_preference) {
      await supabase.from('appointments').update({ time_preference }).eq('id', appointment_id);
      actionResult = { type, appointment_id, time_preference };
    }

    if (type === 'list_schedule' || type === 'list_pending') {
      actionResult = { type };
    }
  }

  return NextResponse.json({
    message: parsed.message,
    action: actionResult,
    assistantMessage: { role: 'assistant', content: raw },
  });
}
