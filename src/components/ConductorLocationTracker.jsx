import { useEffect } from "react";

import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase";

const LOCATION_UPDATE_INTERVAL_MS = 5000;

export default function ConductorLocationTracker({
  tripId,
  enabled,
}) {
  useEffect(() => {
    if (!enabled || !tripId) {
      return undefined;
    }

    if (!navigator.geolocation) {
      console.error(
        "Geolocation is not supported by this browser."
      );

      return undefined;
    }

    let lastUpdateTime = 0;

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

      try {
        await updateDoc(doc(db, "trips", tripId), {
          busLocation: {
            latitude,
            longitude,
            accuracy,
            source: "conductor-gps",
          },

          locationUpdatedAt: serverTimestamp(),
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
  }, [enabled, tripId]);

  return null;
}