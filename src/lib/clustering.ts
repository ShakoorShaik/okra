// Legacy clustering utility — preserved from Fix6ix, not used in Project Okra.
// Kept here so the file path remains stable.

export type LegacySeverity = 'Low' | 'Medium' | 'High';
export type LegacyCategory = 'Roads' | 'Parks' | 'Lighting' | 'Waste' | 'Graffiti' | 'Water' | 'Other';

export interface LegacyReport {
  id: string;
  lat: number;
  lng: number;
  severity: LegacySeverity;
  category: LegacyCategory;
  status: string;
  suggested_tools: string[];
}

export interface LegacyClusterGroup {
  id: string;
  report_ids: string[];
  center_lat: number;
  center_lng: number;
  dominant_severity: LegacySeverity;
  ai_summary: string;
  parts_list: string[];
  category: LegacyCategory;
  count: number;
}

const CLUSTER_RADIUS_KM = 0.15;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function clusterReports(reports: LegacyReport[]): LegacyClusterGroup[] {
  const openReports = reports.filter((r) => r.status !== 'Resolved');
  const visited = new Set<string>();
  const clusters: LegacyClusterGroup[] = [];

  for (const report of openReports) {
    if (visited.has(report.id)) continue;

    const nearby = openReports.filter((r) => {
      if (visited.has(r.id)) return false;
      return haversineDistance(report.lat, report.lng, r.lat, r.lng) <= CLUSTER_RADIUS_KM;
    });

    if (nearby.length >= 2) {
      nearby.forEach((r) => visited.add(r.id));

      const centerLat = nearby.reduce((s, r) => s + r.lat, 0) / nearby.length;
      const centerLng = nearby.reduce((s, r) => s + r.lng, 0) / nearby.length;

      const severityScore: Record<LegacySeverity, number> = { High: 3, Medium: 2, Low: 1 };
      const dominant = nearby.reduce((best, r) =>
        severityScore[r.severity] > severityScore[best.severity] ? r : best
      ).severity;

      const categoryCounts: Record<string, number> = {};
      nearby.forEach((r) => { categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1; });
      const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0] as LegacyCategory;

      const allTools = nearby.flatMap((r) => r.suggested_tools);
      const seen = new Set<string>();
      const uniqueTools = allTools.filter((t) => { if (seen.has(t)) return false; seen.add(t); return true; }).slice(0, 5);

      clusters.push({
        id: `cluster_${report.id}`,
        report_ids: nearby.map((r) => r.id),
        center_lat: centerLat,
        center_lng: centerLng,
        dominant_severity: dominant,
        ai_summary: `${nearby.length} issues detected in area. ${dominant} priority.`,
        parts_list: uniqueTools,
        category: dominantCategory,
        count: nearby.length,
      });
    }
  }

  return clusters;
}
