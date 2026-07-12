import { cn } from '@/lib/ui/cn';

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
}

// Map wrapper (plan §20.4, D14). PLACEHOLDER for E0.10 — renders a framed box
// with the marker coordinates. The real provider (Google Maps behind GeoProvider)
// is wired at the live-map screen (E4.6); consumers use this stable prop shape.
export function MapView({
  markers = [],
  className,
  height = 240,
}: {
  markers?: MapMarker[];
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-center text-sm text-gray-400',
        className,
      )}
      style={{ height }}
      role="img"
      aria-label="Mapa"
    >
      <div>
        <div className="text-2xl">🗺️</div>
        <p className="mt-1">Map placeholder (E4.6)</p>
        {markers.length > 0 && (
          <p className="mt-1 text-xs">
            {markers.map((m, i) => `${m.label ?? 'pin'} ${m.lat.toFixed(3)},${m.lng.toFixed(3)}`).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
