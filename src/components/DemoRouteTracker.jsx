import { useEffect } from "react";

import {
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase";
import { getRouteById } from "../data/routes";

const MOVEMENT_UPDATE_MS = 500;
const STEPS_BETWEEN_STOPS = 8;

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getIntermediatePosition(
  startStop,
  endStop,
  progress
) {
  return {
    latitude:
      startStop.latitude +
      (endStop.latitude - startStop.latitude) * progress,

    longitude:
      startStop.longitude +
      (endStop.longitude - startStop.longitude) * progress,
  };
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

async function updateDemoLocation(tripId, position) {
  await updateDoc(doc(db, "trips", tripId), {
    busLocation: {
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: 0,
      source: "demo",
    },

    locationUpdatedAt: serverTimestamp(),

    currentStopId: null,
    currentStopName: null,
    currentStopDistanceMeters: null,
  });
}

async function recordDemoArrival({
  tripId,
  routeId,
  route,
  stop,
  stopIndex,
}) {
  const tripRef = doc(db, "trips", tripId);

  const arrivalRef = doc(
    db,
    "trips",
    tripId,
    "arrivals",
    stop.id
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

    const nextStop = getNextStop(route, stopIndex);
    const routeCompleted = nextStop === null;

    if (!arrivalSnapshot.exists()) {
      transaction.set(arrivalRef, {
        stopId: stop.id,
        stopName: stop.name,
        stopIndex,
        routeId,
        source: "demo",
        arrivedAt: serverTimestamp(),
      });
    }

    transaction.update(tripRef, {
      busLocation: {
        latitude: stop.latitude,
        longitude: stop.longitude,
        accuracy: 0,
        source: "demo",
      },

      locationUpdatedAt: serverTimestamp(),

      currentStopId: stop.id,
      currentStopName: stop.name,
      currentStopDistanceMeters: 0,

      lastArrivedStopId: stop.id,
      lastArrivedStopName: stop.name,
      lastArrivedStopIndex: stopIndex,
      lastArrivedAt: serverTimestamp(),

      nextStopId: nextStop?.id || null,
      nextStopName: nextStop?.name || null,
      nextStopIndex: nextStop?.index ?? null,

      routeCompleted,
    });
  });
}

export default function DemoRouteTracker({
  tripId,
  routeId,
  enabled,
  onComplete,
}) {
  useEffect(() => {
    if (!enabled || !tripId || !routeId) {
      return undefined;
    }

    const route = getRouteById(routeId);

    if (!route || route.stops.length === 0) {
      console.error(
        "Could not start demo route because route data was not found."
      );

      return undefined;
    }

    let cancelled = false;

    const runDemoRoute = async () => {
      try {
        const firstStop = route.stops[0];

        await recordDemoArrival({
          tripId,
          routeId,
          route,
          stop: firstStop,
          stopIndex: 0,
        });

        console.log(
          `Demo bus arrived at: ${firstStop.name}`
        );

        await wait(route.demoSpeedMs);

        for (
          let stopIndex = 1;
          stopIndex < route.stops.length;
          stopIndex += 1
        ) {
          if (cancelled) {
            return;
          }

          const previousStop =
            route.stops[stopIndex - 1];

          const nextStop =
            route.stops[stopIndex];

          for (
            let movementStep = 1;
            movementStep <= STEPS_BETWEEN_STOPS;
            movementStep += 1
          ) {
            if (cancelled) {
              return;
            }

            const progress =
              movementStep / STEPS_BETWEEN_STOPS;

            const intermediatePosition =
              getIntermediatePosition(
                previousStop,
                nextStop,
                progress
              );

            await updateDemoLocation(
              tripId,
              intermediatePosition
            );

            await wait(MOVEMENT_UPDATE_MS);
          }

          if (cancelled) {
            return;
          }

          await recordDemoArrival({
            tripId,
            routeId,
            route,
            stop: nextStop,
            stopIndex,
          });

          console.log(
            `Demo bus arrived at: ${nextStop.name}`
          );

          await wait(route.demoSpeedMs);
        }

        if (!cancelled && onComplete) {
          onComplete();
        }
      } catch (demoError) {
        console.error(
          "Demo route movement failed:",
          demoError
        );
      }
    };

    runDemoRoute();

    return () => {
      cancelled = true;
    };
  }, [enabled, tripId, routeId, onComplete]);

  return null;
}