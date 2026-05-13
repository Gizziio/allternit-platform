import { memo } from "react";
import { IconMapPin, IconNavigation } from "@tabler/icons-react";
import { ToolRowBase } from "./tool-row-base";
import { cn } from "../utils/cn";

export type MapLocation = {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  description?: string;
};

export type MapDisplayToolProps = {
  part: {
    id?: string;
    toolCallId?: string;
    type?: string;
    state?: string;
    input?: Record<string, unknown>;
    args?: Record<string, unknown>;
    output?: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
  defaultOpen?: boolean;
};

function normalizeLocations(value: unknown): MapLocation[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const raw = v.locations ?? v.places ?? v.results ?? v;
  if (!Array.isArray(raw)) {
    if (raw && typeof raw === "object" && ("lat" in raw || "name" in raw)) {
      const single = normalizeSingleLocation(raw);
      return single ? [single] : undefined;
    }
    return undefined;
  }
  return raw
    .map(normalizeSingleLocation)
    .filter((item): item is MapLocation => Boolean(item));
}

function normalizeSingleLocation(value: unknown): MapLocation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name : undefined;
  const address = typeof v.address === "string" ? v.address : undefined;
  const lat = typeof v.lat === "number" ? v.lat : typeof v.latitude === "number" ? v.latitude : undefined;
  const lng = typeof v.lng === "number" ? v.lng : typeof v.lon === "number" ? v.lon : typeof v.longitude === "number" ? v.longitude : undefined;
  const description = typeof v.description === "string" ? v.description : undefined;
  if (!name && !address && lat === undefined && lng === undefined) return undefined;
  return { name, address, lat, lng, description };
}

function buildMapUrl(locations: MapLocation[]): string {
  // Use Google Maps Static API or OpenStreetMap embed
  // For a simple approach, use Google Maps search URL
  if (locations.length === 1 && locations[0].lat && locations[0].lng) {
    return `https://www.google.com/maps?q=${locations[0].lat},${locations[0].lng}`;
  }
  const query = locations
    .map((l) => l.name || l.address)
    .filter(Boolean)
    .join(" to ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "")}`;
}

export const MapDisplayTool = memo(function MapDisplayTool({
  part,
  defaultOpen = true,
}: MapDisplayToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error";

  const locations =
    normalizeLocations(part.output) ??
    normalizeLocations(part.result) ??
    normalizeLocations(part.input) ??
    normalizeLocations(part.args) ??
    [];

  const mapUrl = buildMapUrl(locations);

  return (
    <ToolRowBase
      icon={<IconMapPin className="w-full h-full text-muted-foreground" />}
      shimmerLabel="Loading map..."
      completeLabel={
        locations.length === 1
          ? locations[0].name || "Location shown"
          : `${locations.length} locations`
      }
      isAnimating={isPending}
      expandable={locations.length > 0}
      defaultOpen={defaultOpen}
    >
      <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative aspect-[16/9] bg-muted group"
        >
          <iframe
            src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d100000!2d${locations[0]?.lng ?? 0}!3d${locations[0]?.lat ?? 0}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1`}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Map"
            onError={(e) => {
              (e.target as HTMLIFrameElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-muted pointer-events-none">
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <IconNavigation className="size-6 " />
              <span className="text-xs">Open in Google Maps</span>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 pointer-events-none">
            <span className="text-xs font-medium text-foreground bg-background/90 px-2 py-1 rounded-full shadow-sm">
              Open in Maps
            </span>
          </div>
        </a>
        {locations.length > 0 && (
          <div className="p-2 space-y-1.5">
            {locations.map((loc, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex items-center justify-center size-5  rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  {loc.name && (
                    <div className="text-sm font-medium text-foreground truncate">
                      {loc.name}
                    </div>
                  )}
                  {loc.address && (
                    <div className="text-xs text-muted-foreground truncate">
                      {loc.address}
                    </div>
                  )}
                  {loc.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {loc.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolRowBase>
  );
});
