import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFileSync } from 'fs';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types';

function loadFakeAppointments(): Appointment[] {
  const filePath = path.join(process.cwd(), 'data', 'fake-appointments.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export async function GET() {
  if (!supabase) {
    try { return NextResponse.json(loadFakeAppointments()); }
    catch { return NextResponse.json([]); }
  }
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    try { return NextResponse.json(loadFakeAppointments()); }
    catch { return NextResponse.json([]); }
  }

  if (data.length === 0) {
    try {
      const fake = loadFakeAppointments();
      await supabase.from('appointments').insert(fake);
      return NextResponse.json(fake);
    } catch { return NextResponse.json([]); }
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const appt: Appointment = body;

  if (supabase) {
    const { error } = await supabase.from('appointments').insert([appt]);
    if (error) console.error('Supabase insert error:', error.message);
  }

  return NextResponse.json({ success: true, appointment: appt });
}

export async function PATCH(request: NextRequest) {
  const { id, updates } = await request.json();
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  const { error } = await supabase.from('appointments').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  const { error } = await supabase.from('appointments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
