import type { FloodArea } from "@/shared/types/flood";

/**
 * Match a baseline flood zone to its simulated counterpart.
 *
 * The map and the sidebar used to join these two lists differently — the sidebar
 * fuzzily, the 3D extrusion by exact string — so they could disagree about which zones a
 * scenario had touched. One implementation, used by both.
 *
 * Tolerant of ordering and separator noise ("Rạch Ông" vs "Rach Ong,"), because zone
 * names come from the API as display strings, not identifiers.
 */
function canonical(name: string): string {
  return name
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function zonesMatch(a: string, b: string): boolean {
  return canonical(a) === canonical(b);
}

/**
 * Index simulated areas by canonical name for O(1) lookup while rendering. Prefer this
 * over calling `zonesMatch` inside a loop over both lists.
 */
export function indexByName(areas: readonly FloodArea[]): Map<string, FloodArea> {
  return new Map(areas.map((a) => [canonical(a.name), a]));
}

export function findZone(
  index: Map<string, FloodArea>,
  name: string,
): FloodArea | undefined {
  return index.get(canonical(name));
}
