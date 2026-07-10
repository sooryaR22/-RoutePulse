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

const FALLBACK_BUS_SPEED_KMH = 25;
const MINIMUM_USABLE_SPEED_KMH = 5;
const MAXIMUM_USABLE_SPEED_KMH = 100;

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
    latitude: nextStop.latitude,
    longitude: nextStop.longitude,
  };
}

function getUsableSpeedKmh(speedMetersPerSecond) {
  if (!Number.isFinite(speedMetersPerSecond)) {
    return FALLBACK_BUS_SPEED_KMH;
  }

  const speedKmh = speedMetersPerSecond * 3.6;

  if (
    speedKmh < MINIMUM_USABLE_SPEED_KMH ||
    speedKmh > MAXIMUM_USABLE_SPEED_KMH
  ) {
    return FALLBACK_BUS_SPEED_KMH;
  }

  return speedKmh;
}

function calculateEtaMinutes(distanceMeters, speedKmh) {
  if (
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(speedKmh) ||
    speedKmh <= 0
  ) {
    return null;
  }

  const distanceKilometers = distanceMeters / 1000;
  const travelHours = distanceKilometers / speedKmh;
  const travelMinutes = travelHours * 60;

  return Math.max(1, Math.ceil(travelMinutes));
}

function getNextStopEtaData({
  route,
  nextStopIndex,
  latitude,
  longitude,
  speedMetersPerSecond,
}) {
  if (
    !Number.isInteger(nextStopIndex) ||
    nextStopIndex < 0 ||
    nextStopIndex >= route.stops.length
  ) {
    return {
      nextStopDistanceMeters: null,
      etaMinutes: null,
      estimatedSpeedKmh: null,
    };
  }

  const nextStop = route.stops[nextStopIndex];

  const distanceMeters = getDistanceMeters(
    latitude,
    longitude,
    nextStop.latitude,
    nextStop.longitude
  );

  const speedKmh = getUsableSpeedKmh(
    speedMetersPerSecond
  );

  return {
    nextStopDistanceMeters: Math.round(distanceMeters),
    etaMinutes: calculateEtaMinutes(
      distanceMeters,
      speedKmh
    ),
    estimatedSpeedKmh: Math.round(speedKmh),
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

      ...(routeCompleted
        ? {
            nextStopDistanceMeters: null,
            etaMinutes: null,
            estimatedSpeedKmh: null,
          }
        : {}),
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

      const {
        latitude,
        longitude,
        accuracy,
        speed,
      } = position.coords;

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
        /*
         * Record the arrival first.
         *
         * This updates nextStopIndex before we calculate ETA.
         */
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

        /*
         * Read the current trip so ETA uses the latest nextStopIndex.
         */
        const tripRef = doc(db, "trips", tripId);

        const etaData = await runTransaction(
          db,
          async (transaction) => {
            const tripSnapshot =
              await transaction.get(tripRef);

            if (!tripSnapshot.exists()) {
              throw new Error("Trip does not exist.");
            }

            const tripData = tripSnapshot.data();

            return getNextStopEtaData({
              route,
              nextStopIndex: tripData.nextStopIndex,
              latitude,
              longitude,
              speedMetersPerSecond: speed,
            });
          }
        );

        await updateDoc(tripRef, {
          busLocation: {
            latitude,
            longitude,
            accuracy,
            speedMetersPerSecond:
              Number.isFinite(speed) ? speed : null,
            source: "conductor-gps",
          },

          locationUpdatedAt: serverTimestamp(),

          currentStopId: detectedStop?.id || null,

          currentStopName: detectedStop?.name || null,

          currentStopDistanceMeters: detectedStop
            ? Math.round(detectedStop.distanceMeters)
            : null,

          nextStopDistanceMeters:
            etaData.nextStopDistanceMeters,

          etaMinutes: etaData.etaMinutes,

          estimatedSpeedKmh:
            etaData.estimatedSpeedKmh,
        });
      } catch (locationUpdateError) {
        console.error(
          "Failed to update conductor location, ETA, or record arrival:",
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