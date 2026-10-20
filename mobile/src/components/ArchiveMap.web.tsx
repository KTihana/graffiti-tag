import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import type * as L from 'leaflet';
import { APIProvider, Map as GoogleMap, Marker, useMap } from '@vis.gl/react-google-maps';
import 'leaflet/dist/leaflet.css';
import type { MapProps } from './mapTypes';
import { clusters } from './clusters';
import type { UserLocation } from '../types';

const pinImages = {
  normal: Asset.fromModule(require('../../assets/markers/pin.png')).uri,
  selected: Asset.fromModule(require('../../assets/markers/pin-selected.png')).uri,
};
const locationDot = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="#4285F4" fill-opacity=".18"/><circle cx="14" cy="14" r="8" fill="#4285F4" stroke="white" stroke-width="3"/></svg>')}`;

function GoogleUserLocation({ position }: { position?: UserLocation | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !position || position.accuracy === null || !Number.isFinite(position.accuracy)) return;
    const circle = new google.maps.Circle({
      map,
      center: { lat: position.latitude, lng: position.longitude },
      radius: Math.max(0, position.accuracy),
      strokeColor: '#4285F4',
      strokeOpacity: 0.3,
      strokeWeight: 1,
      fillColor: '#4285F4',
      fillOpacity: 0.12,
      clickable: false,
    });
    return () => circle.setMap(null);
  }, [map, position]);
  if (!map || !position) return null;
  return (
    <Marker
      position={{ lat: position.latitude, lng: position.longitude }}
      title="Your current location"
      clickable={false}
      zIndex={1000}
      icon={{ url: locationDot, scaledSize: new google.maps.Size(28, 28), anchor: new google.maps.Point(14, 14) }}
    />
  );
}

function GoogleInner(props: MapProps) {
  const map = useMap(),
    [view, setView] = useState(props.target);
  useEffect(() => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = props.target;
    map?.fitBounds({ south: latitude - latitudeDelta / 2, north: latitude + latitudeDelta / 2, west: longitude - longitudeDelta / 2, east: longitude + longitudeDelta / 2 }, 0);
  }, [props.target, map]);
  const points = useMemo(() => clusters(props.tags, view), [props.tags, view]);
  return (
    <div
      className={props.pick ? 'google-map-shell' : 'google-map-shell full'}
      style={{ position: 'absolute', inset: 0 }}
    >
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
        <GoogleUserLocation position={props.userLocation} />
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
        {props.searchPlace && <Marker position={{ lat: props.searchPlace.latitude, lng: props.searchPlace.longitude }} title={`Search result: ${props.searchPlace.title}`} />}
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
    locationLayer = useRef<L.LayerGroup | null>(null),
    searchLayer = useRef<L.LayerGroup | null>(null),
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
      locationLayer.current = leaflet.layerGroup().addTo(m);
      searchLayer.current = leaflet.layerGroup().addTo(m);
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
    if (!ready || !container.current) return;
    const observer = new ResizeObserver(() => instance.current?.invalidateSize());
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [ready]);
  useEffect(() => {
    const m = instance.current;
    if (!ready || !m) return;
    const { latitude, longitude, latitudeDelta, longitudeDelta } = props.target;
    m.flyToBounds([[latitude - latitudeDelta / 2, longitude - longitudeDelta / 2], [latitude + latitudeDelta / 2, longitude + longitudeDelta / 2]], { duration: 0.8, maxZoom: 18 });
  }, [props.target, ready]);
  useEffect(() => {
    const l = library.current, group = searchLayer.current, place = props.searchPlace;
    if (!ready || !l || !group) return;
    group.clearLayers();
    if (!place) return;
    const el = document.createElement('span');
    el.textContent = '●';
    el.style.cssText = 'display:block;width:28px;height:28px;border:4px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#3B735B;color:transparent;box-shadow:0 2px 8px #0004';
    const marker = l.marker([place.latitude, place.longitude], {
      title: `Search result: ${place.title}`, alt: `Search result: ${place.title}`,
      icon: l.divIcon({ html: el, className: 'search-place-pin', iconSize: [28, 28], iconAnchor: [14, 32] }),
    }).bindTooltip(place.title).addTo(group);
    marker.getElement()?.setAttribute('aria-label', `Search result: ${place.title}`);
  }, [props.searchPlace, ready]);
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
  useEffect(() => {
    const l = library.current, group = locationLayer.current, position = props.userLocation;
    if (!ready || !l || !group) return;
    group.clearLayers();
    if (!position) return;
    const coordinates: L.LatLngExpression = [position.latitude, position.longitude];
    if (position.accuracy !== null && Number.isFinite(position.accuracy)) {
      l.circle(coordinates, {
        radius: Math.max(0, position.accuracy),
        color: '#4285F4',
        weight: 1,
        opacity: 0.3,
        fillColor: '#4285F4',
        fillOpacity: 0.12,
        interactive: false,
        className: 'user-location-accuracy',
      }).addTo(group);
    }
    l.marker(coordinates, {
      icon: l.icon({ iconUrl: locationDot, iconSize: [28, 28], iconAnchor: [14, 14], className: 'user-location-dot' }),
      title: 'Your current location',
      alt: 'Your current location',
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(group);
  }, [props.userLocation, ready]);
  return (
    <>
      <style>
        {
          '.leaflet-container{background:#e9eddf;font-family:Inter_400Regular,sans-serif}.leaflet-control-attribution{font-size:9px!important}.leaflet-marker-icon:focus{outline:3px solid #73953b;outline-offset:3px}.preview-credit{position:absolute;bottom:3px;left:7px;font:10px sans-serif;color:#58624d;background:#ffffffdc;padding:3px;pointer-events:none;z-index:400}.preview-credit.editor{bottom:3px}@media(min-width:801px){.archive-full-map .leaflet-control-attribution{margin-bottom:0!important}.preview-credit{bottom:3px}}'
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
