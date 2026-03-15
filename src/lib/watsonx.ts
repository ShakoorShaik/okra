import { WatsonxRouterResult, CarePlan, TimePreference } from '@/types';
import { ALL_SERVICES, SERVICES } from './services';

// ── Config ─────────────────────────────────────────────────────────────────────
const WATSONX_URL = (process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com').replace(/\/$/, '');
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID || '';
const WATSONX_API_KEY = process.env.WATSONX_API_KEY || '';
// IBM Granite 3 — IBM's own instruction-tuned model, best for structured JSON tasks
const MODEL_ID = 'ibm/granite-3-8b-instruct';

// ── IAM Token Cache ─────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

function fetchWithTimeout(url: string, options: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function getIAMToken(): Promise<string | null> {
  if (!WATSONX_API_KEY) return null;
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  try {
    const res = await fetchWithTimeout(
      'https://iam.cloud.ibm.com/identity/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_API_KEY}`,
      },
      6000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken;
  } catch (e) {
    console.error('[WatsonX] IAM fetch failed:', e);
    return null;
  }
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

// ── Multi-turn agent chat (exported for agent use) ────────────────────────────
export async function agentChat(
  systemPrompt: string,
  history: ChatMessage[],
  maxTokens = 700
): Promise<string | null> {
  const token = await getIAMToken();
  if (!token || !WATSONX_PROJECT_ID) return null;

  try {
    const res = await fetchWithTimeout(
      `${WATSONX_URL}/ml/v1/text/chat?version=2024-05-31`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          model_id: MODEL_ID,
          messages: [{ role: 'system', content: systemPrompt }, ...history],
          parameters: { max_new_tokens: maxTokens, temperature: 0.2, repetition_penalty: 1.05 },
          project_id: WATSONX_PROJECT_ID,
        }),
      },
      15000
    );
    if (!res.ok) { console.error('[watsonx] agentChat error:', res.status, await res.text()); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error('[watsonx] agentChat failed:', err);
    return null;
  }
}

// ── IBM watsonx.ai Chat API ────────────────────────────────────────────────────
// Uses /ml/v1/text/chat — IBM's OpenAI-compatible chat endpoint for Granite 3
async function chat(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512
): Promise<string | null> {
  const token = await getIAMToken();
  if (!token || !WATSONX_PROJECT_ID) return null;

  try {
    const res = await fetchWithTimeout(
      `${WATSONX_URL}/ml/v1/text/chat?version=2024-05-31`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model_id: MODEL_ID,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          parameters: {
            max_new_tokens: maxTokens,
            temperature: 0,          // deterministic — critical for JSON output
            repetition_penalty: 1.05,
          },
          project_id: WATSONX_PROJECT_ID,
        }),
      },
      12000
    );
    if (!res.ok) {
      console.error('[watsonx] chat API error:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error('[watsonx] chat failed:', err);
    return null;
  }
}

// ── JSON Extractor ─────────────────────────────────────────────────────────────
export function extractJSON(raw: string): unknown | null {
  try {
    // Strip any markdown code fences the model might add
    const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ── Router Agent ───────────────────────────────────────────────────────────────
export async function routeRequest(userText: string): Promise<WatsonxRouterResult> {
  const serviceList = [
    ...SERVICES.High.map(s => `  [HIGH]   "${s}"`),
    ...SERVICES.Medium.map(s => `  [MEDIUM] "${s}"`),
    ...SERVICES.Low.map(s => `  [LOW]    "${s}"`),
  ].join('\n');

  const systemPrompt = `You are a care request classifier for Project Okra, an AI-powered elder care platform in Toronto.

Your ONLY job is to read a senior citizen's care request and map it to services from the exact list below.

AVAILABLE SERVICES (copy names EXACTLY — spelling and capitalisation must match):
${serviceList}

You MUST respond with ONLY a JSON object. No explanation. No markdown. No extra text.

JSON format:
{"services":["Service Name 1","Service Name 2"],"time_suggestion":"Morning"|"Afternoon"|"Night"|"Flexible"|null,"notes":"Any specific patient details mentioned (medications, conditions, mobility issues, etc.) — empty string if none"}

Classification rules:
- "Post-surgery care" → mentions surgery, post-op, operation, wound, stitches, recovering from procedure
- "Vital signs monitoring" → mentions blood pressure, pulse, temperature, oxygen, vitals, heart rate
- "Night care" → mentions overnight, night shift, sleeping, nocturnal, late evening supervision
- "Medical appointment escort" → mentions doctor visit, clinic, hospital, specialist, going to appointment
- "Bed transfer" → mentions getting out of bed, moving from bed, can't stand, transfer, wheelchair from bed
- "Personal hygiene" → mentions bath, shower, washing, grooming, oral hygiene, toilet assistance
- "Assistance with daily living" → mentions dressing, eating, general daily tasks, ADL
- "Dementia care" → mentions dementia, Alzheimer's, memory loss, confusion, cognitive
- "Check-in visits" → mentions welfare check, drop by, visit to check on, safety check
- "Companionship" → mentions lonely, company, someone to talk to, social interaction, visit
- "Meal preparations and grocery shopping" → mentions food, cooking, meal, groceries, shopping, lunch, dinner, breakfast
- "Light mobility exercises" → mentions exercise, walking, stretching, physiotherapy, mobility, physio
- "Medication reminders" → mentions medication, pills, medicine, prescription, drugs, dosage
- "Activities for dementia patients" → mentions activities for dementia, puzzles, engagement for memory patients

Select 1 to 3 services. If nothing matches clearly, use "Companionship".

time_suggestion rules:
- "Morning" if they say morning, early, AM, breakfast time
- "Afternoon" if they say afternoon, midday, lunch time, PM
- "Night" if they say night, evening, PM after 5, late
- "Flexible" if no time mentioned or they say any time, flexible
- null only if the concept of time is completely irrelevant`;

  const raw = await chat(systemPrompt, `Classify this care request: "${userText}"`, 256);

  if (raw) {
    const parsed = extractJSON(raw) as { services?: unknown; time_suggestion?: unknown; notes?: unknown } | null;
    if (parsed) {
      const validServices = (Array.isArray(parsed.services) ? parsed.services : [])
        .filter((s): s is string => typeof s === 'string' && ALL_SERVICES.includes(s));
      const timeSug = typeof parsed.time_suggestion === 'string' ? parsed.time_suggestion as TimePreference : null;
      return {
        services: validServices.length > 0 ? validServices : ['Companionship'],
        time_suggestion: timeSug,
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      };
    }
  }

  console.warn('[watsonx] Router fell back to keyword matching — IBM credentials may be missing or invalid');
  return fallbackRouter(userText);
}

// ── Planner Agent ──────────────────────────────────────────────────────────────
export async function generateCarePlan(
  services: string[],
  timePreference: string,
  notes: string
): Promise<CarePlan> {
  const systemPrompt = `You are an expert senior care coordinator generating a care briefing for a professional home care worker visiting an elderly patient in Toronto.

You MUST respond with ONLY a JSON object. No explanation. No markdown. No extra text.

JSON format:
{
  "care_plan": ["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ...", "Step 5: ..."],
  "required_items": ["item1", "item2", "item3"],
  "duration_estimate": "X-Y minutes",
  "safety_notes": ["safety note 1", "safety note 2"]
}

Requirements:
- care_plan: 4 to 6 steps, each starting with "Step N:". Steps must be SPECIFIC to the requested services and any patient notes. Not generic.
- required_items: physical items/supplies the care worker should bring. Be specific and relevant to the services.
- duration_estimate: realistic time range in minutes based on the services.
- safety_notes: 1 to 3 safety considerations SPECIFIC to the patient's condition and services. Not generic platitudes.

Base everything on the actual services requested and any patient notes provided. Personalise the plan.`;

  const userMessage = `Generate a care briefing for the following visit:

Services requested: ${services.join(', ')}
Time of visit: ${timePreference}
Patient notes: ${notes || 'No additional notes provided'}`;

  const raw = await chat(systemPrompt, userMessage, 600);

  if (raw) {
    const parsed = extractJSON(raw) as Partial<CarePlan> | null;
    if (
      parsed &&
      Array.isArray(parsed.care_plan) && parsed.care_plan.length > 0 &&
      Array.isArray(parsed.required_items) &&
      typeof parsed.duration_estimate === 'string' &&
      Array.isArray(parsed.safety_notes)
    ) {
      return parsed as CarePlan;
    }
  }

  console.warn('[watsonx] Planner fell back to template — IBM credentials may be missing or invalid');
  return fallbackCarePlan(services);
}

// ── Fallbacks (used only when IBM credentials are absent or API is unreachable) ──

function fallbackRouter(text: string): WatsonxRouterResult {
  const lower = text.toLowerCase();
  const services: string[] = [];
  if (lower.includes('surgery') || lower.includes('post-op') || lower.includes('wound')) services.push('Post-surgery care');
  if (lower.includes('blood pressure') || lower.includes('vital') || lower.includes('temperature') || lower.includes('oxygen')) services.push('Vital signs monitoring');
  if (lower.includes('night') || lower.includes('overnight')) services.push('Night care');
  if (lower.includes('appointment') || lower.includes('doctor') || lower.includes('hospital') || lower.includes('clinic')) services.push('Medical appointment escort');
  if (lower.includes('bed') || lower.includes('get up') || lower.includes('transfer') || lower.includes('wheelchair')) services.push('Bed transfer');
  if (lower.includes('hygiene') || lower.includes('bath') || lower.includes('shower') || lower.includes('groom')) services.push('Personal hygiene');
  if (lower.includes('dementia') || lower.includes('alzheimer') || lower.includes('memory')) services.push('Dementia care');
  if (lower.includes('check') || lower.includes('visit') || lower.includes('welfare')) services.push('Check-in visits');
  if (lower.includes('company') || lower.includes('lonely') || lower.includes('talk') || lower.includes('chat')) services.push('Companionship');
  if (lower.includes('food') || lower.includes('meal') || lower.includes('cook') || lower.includes('groceries') || lower.includes('lunch') || lower.includes('dinner')) services.push('Meal preparations and grocery shopping');
  if (lower.includes('exercise') || lower.includes('walk') || lower.includes('mobility') || lower.includes('physio')) services.push('Light mobility exercises');
  if (lower.includes('medication') || lower.includes('pill') || lower.includes('medicine') || lower.includes('prescription')) services.push('Medication reminders');
  if (lower.includes('activit') || lower.includes('puzzle') || lower.includes('engag')) services.push('Activities for dementia patients');

  let time_suggestion: TimePreference | null = null;
  if (lower.includes('morning')) time_suggestion = 'Morning';
  else if (lower.includes('afternoon')) time_suggestion = 'Afternoon';
  else if (lower.includes('night') || lower.includes('evening')) time_suggestion = 'Night';
  else time_suggestion = 'Flexible';

  return {
    services: services.length > 0 ? services.slice(0, 3) : ['Companionship'],
    time_suggestion,
    notes: text,
  };
}

function fallbackCarePlan(services: string[]): CarePlan {
  const highUrgency = services.filter(s => SERVICES.High.includes(s));
  const isHighUrgency = highUrgency.length > 0;
  return {
    care_plan: isHighUrgency
      ? [
          'Step 1: Review any discharge notes or medical documentation on arrival.',
          "Step 2: Assess patient's current condition, pain level, and comfort.",
          'Step 3: Perform the requested services carefully, documenting all observations.',
          'Step 4: Check and record vital signs if applicable.',
          'Step 5: Ensure patient is comfortable, stable, and has emergency contacts accessible before leaving.',
        ]
      : [
          "Step 1: Greet the patient and confirm the services needed today.",
          "Step 2: Check patient's current comfort level and any immediate needs.",
          "Step 3: Complete all requested services at the patient's pace.",
          'Step 4: Tidy the immediate area and ensure patient has water and phone nearby.',
          'Step 5: Confirm the next scheduled visit and say goodbye warmly.',
        ],
    required_items: isHighUrgency
      ? ['Disposable gloves', 'Blood pressure cuff', 'Thermometer', 'Gauze and antiseptic wipes', 'Care log notebook']
      : ['Disposable gloves', 'Non-slip mat', 'Reusable shopping bags', 'Care log notebook'],
    duration_estimate: isHighUrgency ? '60–90 minutes' : '30–60 minutes',
    safety_notes: [
      'Confirm the patient can reach their emergency contact before you leave.',
      'Do not perform any medical procedures outside your scope of certification.',
    ],
  };
}
