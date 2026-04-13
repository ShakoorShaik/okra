<div align="center">

<img src="public/images/logo-green.svg" alt="Okra Logo" width="90" height="90" />

# Okra

### Rooted in Care, Built for the Home.

**AI-powered home care request routing and provider dispatch for elderly residents in Toronto.**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![IBM watsonx.ai](https://img.shields.io/badge/IBM%20watsonx.ai-Granite%203-0f62fe?logo=ibm)](https://www.ibm.com/watsonx)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ecf8e?logo=supabase)](https://supabase.com/)
[![Mapbox](https://img.shields.io/badge/Mapbox%20GL-3D%20Map-000?logo=mapbox)](https://www.mapbox.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Demo

> **▶ [Watch the Full Demo Video]**

https://github.com/user-attachments/assets/f512d512-22e0-4889-a413-f2fbb74a738e

*A 3-minute walkthrough of voice-to-care request flow, provider dispatch, AI scheduling agent, and real-time confirmation.*

---

</div>

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [Core Flows](#core-flows)
  - [Care Seeker Flow](#care-seeker-flow)
  - [Care Provider Flow](#care-provider-flow)
  - [Appointment Lifecycle](#appointment-lifecycle)
- [IBM watsonx.ai Integration](#ibm-watsonxai-integration)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Ontario faces a critical care gap: over **50,000 seniors** require long-term home care, yet fewer than **7,000 registered caregivers** are actively available. Routing the right caregiver to the right patient — quickly, efficiently, and safely — is a problem that currently relies on phone calls and spreadsheets.

**Okra** is a full-stack platform that replaces this manual process with an AI-native dispatch pipeline:

1. **Seniors speak** their care needs — Okra transcribes and classifies them via IBM watsonx.ai Granite 3.
2. **Caregivers see** nearby, priority-ranked requests on a live 3D map.
3. **IBM Granite 3** generates a personalised care plan briefing the moment a provider accepts.
4. **Patients confirm** their assigned caregiver in one tap — completing a two-sided, real-time handshake.
5. An **AI scheduling agent** (also powered by Granite 3) lets providers manage their full schedule through natural language.

---

## Key Features

### For Care Seekers
- **Voice-to-request** — speak naturally; IBM watsonx.ai parses services, urgency, and time preferences in real time
- **Service selector** — manually pick from 14 categorised care services (High / Medium / Low urgency)
- **Live appointment tracker** — see status updates as caregivers accept and patients confirm
- **One-tap caregiver confirmation** — accept or decline a matched caregiver directly from the dashboard
- **Geolocation-aware** — auto-detects address for precise provider matching

### For Care Providers
- **3D live map** (Mapbox GL) — colour-coded urgency markers with pulsing animations
- **Best Picks engine** — geolocation + urgency scoring surfaces the top 3 optimal requests
- **IBM watsonx.ai care plans** — auto-generated step-by-step briefings with required items and safety notes on acceptance
- **AI scheduling agent** — natural language chat interface to add, remove, and reorganise the day's schedule
- **Optimised route view** — nearest-neighbour TSP algorithm across time-preference windows
- **Real-time sync** — Supabase Realtime pushes all status changes instantly across both sides

### Platform-Wide
- **Dark / light mode** with persistent preference
- **Mobile-first responsive design** with bottom sheets and full touch support
- **Supabase Auth** — secure sign-up and sign-in with role-based routing
- **Offline fallback** — keyword-based classification if IBM credentials are absent

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Next.js 14)                      │
│                                                                   │
│  Care Seeker Dashboard          Care Provider Dashboard           │
│  ┌──────────────────┐           ┌────────────────────────────┐   │
│  │ Voice Input      │           │ 3D Mapbox Map              │   │
│  │ Service Selector │           │ Best Picks Engine          │   │
│  │ Status Tracker   │           │ AI Agent Chat              │   │
│  │ Confirm/Decline  │           │ Route Optimiser            │   │
│  └──────────────────┘           └────────────────────────────┘   │
└────────────────────┬────────────────────────┬────────────────────┘
                     │  Next.js API Routes     │
         ┌───────────┴──────────┐   ┌─────────┴──────────┐
         │   /api/parse-request │   │  /api/agent        │
         │   /api/appointments  │   │  /api/generate-    │
         │                      │   │    care-plan       │
         └───────────┬──────────┘   └─────────┬──────────┘
                     │                         │
         ┌───────────▼─────────────────────────▼──────────┐
         │            IBM watsonx.ai (Granite 3)           │
         │                                                  │
         │  Router Agent      →  Service classification     │
         │  Planner Agent     →  Care plan generation       │
         │  Scheduling Agent  →  Natural language dispatch  │
         └──────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────▼───────────────────────┐
         │                   Supabase                      │
         │                                                  │
         │  appointments table  →  Row-level security       │
         │  profiles table      →  Auth-linked user data    │
         │  Realtime channels   →  Bidirectional live sync  │
         └──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router, TypeScript) |
| **Styling** | Tailwind CSS 3 (custom dark theme, brand tokens) |
| **Animation** | Framer Motion |
| **Map** | Mapbox GL JS v3 (3D buildings, custom markers, route layers) |
| **AI / NLP** | IBM watsonx.ai — `ibm/granite-3-8b-instruct` |
| **Database** | Supabase (PostgreSQL + Realtime + Auth) |
| **State** | Zustand |
| **Speech** | Web Speech API (`SpeechRecognition`) |
| **Geocoding** | Nominatim (OpenStreetMap) |
| **Icons** | Lucide React |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.17
- **npm** ≥ 9
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Mapbox](https://www.mapbox.com/) account with a public token
- An [IBM Cloud](https://cloud.ibm.com/) account with a watsonx.ai project (free trial available)

### Installation

```bash
git clone https://github.com/your-username/okra.git
cd okra
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci10b2tlbiJ...

# IBM watsonx.ai
WATSONX_API_KEY=your-ibm-api-key
WATSONX_PROJECT_ID=your-watsonx-project-id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```


### Database Setup

1. Open your [Supabase SQL Editor](https://supabase.com/dashboard).
2. Run the schema file:

```bash
# Copy contents of supabase/schema.sql and paste into the SQL Editor, or:
cat supabase/schema.sql
```

3. *(Optional)* Seed the database with 50 realistic Toronto appointments:

```bash
node scripts/seed.mjs
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page offers two entry points — **Care Seeker** and **Care Provider** — each with separate auth flows and dashboards.

---

## Project Structure

```
okra/
├── data/
│   └── fake-appointments.json    # 50 seeded Toronto appointments
├── public/
│   └── images/                   # Logo variants (black, green, grey)
├── scripts/
│   └── seed.mjs                  # Database seeder
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/            # AI scheduling agent endpoint
│   │   │   ├── appointments/     # CRUD for appointments
│   │   │   ├── generate-care-plan/  # IBM Granite care plan generation
│   │   │   └── parse-request/    # Voice transcript classification
│   │   ├── auth/                 # Auth page
│   │   ├── provider/             # Provider dashboard, schedule, agent
│   │   └── requestor/            # Care seeker dashboard
│   ├── components/
│   │   ├── provider/
│   │   │   ├── ProviderDashboard.tsx  # Main map + dispatch UI
│   │   │   ├── AppointmentPanel.tsx   # Slide-in detail panel
│   │   │   ├── AgentChat.tsx          # AI agent chat interface
│   │   │   ├── CarePlanView.tsx       # Structured care plan display
│   │   │   ├── MapView.tsx            # Mapbox 3D map component
│   │   │   ├── ScheduleView.tsx       # Optimised daily route list
│   │   │   └── StatsBar.tsx           # Live stats pill row
│   │   └── requestor/
│   │       ├── RequestorDashboard.tsx # Main care request UI
│   │       ├── MicButton.tsx          # Voice input with waveform
│   │       ├── ServiceSelector.tsx    # Urgency-grouped service picker
│   │       ├── SchedulePicker.tsx     # Time preference selector
│   │       └── AppointmentStatus.tsx  # Live appointment tracker
│   ├── lib/
│   │   ├── watsonx.ts            # IBM watsonx.ai client (router + planner + agent)
│   │   ├── store.ts              # Zustand global state
│   │   ├── supabase.ts           # Supabase client
│   │   ├── route.ts              # Route optimisation (nearest-neighbour TSP)
│   │   ├── services.ts           # Service catalogue and urgency mappings
│   │   ├── utils.ts              # Shared helpers
│   │   └── theme-context.tsx     # Dark/light theme provider
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── supabase/
│   └── schema.sql                # Database schema and RLS policies
└── tailwind.config.ts
```

---

## Core Flows

### Care Seeker Flow

```
1. Sign up → select "Care Seeker" role → geolocation captured
2. Speak request (or type) → Web Speech API → /api/parse-request
3. IBM Granite 3 classifies services, urgency, time preference
4. Review + adjust services and schedule → submit
5. Appointment written to Supabase → Realtime event fires to providers
6. Receive in-app notification when a caregiver accepts
7. View AI-generated care plan → confirm or decline in one tap
8. Status updates live: pending → caregiver_accepted → confirmed → in_progress → completed
```

### Care Provider Flow

```
1. Sign up → select "Care Provider" role → services offered saved
2. View 3D map with colour-coded, priority-ranked requests
3. Tap a marker → appointment detail panel slides in
4. Click "Accept & Send to Patient" → IBM Granite 3 generates care plan
5. Supabase Realtime notifies the patient instantly
6. Once patient confirms → appointment enters "confirmed" state
7. View optimised day route in Schedule View
8. Alternatively: use AI agent chat to manage schedule in natural language
```

### Appointment Lifecycle

```
pending → caregiver_accepted → confirmed → in_progress → completed
            (provider accepts)  (patient      (visit        (provider
                                 confirms)     starts)       marks done)
```

At any point before patient confirmation, either side can decline — the appointment returns to `pending` and re-enters the matching pool.

---

## IBM watsonx.ai Integration

Okra uses **IBM Granite 3 8B Instruct** (`ibm/granite-3-8b-instruct`) across three distinct agents:

### 1. Router Agent — `/api/parse-request`

Classifies a free-form voice transcript into structured care request data:

- Identifies relevant services from a fixed catalogue of 14
- Extracts time preference (Morning / Afternoon / Night / Flexible)
- Pulls out patient-specific notes (conditions, mobility, medications)

Returns deterministic JSON (`temperature: 0`) for reliable downstream handling.

### 2. Planner Agent — `/api/generate-care-plan`

Generates a personalised care briefing for the provider upon accepting an appointment:

- Step-by-step visit plan tailored to the specific services and patient notes
- Required items checklist
- Realistic duration estimate
- Patient-specific safety notes

### 3. Scheduling Agent — `/api/agent`

A multi-turn conversational agent with full appointment context injected at each turn:

- **Decisive by design** — when asked to choose, it picks and executes without asking for confirmation
- Supports natural commands: "add Martha to my schedule", "swap the afternoon visit", "show me my high-urgency patients"
- Actions (`confirm_appointment`, `remove_appointment`, `delete_appointment`, `update_time`) are executed directly against Supabase
- Local Zustand store updated immediately for zero-latency UI feedback

All three agents authenticate via IBM IAM with a cached, auto-refreshed bearer token. If credentials are absent, a keyword-based fallback activates transparently.

---

## Deployment

The project is a standard Next.js application and deploys to any platform that supports Node.js ≥ 18.


