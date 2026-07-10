import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase";

function getCrowdLevel(count) {
  if (count <= 5) {
    return {
      label: "Low crowd",
      classes:
        "border-green-500/20 bg-green-500/10 text-green-400",
    };
  }

  if (count <= 15) {
    return {
      label: "Moderate crowd",
      classes:
        "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
    };
  }

  return {
    label: "High crowd",
    classes:
      "border-red-500/20 bg-red-500/10 text-red-400",
  };
}

function ActiveTripCard({ trip, onJoin, index }) {
  const [passengerCount, setPassengerCount] = useState(0);

  useEffect(() => {
    const participantsRef = collection(
      db,
      "trips",
      trip.id,
      "participants"
    );

    const unsubscribe = onSnapshot(
      participantsRef,
      (snapshot) => {
        setPassengerCount(snapshot.size);
      },
      (error) => {
        console.error(
          `Failed to load passenger count for trip ${trip.id}:`,
          error
        );
      }
    );

    return () => unsubscribe();
  }, [trip.id]);

  const crowdLevel = getCrowdLevel(passengerCount);

  return (
    <motion.button
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
      }}
      onClick={() => onJoin(trip.id)}
      className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-blue-400/20 hover:bg-white/[0.055] hover:shadow-[0_25px_80px_rgba(37,99,235,0.13)]"
    >
      <div className="pointer-events-none absolute right-[-80px] top-[-80px] h-40 w-40 rounded-full bg-blue-600/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
            LIVE
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${crowdLevel.classes}`}
          >
            {crowdLevel.label}
          </span>
        </div>

        <div className="mt-7">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
            Bus
          </p>

          <h2 className="mt-1 text-3xl font-bold tracking-tight">
            {trip.busNumber}
          </h2>
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
            Route
          </p>

          <p className="mt-1 text-zinc-400">
            {trip.routeName}
          </p>
        </div>

        <div className="mt-8 flex items-end justify-between gap-5 border-t border-white/[0.07] pt-5">
          <div>
            <p className="text-xs text-zinc-600">
              LIVE PASSENGERS
            </p>

            <p className="mt-1 text-2xl font-bold">
              {passengerCount}
            </p>
          </div>

          <span className="text-sm font-semibold text-blue-400 transition group-hover:translate-x-1">
            View trip →
          </span>
        </div>
      </div>
    </motion.button>
  );
}

export default function JoinTrip() {
  const navigate = useNavigate();

  const [tripId, setTripId] = useState("");
  const [activeTrips, setActiveTrips] = useState([]);

  const [loadingTrips, setLoadingTrips] = useState(true);
  const [joining, setJoining] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const activeTripsQuery = query(
      collection(db, "trips"),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(
      activeTripsQuery,
      (snapshot) => {
        const trips = snapshot.docs.map((tripDocument) => ({
          id: tripDocument.id,
          ...tripDocument.data(),
        }));

        setActiveTrips(trips);
        setLoadingTrips(false);
      },
      (snapshotError) => {
        console.error(
          "Failed to load active trips:",
          snapshotError
        );

        setError("Could not load active trips.");
        setLoadingTrips(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const joinTrip = (selectedTripId) => {
    navigate(`/trip/${selectedTripId}?role=passenger`);
  };

  const handleManualJoin = async (event) => {
    event.preventDefault();

    setError("");

    const cleanTripId = tripId.trim();

    if (!cleanTripId) {
      setError("Please enter a Trip ID.");
      return;
    }

    try {
      setJoining(true);

      const tripRef = doc(db, "trips", cleanTripId);
      const tripSnapshot = await getDoc(tripRef);

      if (!tripSnapshot.exists()) {
        setError("Trip not found.");
        return;
      }

      if (tripSnapshot.data().status !== "active") {
        setError("This trip has already ended.");
        return;
      }

      joinTrip(cleanTripId);
    } catch (joinError) {
      console.error("Failed to join trip:", joinError);
      setError("Could not join the trip. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white px-6 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-zinc-500 transition hover:text-white"
        >
          ← Back to Home
        </button>

        <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-400">
              ROUTEPULSE NETWORK
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Active buses
            </h1>

            <p className="mt-4 max-w-xl leading-7 text-zinc-400">
              Discover live trips, check crowd conditions, and contribute
              your presence to help other passengers travel smarter.
            </p>
          </div>

          {!loadingTrips && (
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-400">
              {activeTrips.length}{" "}
              {activeTrips.length === 1
                ? "active trip"
                : "active trips"}
            </div>
          )}
        </div>

        <section className="mt-10">
          {loadingTrips ? (
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-10 text-zinc-400">
              Loading active buses...
            </div>
          ) : activeTrips.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
                ↗
              </div>

              <h2 className="mt-5 text-xl font-semibold">
                No active buses right now
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Active trips will appear here automatically when an
                authorized conductor starts a journey.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {activeTrips.map((trip, index) => (
                <ActiveTripCard
                  key={trip.id}
                  trip={trip}
                  index={index}
                  onJoin={joinTrip}
                />
              ))}
            </div>
          )}
        </section>

        <div className="my-12 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/[0.07]" />

          <span className="text-xs font-medium tracking-[0.16em] text-zinc-600">
            JOIN WITH TRIP ID
          </span>

          <div className="h-px flex-1 bg-white/[0.07]" />
        </div>

        <form
          onSubmit={handleManualJoin}
          className="max-w-xl rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur-xl"
        >
          <p className="font-semibold">
            Have a Trip ID?
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Enter it below to open a specific active trip.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Enter Trip ID"
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
              disabled={joining}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-zinc-700 focus:border-blue-500/60"
            />

            <button
              type="submit"
              disabled={joining}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joining ? "Checking..." : "Join Trip"}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}