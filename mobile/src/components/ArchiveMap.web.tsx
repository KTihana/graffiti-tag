import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import type * as L from 'leaflet';
import { APIProvider, Map as GoogleMap, Marker, useMap } from '@vis.gl/react-google-maps';
import 'leaflet/dist/leaflet.css';
import type { MapProps } from './mapTypes';
import { clusters } from './clusters';

const pinImages = {
  normal: Asset.fromModule(require('../../assets/markers/pin.png')).uri,
  selected: Asset.fromModule(require('../../assets/markers/pin-selected.png')).uri,
};

function GoogleInner(props: MapProps) {
  const map = useMap(),
    [view, setView] = useState(props.target);
  useEffect(() => {
    map?.panTo({ lat: props.target.latitude, lng: props.target.longitude });
    map?.setZoom(Math.round(Math.log2(360 / props.target.longitudeDelta)));
  }, [props.target, map]);
  const points = useMemo(() => clusters(props.tags, view), [props.tags, view]);
  return (
    <div
      className={props.pick ? 'google-map-shell' : 'google-map-shell full'}
      style={{ position: 'absolute', inset: 0 }}
    >
      <style>{'@media(max-width:800px){.google-map-shell.full{bottom:82px!important}}'}</style>
      <GoogleMap
        defaultCenter={{ lat: props.target.latitude, lng: props.target.longitude }}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI
        mapTypeId={props.satellite ? 'hybrid' : 'roadmap'}
        onClick={(e) =>
          e.detail.latLng &&
          props.onPick?.({ latitude: e.detail.latLng.lat, longitude: e.detail.latLng.lng })
        }
        onCameraChanged={(e) => {
          const { center, bounds } = e.detail;
          const v = {
            latitude: center.lat,
            longitude: center.lng,
            latitudeDelta: bounds.north - bounds.south,
            longitudeDelta: (bounds.east - bounds.west + 360) % 360 || 360,
          };
          setView(v);
          props.onViewport?.(v);
        }}
      >
        {(map ? points : []).map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.latitude, lng: p.longitude }}
            title={
              p.count > 1
                ? `${p.count} tags`
                : props.tags.find((tag) => tag.id === p.id)?.title || 'Graffiti tag'
            }
            icon={{
              url: tagMarkerSvg(p.count, p.id === props.selectedId),
              scaledSize: new google.maps.Size(p.count > 1 ? 42 : 44, p.count > 1 ? 42 : 50),
              anchor: new google.maps.Point(p.count > 1 ? 21 : 22, p.count > 1 ? 21 : 46),
            }}
            onClick={() =>
              p.count > 1
                ? (map?.panTo({ lat: p.latitude, lng: p.longitude }),
                  map?.setZoom((map.getZoom() || 10) + 2))
                : props.onSelect(p.id)
            }
          />
        ))}
        {props.pick && (
          <Marker position={{ lat: props.pick.latitude, lng: props.pick.longitude }} />
        )}
      </GoogleMap>
    </div>
  );
}

function tagMarkerSvg(count: number, selected: boolean) {
  if (count === 1) return selected ? pinImages.selected : pinImages.normal;
  const background = selected ? '#DFFF65' : '#242B24';
  const foreground = selected ? '#242B24' : '#DFFF65';
  const content = `<text x="21" y="26" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="${foreground}">${count}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r="18.5" fill="${background}" stroke="#fff" stroke-width="3"/>${content}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function PreviewMap(props: MapProps) {
  const container = useRef<HTMLDivElement>(null),
    instance = useRef<L.Map | null>(null),
    library = useRef<typeof L | null>(null),
    layer = useRef<L.LayerGroup | null>(null),
    callbacks = useRef(props);
  const [ready, setReady] = useState(false),
    [view, setView] = useState(props.target);
  useEffect(() => {
    callbacks.current = props;
  }, [props]);
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((leaflet) => {
      if (cancelled || !container.current) return;
      library.current = leaflet;
      const m = leaflet
        .map(container.current, { zoomControl: false, attributionControl: true })
        .setView([callbacks.current.target.latitude, callbacks.current.target.longitude], 14);
      instance.current = m;
      leaflet
        .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          detectRetina: true,
          maxZoom: 19,
        })
        .addTo(m);
      layer.current = leaflet.layerGroup().addTo(m);
      m.on('moveend', () => {
        const c = m.getCenter(),
          b = m.getBounds();
        const v = {
          latitude: c.lat,
          longitude: ((c.lng + 540) % 360) - 180,
          latitudeDelta: b.getNorth() - b.getSouth(),
          longitudeDelta: b.getEast() - b.getWest(),
        };
        setView(v);
        callbacks.current.onViewport?.(v);
      });
      m.on('click', (e: L.LeafletMouseEvent) =>
        callbacks.current.onPick?.({
          latitude: e.latlng.lat,
          longitude: ((e.latlng.lng + 540) % 360) - 180,
        }),
      );
      setReady(true);
    });
    return () => {
      cancelled = true;
      instance.current?.remove();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    if (ready)
      instance.current?.flyTo(
        [props.target.latitude, props.target.longitude],
        Math.min(19, Math.round(Math.log2(360 / props.target.longitudeDelta))),
        { duration: 0.8 },
      );
  }, [props.target, ready]);
  useEffect(() => {
    const l = library.current,
      m = instance.current,
      group = layer.current;
    if (!ready || !l || !m || !group) return;
    group.clearLayers();
    clusters(props.tags, view).forEach((p) => {
      const el = document.createElement('img');
      el.src = tagMarkerSvg(p.count, props.selectedId === p.id);
      el.alt = p.count > 1 ? `${p.count} tags` : 'Graffiti pin marking an archived wall';
      el.width = p.count > 1 ? 42 : 44;
      el.height = p.count > 1 ? 42 : 50;
      const title = p.count > 1 ? `${p.count} tags` : props.tags.find((t) => t.id === p.id)?.title;
      l.marker([p.latitude, p.longitude], {
        title,
        icon: l.divIcon({
          html: el,
          className: '',
          iconSize: p.count > 1 ? [42, 42] : [44, 50],
          iconAnchor: p.count > 1 ? [21, 21] : [22, 46],
        }),
      })
        .on('click', () =>
          p.count > 1
            ? m.flyTo([p.latitude, p.longitude], m.getZoom() + 2, { duration: 0.5 })
            : callbacks.current.onSelect(p.id),
        )
        .addTo(group);
    });
    if (props.pick)
      l.circleMarker([props.pick.latitude, props.pick.longitude], {
        radius: 11,
        color: 'white',
        weight: 4,
        fillColor: '#EA6347',
        fillOpacity: 1,
      }).addTo(group);
  }, [props.tags, props.selectedId, props.pick, view, ready]);
  return (
    <>
      <style>
        {
          '.leaflet-container{background:#e9eddf;font-family:Inter_400Regular,sans-serif}.leaflet-control-attribution{font-size:9px!important}.leaflet-marker-icon:focus{outline:3px solid #73953b;outline-offset:3px}.archive-full-map .leaflet-control-attribution{margin-bottom:82px!important}.preview-credit{position:absolute;bottom:82px;left:7px;font:10px sans-serif;color:#58624d;background:#ffffffdc;padding:3px;pointer-events:none;z-index:400}.preview-credit.editor{bottom:3px}@media(min-width:801px){.archive-full-map .leaflet-control-attribution{margin-bottom:0!important}.preview-credit{bottom:3px}}'
        }
      </style>
      <div
        ref={container}
        className={props.pick ? undefined : 'archive-full-map'}
        style={{ position: 'absolute', inset: 0 }}
      />
      <div className={props.pick ? 'preview-credit editor' : 'preview-credit'}>Preview map</div>
    </>
  );
}
export default function ArchiveMap(props: MapProps) {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      {key ? (
        <APIProvider apiKey={key}>
          <GoogleInner {...props} />
        </APIProvider>
      ) : (
        <PreviewMap {...props} />
      )}
    </div>
  );
}
