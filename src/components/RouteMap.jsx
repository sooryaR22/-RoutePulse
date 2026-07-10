import { useEffect, useRef, useState } from "react";

import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import { getRouteById } from "../data/routes";

const BUS_ANIMATION_DURATION_MS = 900;

const stopIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 18px;
      height: 18px;
      border-radius: 9999px;
      background: #2563eb;
      border: 4px solid white;
      box-shadow: 0 0 18px rgba(37, 99, 235, 0.8);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const busIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: #111827;
      border: 3px solid #22c55e;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 0 24px rgba(34, 197, 94, 0.8);
    ">
      🚌
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

function FitRouteBounds({ stops }) {
  const map = useMap();

  useEffect(() => {
    if (!stops || stops.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      stops.map((stop) => [
        stop.latitude,
        stop.longitude,
      ])
    );

    map.fitBounds(bounds, {
      padding: [40, 40],
    });
  }, [map, stops]);

  return null;
}

function AnimatedBusMarker({ position }) {
  const [animatedPosition, setAnimatedPosition] =
    useState(position);

  const currentPositionRef = useRef(position);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const startPosition = currentPositionRef.current;
    const targetPosition = position;

    const latitudeDifference =
      targetPosition[0] - startPosition[0];

    const longitudeDifference =
      targetPosition[1] - startPosition[1];

    if (
      latitudeDifference === 0 &&
      longitudeDifference === 0
    ) {
      return undefined;
    }

    if (animationFrameRef.current) {
      window.cancelAnimationFrame(
        animationFrameRef.current
      );
    }

    const animationStartTime = performance.now();

    const animateMarker = (currentTime) => {
      const elapsedTime =
        currentTime - animationStartTime;

      const progress = Math.min(
        elapsedTime / BUS_ANIMATION_DURATION_MS,
        1
      );

      const easedProgress =
        progress < 0.5
          ? 2 * progress * progress
          : 1 -
            Math.pow(-2 * progress + 2, 2) / 2;

      const nextPosition = [
        startPosition[0] +
          latitudeDifference * easedProgress,

        startPosition[1] +
          longitudeDifference * easedProgress,
      ];

      currentPositionRef.current = nextPosition;

      setAnimatedPosition(nextPosition);

      if (progress < 1) {
        animationFrameRef.current =
          window.requestAnimationFrame(
            animateMarker
          );
      } else {
        currentPositionRef.current = targetPosition;
        setAnimatedPosition(targetPosition);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current =
      window.requestAnimationFrame(animateMarker);

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(
          animationFrameRef.current
        );
      }
    };
  }, [position[0], position[1]]);

  return (
    <Marker
      position={animatedPosition}
      icon={busIcon}
      zIndexOffset={1000}
    >
      <Popup>
        <strong>RoutePulse Bus</strong>

        <br />

        Current bus position
      </Popup>
    </Marker>
  );
}

export default function RouteMap({
  routeId,
  busLocation,
}) {
  const route = getRouteById(routeId);

  if (!route) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10 text-red-400">
        Route data not found.
      </div>
    );
  }

  const routePositions = route.stops.map((stop) => [
    stop.latitude,
    stop.longitude,
  ]);

  const firstStop = route.stops[0];

  const hasValidBusLocation =
    Number.isFinite(busLocation?.latitude) &&
    Number.isFinite(busLocation?.longitude);

  const busPosition = hasValidBusLocation
    ? [
        busLocation.latitude,
        busLocation.longitude,
      ]
    : [
        firstStop.latitude,
        firstStop.longitude,
      ];

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035]">
      <div className="border-b border-white/[0.07] px-6 py-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-400">
          LIVE ROUTE MAP
        </p>

        <h2 className="mt-2 text-xl font-bold">
          {route.name}
        </h2>

        <p className="mt-2 text-sm text-zinc-500">
          Bus stops, geofence zones, and the current bus position are
          displayed below.
        </p>
      </div>

      <div className="h-[500px] w-full">
        <MapContainer
          center={[
            firstStop.latitude,
            firstStop.longitude,
          ]}
          zoom={12}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Polyline
            positions={routePositions}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.8,
            }}
          />

          {route.stops.map((stop) => (
            <Circle
              key={`geofence-${stop.id}`}
              center={[
                stop.latitude,
                stop.longitude,
              ]}
              radius={route.arrivalRadiusMeters}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.08,
                weight: 1,
              }}
            />
          ))}

          {route.stops.map((stop, index) => (
            <Marker
              key={stop.id}
              position={[
                stop.latitude,
                stop.longitude,
              ]}
              icon={stopIcon}
            >
              <Popup>
                <strong>
                  {index + 1}. {stop.name}
                </strong>

                <br />

                Route stop
              </Popup>
            </Marker>
          ))}

          <AnimatedBusMarker position={busPosition} />

          <FitRouteBounds stops={route.stops} />
        </MapContainer>
      </div>
    </div>
  );
}