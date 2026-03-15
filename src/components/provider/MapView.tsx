'use client';

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Appointment } from '@/types';
import { getUrgencyColor } from '@/lib/utils';
import { buildOptimalRoute } from '@/lib/route';

interface Props {
  appointments: Appointment[];
  providerServices: string[];
  onAppointmentClick: (appt: Appointment) => void;
  mapStyle: string;
  isDark: boolean;
  bestPickIds?: string[];
}

export default function MapView({ appointments, onAppointmentClick, mapStyle, isDark, bestPickIds = [] }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const appointmentsRef = useRef<Appointment[]>(appointments);
  const onClickRef = useRef(onAppointmentClick);
  const bestPickIdsRef = useRef<string[]>(bestPickIds);

  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  useEffect(() => {
    onClickRef.current = onAppointmentClick;
  }, [onAppointmentClick]);

  useEffect(() => {
    bestPickIdsRef.current = bestPickIds;
  }, [bestPickIds]);

  const initMap = useCallback(() => {
    if (!mapContainer.current || map.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      console.error('[MapView] NEXT_PUBLIC_MAPBOX_TOKEN missing');
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [-79.3832, 43.6532], // Toronto default
      zoom: 11,
      pitch: 35,
      bearing: -10,
      antialias: true,
    });

    map.current.on('error', (e) => {
      console.error('[MapView] Mapbox error:', e.error);
    });

    map.current.on('load', () => {
      const m = map.current!;

      m.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': isDark ? '#1a2318' : '#d4dfd0',
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            0,
            14.05,
            ['get', 'height'],
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            0,
            14.05,
            ['get', 'min_height'],
          ],
          'fill-extrusion-opacity': 0.7,
        },
      });
    });
  }, [mapStyle, isDark]);

  useEffect(() => {
    initMap();

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [initMap]);

  useEffect(() => {
    if (!map.current) return;

    const addMarkers = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const m = map.current!;

      // Helper: add a GeoJSON source+layers once, then update data with setData()
      const setRouteData = (
        sourceId: string,
        coords: number[][],
        layers: Parameters<mapboxgl.Map['addLayer']>[0][]
      ) => {
        const emptyLine: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        };
        const existing = m.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
        if (existing) {
          existing.setData(emptyLine);
        } else {
          m.addSource(sourceId, { type: 'geojson', data: emptyLine });
          layers.forEach(layer => m.addLayer(layer));
        }
      };

      // Confirmed route: only patient-confirmed appointments
      const confirmedAppts = buildOptimalRoute(
        appointmentsRef.current.filter(
          (a) => (a.status === 'confirmed' || a.status === 'in_progress') && a.location_lat && a.location_lng
        )
      );

      setRouteData(
        'caregiver-route',
        confirmedAppts.length >= 2 ? confirmedAppts.map(a => [a.location_lng, a.location_lat]) : [],
        [
          {
            id: 'caregiver-route-casing', type: 'line', source: 'caregiver-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.5 },
          },
          {
            id: 'caregiver-route', type: 'line', source: 'caregiver-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#80EF80', 'line-width': 4, 'line-opacity': 0.95 },
          },
        ]
      );

      // Pending-confirmation route: dashed, dimmer
      const pendingConfirmAppts = buildOptimalRoute(
        appointmentsRef.current.filter(
          (a) => a.status === 'caregiver_accepted' && a.location_lat && a.location_lng
        )
      );

      setRouteData(
        'caregiver-route-pending',
        pendingConfirmAppts.length >= 2 ? pendingConfirmAppts.map(a => [a.location_lng, a.location_lat]) : [],
        [
          {
            id: 'caregiver-route-pending', type: 'line', source: 'caregiver-route-pending',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#22c55e', 'line-width': 3, 'line-opacity': 0.85, 'line-dasharray': [3, 3] },
          },
        ]
      );

      // Best-picks route: dotted bright green connecting the recommended picks
      const bestPickAppts = bestPickIdsRef.current
        .map(id => appointmentsRef.current.find(a => a.id === id))
        .filter((a): a is Appointment => !!a && !!a.location_lat && !!a.location_lng);

      setRouteData(
        'best-picks-route',
        bestPickAppts.length >= 2 ? bestPickAppts.map(a => [a.location_lng, a.location_lat]) : [],
        [
          {
            id: 'best-picks-route', type: 'line', source: 'best-picks-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#9ca3af', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [2, 3] },
          },
        ]
      );

      const bounds = new mapboxgl.LngLatBounds();

      appointmentsRef.current
        .filter((a) => a.status !== 'completed')
        .forEach((appt) => {
          // Index in the confirmed route (for stop number badge)
          const stopIndex = confirmedAppts.findIndex(r => r.id === appt.id);
          const lat = Number(appt.location_lat);
          const lng = Number(appt.location_lng);

          if (!lat || !lng) return;

          bounds.extend([lng, lat]);

          const color = getUrgencyColor(appt.highest_urgency);

          const size =
            appt.highest_urgency === 'High'
              ? 40
              : appt.highest_urgency === 'Medium'
              ? 34
              : 28;

          const animClass =
            appt.highest_urgency === 'High'
              ? 'marker-high'
              : appt.highest_urgency === 'Medium'
              ? 'marker-medium'
              : '';

          const nameParts = appt.requestor_name.trim().split(/\s+/);
          const initials = nameParts.length >= 2
            ? nameParts[0][0].toUpperCase() + nameParts[nameParts.length - 1][0].toUpperCase()
            : nameParts[0][0].toUpperCase();

          const wrapper = document.createElement('div');

          wrapper.style.cssText = `
            width:${size}px;
            height:${size}px;
            display:flex;
            align-items:center;
            justify-content:center;
          `;

          const el = document.createElement('div');

          el.className = animClass;

          el.style.cssText = `
            width:100%;
            height:100%;
            background:${color};
            border-radius:50%;
            border:2px solid rgba(255,255,255,0.5);
            display:flex;
            align-items:center;
            justify-content:center;
            color:white;
            font-weight:900;
            font-size:${size < 34 ? '9px' : '11px'};
            cursor:pointer;
            box-shadow:0 0 ${
              appt.highest_urgency === 'High' ? '20px' : '12px'
            } ${color}66;
            transition:transform 0.15s ease;
          `;

          el.textContent = initials;

          wrapper.appendChild(el);

          // Stop number badge for confirmed route stops
          if (stopIndex !== -1) {
            const badge = document.createElement('div');
            badge.style.cssText = `
              position:absolute;
              top:-6px;
              right:-6px;
              width:16px;
              height:16px;
              background:#ffffff;
              color:#000000;
              border-radius:50%;
              font-size:9px;
              font-weight:900;
              display:flex;
              align-items:center;
              justify-content:center;
              border:1.5px solid #80EF80;
              pointer-events:none;
            `;
            badge.textContent = String(stopIndex + 1);
            wrapper.style.position = 'relative';
            wrapper.appendChild(badge);
          }

          wrapper.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.2)';
            wrapper.style.zIndex = '10';
          });

          wrapper.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)';
            wrapper.style.zIndex = '';
          });

          wrapper.addEventListener('click', (e) => {
            e.stopPropagation();

            const current = appointmentsRef.current.find(
              (a) => a.id === appt.id
            );

            if (current) onClickRef.current(current);

            map.current?.flyTo({
              center: [lng, lat],
              zoom: 15,
              duration: 600,
            });
          });

          const marker = new mapboxgl.Marker({
            element: wrapper,
            anchor: 'center',
          })
            .setLngLat([lng, lat])
            .addTo(map.current!);

          markersRef.current.push(marker);
        });

      if (!bounds.isEmpty()) {
        map.current!.fitBounds(bounds, {
          padding: 80,
          duration: 800,
        });
      }
    };

    if (map.current.isStyleLoaded()) {
      addMarkers();
    } else {
      map.current.once('load', addMarkers);
    }
  // Stable key: only re-run when IDs, statuses, provider assignments, or best picks change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments.map(a => `${a.id}:${a.status}:${a.provider_id ?? ''}`).join('|'), bestPickIds.join(',')]);

  return (
    <>
      <style>{`
        .mapboxgl-marker {
          overflow: visible !important;
        }

        .marker-high {
          animation: pulse 1.6s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,0,0,0.7); }
          70% { box-shadow: 0 0 0 14px rgba(255,0,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,0,0,0); }
        }
      `}</style>

      <div ref={mapContainer} className="absolute inset-0" />
    </>
  );
}
