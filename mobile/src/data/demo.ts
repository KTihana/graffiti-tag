import type { Tag } from '../types';
// Demonstration records, never imported into the shared archive. All dates and locations are illustrative.
const files = ['02', '05', '06', '07'];
const pictures = [
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Graffiti_in_Zagreb_02.jpg/1280px-Graffiti_in_Zagreb_02.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Graffiti_in_Zagreb_05.jpg/1280px-Graffiti_in_Zagreb_05.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Graffiti_in_Zagreb_06.jpg/1280px-Graffiti_in_Zagreb_06.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Graffiti_in_Zagreb_07.jpg/1280px-Graffiti_in_Zagreb_07.jpg',
];
const locations = [
  ['The railway wall', 45.8028, 15.9754, 'Piece'],
  ['Colour on concrete', 45.8091, 15.9685, 'Mural'],
  ['A little rebellion', 45.8118, 15.9818, 'Stencil'],
  ['Letters from the street', 45.8051, 15.9893, 'Lettering'],
  ['Under the bridge', 45.7971, 15.9663, 'Piece'],
  ['Layers of the city', 45.8151, 15.9915, 'Mural'],
] as const;
export const demoTags: Tag[] = locations.map(([title, latitude, longitude, kind], i) => ({
  id: `demo-${i + 1}`,
  title,
  latitude,
  longitude,
  revision: 1,
  createdAt: '2026-10-01T12:00:00Z',
  demo: true,
  description:
    'An example wall in our local demo. These locations and dates illustrate the archive; they are not verified records of the pictured art.',
  artworks: [
    {
      id: `art-${i}-1`,
      title: i === 0 ? 'Chromatic letters' : title,
      artist: 'Unknown artist',
      kind,
    },
    ...(i === 0
      ? [
          {
            id: 'art-0-2',
            title: 'An earlier layer',
            artist: 'Unknown artist',
            kind: 'Piece' as const,
          },
        ]
      : []),
  ],
  photos: (i === 0 ? [2026, 2023, 2018] : [2025 - i]).map((year, j) => ({
    id: `photo-${i}-${j}`,
    artworkId: i === 0 && j === 2 ? 'art-0-2' : `art-${i}-1`,
    uri: pictures[(i + j) % 4],
    year,
    takenOn: null,
    precision: j === 2 ? ('approximate' as const) : ('year' as const),
    condition: 'present' as const,
    caption:
      j === 2
        ? 'An older photograph can preserve a piece that is no longer here.'
        : 'Every photograph keeps a piece of the city alive.',
    photographer: 'Gveret Tered',
    contributor: 'Demo collection',
    uploadedAt: '2026-10-01T12:00:00Z',
    sourceUrl: `https://commons.wikimedia.org/wiki/File:Graffiti_in_Zagreb_${files[(i + j) % 4]}.jpg`,
    license: 'CC BY-SA 4.0',
  })),
}));
