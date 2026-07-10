import { useEffect } from "react";

import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase";
import { getRouteById } from "../data/routes";

const LOCATION_UPDATE_INTERVAL_MS = 5000;
const EARTH_RADIUS_METERS = 6371000;

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function getDistanceMeters(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const latitudeDifference = degreesToRadians(
    latitude2 - latitude1
  );

  const longitudeDifference = degreesToRadians(
    longitude2 - longitude1
  );

  const firstLatitude = degreesToRadians(latitude1);
  const secondLatitude = degreesToRadians(latitude2);

  const haversineValue =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(haversineValue),
      Math.sqrt(1 - haversineValue)
    );

  return EARTH_RADIUS_METERS * angularDistance;
}

function findStopInsideGeofence(route, latitude, longitude) {
  let nearestStop = null;

  for (const stop of route.stops) {
    const distanceMeters = getDistanceMeters(
      latitude,
      longitude,
      stop.latitude,
      stop.longitude
    );

    if (distanceMeters <= route.arrivalRadiusMeters) {
      if (
        !nearestStop ||
        distanceMeters < nearestStop.distanceMeters
      ) {
        nearestStop = {
          id: stop.id,
          name: stop.name,
          distanceMeters,
        };
      }
    }
  }

  return nearestStop;
}

export default function ConductorLocationTracker({
  tripId,
  routeId,
  enabled,
}) {
  useEffect(() => {
    if (!enabled || !tripId || !routeId) {
      return undefined;
    }

    if (!navigator.geolocation) {
      console.error(
        "Geolocation is not supported by this browser."
      );

      return undefined;
    }

    const route = getRouteById(routeId);

    if (!route || route.stops.length === 0) {
      console.error(
        "Could not start conductor tracking because route data was not found."
      );

      return undefined;
    }

    let lastUpdateTime = 0;
    let lastDetectedStopId = null;

    const handlePosition = async (position) => {
      const now = Date.now();

      if (
        now - lastUpdateTime <
        LOCATION_UPDATE_INTERVAL_MS
      ) {
        return;
      }

      lastUpdateTime = now;

      const { latitude, longitude, accuracy } =
        position.coords;

      const detectedStop = findStopInsideGeofence(
        route,
        latitude,
        longitude
      );

      if (detectedStop?.id !== lastDetectedStopId) {
        if (detectedStop) {
          console.log(
            `Bus entered stop geofence: ${detectedStop.name}`
          );
        } else if (lastDetectedStopId) {
          console.log("Bus left the current stop geofence.");
        }

        lastDetectedStopId = detectedStop?.id || null;
      }

      try {
        await updateDoc(doc(db, "trips", tripId), {
          busLocation: {
            latitude,
            longitude,
            accuracy,
            source: "conductor-gps",
          },

          locationUpdatedAt: serverTimestamp(),

          currentStopId: detectedStop?.id || null,

          currentStopName: detectedStop?.name || null,

          currentStopDistanceMeters: detectedStop
            ? Math.round(detectedStop.distanceMeters)
            : null,
        });
      } catch (locationUpdateError) {
        console.error(
          "Failed to update conductor location:",
          locationUpdateError
        );
      }
    };

    const handlePositionError = (positionError) => {
      console.error(
        "Conductor geolocation failed:",
        positionError
      );
    };

    const watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handlePositionError,
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, tripId, routeId]);

  return null;
}