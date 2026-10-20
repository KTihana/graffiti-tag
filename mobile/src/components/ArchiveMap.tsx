import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import { colors, ui } from '../theme';
import type { MapProps } from './mapTypes';
import { clusters } from './clusters';
import GraffitiPinMarker from './GraffitiPinMarker';
export default function ArchiveMap(props: MapProps) {
  const map = useRef<MapView>(null);
  const [view, setView] = useState(props.target);
  useEffect(() => {
    map.current?.animateToRegion(props.target, 500);
  }, [props.target]);
  const points = useMemo(() => clusters(props.tags, view), [props.tags, view]);
  if (
    !Constants.expoConfig?.extra?.googleMapsConfigured &&
    Constants.executionEnvironment !== 'storeClient'
  )
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.soft, justifyContent: 'center', padding: 35 },
        ]}
      >
        <Text style={ui.subtitle}>Connect the Google map</Text>
        <Text style={ui.body}>
          This build needs its Google Maps key. The archive and photographs are ready to explore
          below.
        </Text>
      </View>
    );
  return (
    <MapView
      ref={map}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={props.target}
      mapType={props.satellite ? 'hybrid' : 'standard'}
      showsUserLocation={!!props.userLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      showsCompass={false}
      mapPadding={{
        top: props.pick || props.draft ? 10 : 200,
        bottom: props.pick || props.draft ? 10 : 350,
        left: 10,
        right: 10,
      }}
      customMapStyle={[
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'landscape', stylers: [{ color: '#eef0e6' }] },
        { featureType: 'water', stylers: [{ color: '#b6d5ce' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      ]}
      onPress={(e) => props.onPick?.(e.nativeEvent.coordinate)}
      onLongPress={(e) => props.onLongPress?.(e.nativeEvent.coordinate)}
      onRegionChangeComplete={(v) => {
        setView(v);
        props.onViewport?.(v);
      }}
    >
      {points.map((p) => (
        <Marker
          key={p.id}
          coordinate={p}
          anchor={{ x: 0.5, y: p.count > 1 ? 0.5 : 0.92 }}
          onPress={(e) => {
            e.stopPropagation();
            if (p.count > 1)
              map.current?.animateToRegion({
                ...p,
                latitudeDelta: view.latitudeDelta / 3,
                longitudeDelta: view.longitudeDelta / 3,
              });
            else props.onSelect(p.id);
          }}
        >
          <GraffitiPinMarker count={p.count} selected={p.id === props.selectedId} />
        </Marker>
      ))}
      {props.searchPlace && <Marker coordinate={props.searchPlace} pinColor="#3B735B" title={props.searchPlace.title} />}
      {props.pick && <Marker coordinate={props.pick} pinColor="#EA6347" title="Your wall" />}
      {props.draft && (
        <Marker coordinate={props.draft} anchor={{ x: 0.5, y: 0.92 }} title="New tag location">
          <GraffitiPinMarker count={1} selected />
        </Marker>
      )}
    </MapView>
  );
}
