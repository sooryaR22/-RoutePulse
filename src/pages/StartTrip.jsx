import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase";

import {
  DEFAULT_ROUTE_ID,
  getRouteById,
} from "../data/routes";

const CONDUCTOR_UID = "F4ypVGrCxNOdlQq4RlF6K7sTAp52";

export default function StartTrip() {
  const navigate = useNavigate();

  const [busNumber, setBusNumber] = useState("");
  const [routeName, setRouteName] = useState("");

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const checkConductorAccess = async () => {
      const user = auth.currentUser;

      if (!user || user.uid !== CONDUCTOR_UID) {
        navigate("/", {
          replace: true,
        });

        return;
      }

      try {
        const activeTripQuery = query(
          collection(db, "trips"),
          where("conductorId", "==", user.uid),
          where("status", "==", "active"),
          limit(1)
        );

        const snapshot = await getDocs(activeTripQuery);

        if (!snapshot.empty) {
          navigate(`/trip/${snapshot.docs[0].id}`, {
            replace: true,
          });

          return;
        }

        setCheckingAccess(false);
      } catch (checkError) {
        console.error(
          "Failed to check existing active trip:",
          checkError
        );

        setError("Could not check your active trips.");
        setCheckingAccess(false);
      }
    };

    checkConductorAccess();
  }, [navigate]);

  const handleStartTrip = async (event) => {
    event.preventDefault();

    setError("");

    const user = auth.currentUser;

    if (!user || user.uid !== CONDUCTOR_UID) {
      navigate("/", {
        replace: true,
      });

      return;
    }

    const cleanBusNumber = busNumber.trim();
    const cleanRouteName = routeName.trim();

    if (!cleanBusNumber || !cleanRouteName) {
      setError("Please enter the bus number and route name.");
      return;
    }

    const route = getRouteById(DEFAULT_ROUTE_ID);

    if (!route || route.stops.length === 0) {
      setError("Route configuration could not be loaded.");
      return;
    }

    const firstStop = route.stops[0];

    try {
      setLoading(true);

      const activeTripQuery = query(
        collection(db, "trips"),
        where("conductorId", "==", user.uid),
        where("status", "==", "active"),
        limit(1)
      );

      const existingTrips = await getDocs(activeTripQuery);

      if (!existingTrips.empty) {
        navigate(`/trip/${existingTrips.docs[0].id}`, {
          replace: true,
        });

        return;
      }

      const tripRef = await addDoc(collection(db, "trips"), {
        busNumber: cleanBusNumber,
        routeName: cleanRouteName,

        routeId: DEFAULT_ROUTE_ID,

        busLocation: {
          latitude: firstStop.latitude,
          longitude: firstStop.longitude,
          source: "initial",
        },

        locationUpdatedAt: serverTimestamp(),

        conductorId: user.uid,
        passengerCount: 0,
        status: "active",
        createdAt: serverTimestamp(),
      });

      navigate(`/trip/${tripRef.id}`, {
        replace: true,
      });
    } catch (startError) {
      console.error("Failed to start trip:", startError);
      setError("Could not start the trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        Checking conductor access...
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white px-6 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-250px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <form
          onSubmit={handleStartTrip}
          className="w-full rounded-3xl border border-white/10 bg-white/[0.045] p-8 shadow-[0_30px_100px_rgba(37,99,235,0.12)] backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-8 text-sm text-zinc-500 transition hover:text-white"
          >
            ← Back to Home
          </button>

          <p className="text-sm font-semibold text-blue-400">
            CONDUCTOR CONTROL
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Start a live trip
          </h1>

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Publish your bus to the RoutePulse network and begin receiving
            live passenger contributions.
          </p>

          <div className="mt-8">
            <label className="text-sm text-zinc-400">
              Bus number
            </label>

            <input
              type="text"
              placeholder="Example: TN 74 N 1234"
              value={busNumber}
              onChange={(event) => setBusNumber(event.target.value)}
              disabled={loading}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-zinc-700 focus:border-blue-500/60"
            />
          </div>

          <div className="mt-5">
            <label className="text-sm text-zinc-400">
              Route
            </label>

            <input
              type="text"
              placeholder="Example: Nagercoil → Kanyakumari"
              value={routeName}
              onChange={(event) => setRouteName(event.target.value)}
              disabled={loading}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-zinc-700 focus:border-blue-500/60"
            />
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-7 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 py-3.5 font-semibold shadow-[0_15px_45px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Starting Trip..." : "Start Live Trip"}
          </button>
        </form>
      </div>
    </main>
  );
}