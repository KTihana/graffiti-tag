import type { Point, Tag, Viewport } from '../types';
export type MapProps = {
  tags: Tag[];
  target: Viewport;
  onSelect: (id: string) => void;
  onViewport?: (view: Viewport) => void;
  selectedId?: string;
  satellite?: boolean;
  onPick?: (p: Point) => void;
  pick?: Point;
  showLocation?: boolean;
};
