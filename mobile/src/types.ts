export type Precision = 'exact' | 'year' | 'approximate' | 'unknown';
export type Condition = 'present' | 'faded' | 'covered' | 'gone';
export type ArtType = 'Piece' | 'Mural' | 'Lettering' | 'Stencil' | 'Other';
export type Point = { latitude: number; longitude: number };
export type UserLocation = Point & { accuracy: number | null };
export type Viewport = Point & { latitudeDelta: number; longitudeDelta: number };
export type Artwork = { id: string; title: string; artist: string; kind: ArtType; kinds?: ArtType[] };
export type Photo = {
  id: string;
  artworkId: string;
  uri: string;
  originalPath?: string;
  previewPath?: string;
  year: number | null;
  takenOn: string | null;
  precision: Precision;
  condition: Condition;
  caption: string;
  photographer: string;
  contributor: string;
  uploadedAt: string;
  sourceUrl?: string;
  license?: string;
};
export type Tag = Point & {
  id: string;
  title: string;
  description: string;
  artworks: Artwork[];
  photos: Photo[];
  revision: number;
  createdAt: string;
  demo?: boolean;
};
export type TagFields = Pick<Tag, 'title' | 'description' | 'latitude' | 'longitude'>;
export type RecordDetails = Pick<
  Photo,
  'year' | 'takenOn' | 'precision' | 'condition' | 'caption' | 'photographer'
> & { photoId: string; artworkTitle: string; artist: string; kind: ArtType; kinds?: ArtType[] };
export type Snapshot = TagFields & { record?: RecordDetails };
export type Revision = {
  id: string;
  tagId: string;
  actor: string;
  action: string;
  createdAt: string;
  before: Snapshot | null;
  after: Snapshot;
  version: number;
};
export type Report = {
  id: string;
  tagId: string;
  reason: string;
  createdAt: string;
  status: 'open' | 'resolved';
  reporter: string;
};
export type Contribution = {
  submissionId?: string;
  tagId?: string;
  artworkId?: string;
  title: string;
  description: string;
  point: Point;
  artworkTitle: string;
  artist: string;
  kind: ArtType;
  kinds?: ArtType[];
  imageUri: string;
  mimeType: string;
  year: string;
  takenOn: string;
  precision: Precision;
  condition: Condition;
  caption: string;
  photographer: string;
  rightsConfirmed: boolean;
};
export const INITIAL_VIEW: Viewport = {
  latitude: 45.807,
  longitude: 15.978,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};
