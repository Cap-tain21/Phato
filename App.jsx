import React, { useMemo, useState } from 'react'; import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'; import L from 'leaflet'; import { Search, LocateFixed, Layers3, Phone, Navigation2, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

// Replace your current passenger map screen with this component. // It keeps the map focused on nearby vehicles, adds clustering at lower zoom, // and shows a bottom sheet list instead of exposing every marker at once.

type VehicleStatus = 'open' | 'full' | 'offline'; type VehicleType = 'Auto' | 'Shared Car' | 'Mini Bus' | 'Traveller' | 'Bus' | 'Sumo/Bolero';

type Vehicle = { id: string; name: string; vehicleType: VehicleType; route: string; status: VehicleStatus; seatsLeft: number; fare: string; phone: string; lat: number; lng: number; };

type ClusterItem = | { kind: 'vehicle'; item: Vehicle } | { kind: 'cluster'; id: string; lat: number; lng: number; count: number; items: Vehicle[] };

const DEFAULT_CENTER: [number, number] = [24.826, 92.8]; const DEFAULT_ZOOM = 12; const CLUSTER_ZOOM_THRESHOLD = 13;

const statusMeta: Record<VehicleStatus, { label: string; dot: string; chip: string }> = { open: { label: 'Open', dot: 'bg-emerald-500', chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700' }, full: { label: 'Full', dot: 'bg-rose-500', chip: 'border-rose-500/30 bg-rose-500/10 text-rose-700' }, offline: { label: 'Offline', dot: 'bg-zinc-400', chip: 'border-zinc-400/30 bg-zinc-400/10 text-zinc-700' }, };

const mockVehicles: Vehicle[] = [ { id: '1', name: 'Rafiq Auto', vehicleType: 'Auto', route: 'Hailakandi → Silchar', status: 'open', seatsLeft: 2, fare: '₹120', phone: '9876543210', lat: 24.821, lng: 92.803 }, { id: '2', name: 'Mina Shared', vehicleType: 'Shared Car', route: 'Lala → Hailakandi', status: 'open', seatsLeft: 3, fare: '₹80', phone: '9876543211', lat: 24.828, lng: 92.812 }, { id: '3', name: 'Ali Traveller', vehicleType: 'Traveller', route: 'Silchar → Hailakandi', status: 'full', seatsLeft: 0, fare: '₹200', phone: '9876543212', lat: 24.835, lng: 92.795 }, { id: '4', name: 'Noor Sumo', vehicleType: 'Sumo/Bolero', route: 'Katlicherra → Silchar', status: 'open', seatsLeft: 4, fare: '₹150', phone: '9876543213', lat: 24.817, lng: 92.817 }, { id: '5', name: 'Joy Mini Bus', vehicleType: 'Mini Bus', route: 'Hailakandi Town Loop', status: 'open', seatsLeft: 10, fare: '₹35', phone: '9876543214', lat: 24.839, lng: 92.789 }, { id: '6', name: 'Bahar Bus', vehicleType: 'Bus', route: 'Silchar → Lala', status: 'offline', seatsLeft: 0, fare: '₹60', phone: '9876543215', lat: 24.843, lng: 92.822 }, ];

function distanceKm(a: [number, number], b: [number, number]) { const R = 6371; const dLat = ((b[0] - a[0]) * Math.PI) / 180; const dLng = ((b[1] - a[1]) * Math.PI) / 180; const lat1 = (a[0] * Math.PI) / 180; const lat2 = (b[0] * Math.PI) / 180; const sinDLat = Math.sin(dLat / 2); const sinDLng = Math.sin(dLng / 2); const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng; return 2 * R * Math.asin(Math.sqrt(h)); }

function formatKm(km: number) { return km < 1 ? ${Math.round(km * 1000)}m : ${km.toFixed(1)}km; }

function createClusterKey(lat: number, lng: number, zoom: number) { const factor = Math.max(1, Math.round((zoom - 8) * 2)); const size = 0.015 / factor; const x = Math.floor(lng / size); const y = Math.floor(lat / size); return ${x}:${y}; }

function buildClusters(items: Vehicle[], zoom: number): ClusterItem[] { if (zoom >= CLUSTER_ZOOM_THRESHOLD) { return items.map((item) => ({ kind: 'vehicle', item })); }

const groups = new Map<string, Vehicle[]>(); for (const item of items) { const key = createClusterKey(item.lat, item.lng, zoom); const arr = groups.get(key) ?? []; arr.push(item); groups.set(key, arr); }

const out: ClusterItem[] = []; groups.forEach((group, key) => { if (group.length === 1) { out.push({ kind: 'vehicle', item: group[0] }); return; } const lat = group.reduce((sum, v) => sum + v.lat, 0) / group.length; const lng = group.reduce((sum, v) => sum + v.lng, 0) / group.length; out.push({ kind: 'cluster', id: key, lat, lng, count: group.length, items: group }); }); return out; }

function getMarkerIcon(vehicle: Vehicle) { const hue = vehicle.status === 'open' ? '#22c55e' : vehicle.status === 'full' ? '#f43f5e' : '#a1a1aa'; return L.divIcon({ className: '', html: <div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:9999px;background:${hue};box-shadow:0 10px 20px rgba(0,0,0,0.18);border:3px solid white;font-size:18px;">🚖</div>, iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -16], }); }

function getClusterIcon(count: number) { const size = Math.min(62, 38 + count * 2); return L.divIcon({ className: '', html: <div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:#111827;color:white;border:4px solid white;box-shadow:0 14px 30px rgba(0,0,0,0.22);font-weight:700;"> ${count} </div>, iconSize: [size, size], iconAnchor: [size / 2, size / 2], }); }

function MapZoomTracker({ onZoom }: { onZoom: (zoom: number) => void }) { useMapEvents({ zoomend(e) { onZoom(e.target.getZoom()); }, }); return null; }

export default function PhatoPassengerMapUpdated() { const [query, setQuery] = useState(''); const [zoom, setZoom] = useState(DEFAULT_ZOOM); const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER); const [sheetOpen, setSheetOpen] = useState(true); const [selected, setSelected] = useState<Vehicle | null>(null);

const visibleVehicles = useMemo(() => { const q = query.trim().toLowerCase(); const matched = mockVehicles.filter((v) => { if (!q) return true; return [v.name, v.route, v.vehicleType, v.status, v.fare].some((field) => field.toLowerCase().includes(q)); });

return matched
  .map((v) => ({ ...v, _distance: distanceKm(center, [v.lat, v.lng]) }))
  .sort((a, b) => a._distance - b._distance)
  .slice(0, 80);

}, [query, center]);

const clusters = useMemo(() => buildClusters(visibleVehicles, zoom), [visibleVehicles, zoom]);

const nearbyCount = visibleVehicles.filter((v) => v.status !== 'offline').length; const openCount = visibleVehicles.filter((v) => v.status === 'open').length;

return ( <div className="flex h-screen w-full flex-col bg-neutral-100 text-neutral-900"> <div className="sticky top-0 z-30 border-b border-black/5 bg-neutral-100/95 px-4 pb-3 pt-4 backdrop-blur"> <div className="flex items-center gap-3"> <button className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-900 text-white shadow-sm"> <Navigation2 className="h-5 w-5 rotate-180" /> </button>

<div className="flex h-12 flex-1 items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 shadow-sm">
        <Search className="h-4 w-4 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Going to… Silchar, Lala…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
      </div>

      <button className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-900 text-white shadow-sm">
        <Layers3 className="h-5 w-5 text-orange-400" />
      </button>
    </div>

    <div className="mt-3 flex items-center gap-2 text-xs">
      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-700">{nearbyCount} nearby</span>
      <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-neutral-600">{openCount} open</span>
      <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-neutral-600">{clusters.length} visible nodes</span>
    </div>
  </div>

  <div className="relative flex-1 overflow-hidden">
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full"
      zoomControl={false}
      style={{ background: '#dbeafe' }}
    >
      <MapZoomTracker onZoom={setZoom} />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {clusters.map((entry) => {
        if (entry.kind === 'vehicle') {
          const v = entry.item;
          return (
            <Marker
              key={v.id}
              position={[v.lat, v.lng]}
              icon={getMarkerIcon(v)}
              eventHandlers={{ click: () => setSelected(v) }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <div className="font-semibold">{v.name}</div>
                  <div className="text-sm text-neutral-600">{v.vehicleType} · {v.route}</div>
                  <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${statusMeta[v.status].chip}`}>
                    {statusMeta[v.status].label} · {v.seatsLeft} seats
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        }

        return (
          <Marker
            key={entry.id}
            position={[entry.lat, entry.lng]}
            icon={getClusterIcon(entry.count)}
            eventHandlers={{
              click: () => {
                const avgLat = entry.items.reduce((s, i) => s + i.lat, 0) / entry.items.length;
                const avgLng = entry.items.reduce((s, i) => s + i.lng, 0) / entry.items.length;
                setCenter([avgLat, avgLng]);
                setZoom(Math.min(zoom + 2, 18));
              },
            }}
          >
            <Popup>
              <div className="text-sm font-medium">{entry.count} vehicles in this area</div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>

    <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      Focused on nearby rides only
    </div>

    <button
      onClick={() => setCenter(DEFAULT_CENTER)}
      className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-lg"
      aria-label="Center map"
    >
      <LocateFixed className="h-5 w-5 text-neutral-900" />
    </button>

    <button
      onClick={() => setSheetOpen((v) => !v)}
      className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
    >
      {sheetOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      {sheetOpen ? 'Hide results' : 'Show results'}
    </button>
  </div>

  <div className={`transition-all duration-300 ${sheetOpen ? 'max-h-[42vh]' : 'max-h-0'} overflow-hidden border-t border-black/5 bg-white`}>
    <div className="max-h-[42vh] overflow-y-auto px-4 pb-6 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Nearby vehicles</div>
          <div className="text-xs text-neutral-500">Sorted by closest first</div>
        </div>
        <button className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-neutral-700">
          {selected ? '1 selected' : 'Tap a card'}
        </button>
      </div>

      <div className="grid gap-3">
        {visibleVehicles.map((v) => (
          <button
            key={v.id}
            onClick={() => {
              setSelected(v);
              setCenter([v.lat, v.lng]);
              setZoom(Math.max(15, zoom));
            }}
            className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${selected?.id === v.id ? 'border-neutral-900 bg-neutral-50' : 'border-black/5 bg-white'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold">{v.name}</div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusMeta[v.status].chip}`}>{statusMeta[v.status].label}</span>
                </div>
                <div className="mt-1 text-sm text-neutral-500">{v.vehicleType} · {v.route}</div>
              </div>
              <div className="text-right text-sm font-semibold">{formatKm(v._distance)}</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
              <span className="rounded-full bg-neutral-100 px-3 py-1">{v.seatsLeft} seats left</span>
              <span className="rounded-full bg-neutral-100 px-3 py-1">Fare {v.fare}</span>
              <span className="rounded-full bg-neutral-100 px-3 py-1">Live nearby</span>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 rounded-2xl bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white">
                Call Driver
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-black/5 bg-neutral-50">
                <Phone className="h-4 w-4" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>

  {selected && (
    <div className="fixed bottom-4 right-4 z-50 max-w-[320px] rounded-3xl border border-black/5 bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{selected.name}</div>
          <div className="text-xs text-neutral-500">{selected.vehicleType} · {selected.route}</div>
        </div>
        <button onClick={() => setSelected(null)} className="rounded-full bg-neutral-100 px-3 py-1 text-xs">
          Close
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className={`rounded-full border px-2 py-1 ${statusMeta[selected.status].chip}`}>{statusMeta[selected.status].label}</span>
        <span className="rounded-full border border-black/10 px-2 py-1 text-neutral-600">{selected.seatsLeft} seats</span>
        <span className="rounded-full border border-black/10 px-2 py-1 text-neutral-600">{selected.fare}</span>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white">Call</button>
        <button className="flex-1 rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white">Directions</button>
      </div>
    </div>
  )}
</div>

); }
