import { Appointment } from '@/types';

export const TIME_PREF_ORDER: Record<string, number> = {
  Morning: 0,
  Afternoon: 1,
  Night: 2,
  Flexible: 3,
};

export function haversine(a: Appointment, b: Appointment): number {
  const R = 6371;
  const dLat = ((b.location_lat - a.location_lat) * Math.PI) / 180;
  const dLng = ((b.location_lng - a.location_lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.location_lat * Math.PI) / 180) *
      Math.cos((b.location_lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function nearestNeighbor(appts: Appointment[], startIdx = 0): Appointment[] {
  if (appts.length <= 2) return appts;
  const unvisited = [...appts];
  const route: Appointment[] = [unvisited.splice(startIdx, 1)[0]];
  while (unvisited.length > 0) {
    const last = route[route.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversine(last, unvisited[i]);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    route.push(unvisited.splice(nearestIdx, 1)[0]);
  }
  return route;
}

export function buildOptimalRoute(appts: Appointment[]): Appointment[] {
  if (appts.length === 0) return [];

  const fixed = appts
    .filter((a) => a.scheduled_for)
    .sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime());

  const pendingByWindow = appts
    .filter((a) => !a.scheduled_for)
    .reduce<Record<string, Appointment[]>>((acc, a) => {
      const key = a.time_preference;
      (acc[key] ??= []).push(a);
      return acc;
    }, {});

  const optimisedPending: Appointment[] = [];
  for (const window of ['Morning', 'Afternoon', 'Night', 'Flexible'] as const) {
    const cluster = pendingByWindow[window];
    if (!cluster?.length) continue;
    optimisedPending.push(...nearestNeighbor(cluster));
  }

  const result: Appointment[] = [];
  const pendingQueue = [...optimisedPending];

  for (const fixedAppt of fixed) {
    const fixedWindow = TIME_PREF_ORDER[fixedAppt.time_preference] ?? 4;
    while (
      pendingQueue.length > 0 &&
      (TIME_PREF_ORDER[pendingQueue[0].time_preference] ?? 4) <= fixedWindow
    ) {
      result.push(pendingQueue.shift()!);
    }
    result.push(fixedAppt);
  }
  result.push(...pendingQueue);

  return result;
}
