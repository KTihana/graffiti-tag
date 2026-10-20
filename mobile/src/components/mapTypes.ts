import type { Point, Tag, UserLocation, Viewport } from '../types';
export type MapProps = {
  tags: Tag[];
  searchPlace?: Point & { title: string };
  target: Viewport;
  onSelect: (id: string) => void;
  onViewport?: (view: Viewport) => void;
  selectedId?: string;
  satellite?: boolean;
  onPick?: (p: Point) => void;
  onLongPress?: (p: Point) => void;
  draft?: Point;
  pick?: Point;
  userLocation?: UserLocation | null;
};
