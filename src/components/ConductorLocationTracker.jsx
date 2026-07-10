import { useEffect } from "react";

import {
  doc,
  runTransaction,
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

function findStopInsideGeofence(
  route,
  latitude,
  longitude
) {
  let nearestStop = null;

  route.stops.forEach((stop, index) => {
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
          index,
          distanceMeters,
        };
      }
    }
  });

  return nearestStop;
}

function getNextStop(route, currentStopIndex) {
  const nextStopIndex = currentStopIndex + 1;

  if (nextStopIndex >= route.stops.length) {
    return null;
  }

  const nextStop = route.stops[nextStopIndex];

  return {
    id: nextStop.id,
    name: nextStop.name,
    index: nextStopIndex,
  };
}

async function recordStopArrival({
  tripId,
  routeId,
  route,
  detectedStop,
}) {
  const tripRef = doc(db, "trips", tripId);

  const arrivalRef = doc(
    db,
    "trips",
    tripId,
    "arrivals",
    detectedStop.id
  );

  await runTransaction(db, async (transaction) => {
    const tripSnapshot = await transaction.get(tripRef);

    if (!tripSnapshot.exists()) {
      throw new Error("Trip does not exist.");
    }

    const tripData = tripSnapshot.data();

    if (tripData.status !== "active") {
      throw new Error("Trip is not active.");
    }

    const arrivalSnapshot =
      await transaction.get(arrivalRef);

    if (arrivalSnapshot.exists()) {
      return;
    }

    const nextStop = getNextStop(
      route,
      detectedStop.index
    );

    const routeCompleted = nextStop === null;

    transaction.set(arrivalRef, {
      stopId: detectedStop.id,
      stopName: detectedStop.name,
      stopIndex: detectedStop.index,
      routeId,
      arrivedAt: serverTimestamp(),
    });

    transaction.update(tripRef, {
      lastArrivedStopId: detectedStop.id,
      lastArrivedStopName: detectedStop.name,
      lastArrivedStopIndex: detectedStop.index,
      lastArrivedAt: serverTimestamp(),

      nextStopId: nextStop?.id || null,
      nextStopName: nextStop?.name || null,
      nextStopIndex: nextStop?.index ?? null,

      routeCompleted,
    });
  });
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

      const enteredNewStop =
        detectedStop &&
        detectedStop.id !== lastDetectedStopId;

      if (detectedStop?.id !== lastDetectedStopId) {
        if (detectedStop) {
          console.log(
            `Bus entered stop geofence: ${detectedStop.name}`
          );
        } else if (lastDetectedStopId) {
          console.log(
            "Bus left the current stop geofence."
          );
        }
      }

      lastDetectedStopId = detectedStop?.id || null;

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

        if (enteredNewStop) {
          await recordStopArrival({
            tripId,
            routeId,
            route,
            detectedStop,
          });

          console.log(
            `Recorded stop arrival: ${detectedStop.name}`
          );
        }
      } catch (locationUpdateError) {
        console.error(
          "Failed to update conductor location or record arrival:",
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