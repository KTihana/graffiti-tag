import Supercluster from 'supercluster';
import type { Tag, Viewport } from '../types';
export function clusters(tags: Tag[], view: Viewport) {
  const index = new Supercluster<{ tagId: string }>({ radius: 55, maxZoom: 19 }).load(
    tags.map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.longitude, t.latitude] },
      properties: { tagId: t.id },
    })),
  );
  const zoom = Math.max(
    0,
    Math.min(20, Math.round(Math.log2(360 / Math.max(view.longitudeDelta, 0.0001)))),
  );
  return index
    .getClusters([-180, -90, 180, 90], zoom)
    .map((f) => ({
      id: 'cluster' in f.properties ? `cluster-${f.id}` : f.properties.tagId,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      count: 'cluster' in f.properties ? f.properties.point_count : 1,
    }));
}
