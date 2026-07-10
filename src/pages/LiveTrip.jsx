import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase";
import RouteMap from "../components/RouteMap";
import ConductorLocationTracker from "../components/ConductorLocationTracker";
import DemoRouteTracker from "../components/DemoRouteTracker";
import { DEFAULT_ROUTE_ID } from "../data/routes";

function getCrowdLevel(count) {
  if (count <= 5) {
    return {
      label: "Low crowd",
      description: "Plenty of space available",
      classes:
        "border-green-500/20 bg-green-500/10 text-green-400",
    };
  }

  if (count <= 15) {
    return {
      label: "Moderate crowd",
      description: "Bus is getting busier",
      classes:
        "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
    };
  }

  return {
    label: "High crowd",
    description: "Consider another bus if available",
    classes:
      "border-red-500/20 bg-red-500/10 text-red-400",
  };
}

export default function LiveTrip() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);

  const [loading, setLoading] = useState(true);

  const [
    checkingContribution,
    setCheckingContribution,
  ] = useState(true);

  const [hasContributed, setHasContributed] = useState(false);

  const [contributing, setContributing] = useState(false);
  const [leavingBus, setLeavingBus] = useState(false);
  const [endingTrip, setEndingTrip] = useState(false);
  const [copied, setCopied] = useState(false);

  const [demoRunning, setDemoRunning] = useState(false);
  const [demoCompleted, setDemoCompleted] = useState(false);

  const [error, setError] = useState("");

  const currentUser = auth.currentUser;

  // Listen to the trip document.
  useEffect(() => {
    const tripRef = doc(db, "trips", tripId);

    const unsubscribe = onSnapshot(
      tripRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setTrip(null);
          setError("Trip not found.");
          setLoading(false);
          return;
        }

        setTrip({
          id: snapshot.id,
          ...snapshot.data(),
        });

        setLoading(false);
      },
      (snapshotError) => {
        console.error(
          "Live trip listener failed:",
          snapshotError
        );

        setError("Could not load live trip.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  // Listen to all participants for live passenger count.
  useEffect(() => {
    const participantsRef = collection(
      db,
      "trips",
      tripId,
      "participants"
    );

    const unsubscribe = onSnapshot(
      participantsRef,
      (snapshot) => {
        setParticipantCount(snapshot.size);
      },
      (participantCountError) => {
        console.error(
          "Participant count listener failed:",
          participantCountError
        );

        setError("Could not load the live passenger count.");
      }
    );

    return () => unsubscribe();
  }, [tripId]);

  // Listen to current passenger's participant document.
  useEffect(() => {
    if (!currentUser) {
      setCheckingContribution(false);
      return;
    }

    const participantRef = doc(
      db,
      "trips",
      tripId,
      "participants",
      currentUser.uid
    );

    const unsubscribe = onSnapshot(
      participantRef,
      (snapshot) => {
        setHasContributed(snapshot.exists());
        setCheckingContribution(false);
      },
      (participantError) => {
        console.error(
          "Participant listener failed:",
          participantError
        );

        setError("Could not check participation status.");
        setCheckingContribution(false);
      }
    );

    return () => unsubscribe();
  }, [tripId, currentUser]);

  const handleContribute = async () => {
    if (contributing || hasContributed || leavingBus) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setError("You must be signed in to contribute.");
      return;
    }

    if (!trip || trip.status !== "active") {
      setError("This trip is not active.");
      return;
    }

    if (user.uid === trip.conductorId) {
      setError("The conductor cannot contribute as a passenger.");
      return;
    }

    try {
      setContributing(true);
      setError("");

      const tripRef = doc(db, "trips", tripId);

      const participantRef = doc(
        db,
        "trips",
        tripId,
        "participants",
        user.uid
      );

      await runTransaction(db, async (transaction) => {
        const tripSnapshot = await transaction.get(tripRef);

        if (!tripSnapshot.exists()) {
          throw new Error("Trip does not exist.");
        }

        if (tripSnapshot.data().status !== "active") {
          throw new Error("Trip is not active.");
        }

        const participantSnapshot =
          await transaction.get(participantRef);

        if (participantSnapshot.exists()) {
          throw new Error("Passenger already contributed.");
        }

        transaction.set(participantRef, {
          userId: user.uid,
          joinedAt: serverTimestamp(),
        });
      });
    } catch (contributionError) {
      console.error(
        "Passenger contribution failed:",
        contributionError
      );

      if (
        contributionError.message ===
        "Passenger already contributed."
      ) {
        setHasContributed(true);
        setError("You have already contributed to this trip.");
      } else {
        setError("Could not contribute to the passenger count.");
      }
    } finally {
      setContributing(false);
    }
  };

  const handleStopContributing = async () => {
    if (!hasContributed || leavingBus || contributing) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setError("You must be signed in to stop contributing.");
      return;
    }

    if (!trip || trip.status !== "active") {
      setError("This trip is no longer active.");
      return;
    }

    try {
      setLeavingBus(true);
      setError("");

      const participantRef = doc(
        db,
        "trips",
        tripId,
        "participants",
        user.uid
      );

      await deleteDoc(participantRef);
    } catch (leaveError) {
      console.error(
        "Failed to stop contributing:",
        leaveError
      );

      setError("Could not stop contributing. Please try again.");
    } finally {
      setLeavingBus(false);
    }
  };

  const handleStartDemo = () => {
    if (demoRunning) {
      return;
    }

    if (!trip || trip.status !== "active") {
      setError("This trip is not active.");
      return;
    }

    const user = auth.currentUser;

    if (!user || user.uid !== trip.conductorId) {
      setError("Only the conductor can start demo mode.");
      return;
    }

    setError("");
    setDemoCompleted(false);
    setDemoRunning(true);
  };

  const handleDemoComplete = useCallback(() => {
    setDemoRunning(false);
    setDemoCompleted(true);
  }, []);

  const handleEndTrip = async () => {
    if (!trip || trip.status !== "active" || endingTrip) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setError("You must be signed in to end this trip.");
      return;
    }

    if (user.uid !== trip.conductorId) {
      setError("Only the conductor who started this trip can end it.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to end this trip?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setEndingTrip(true);
      setDemoRunning(false);
      setError("");

      await updateDoc(doc(db, "trips", tripId), {
        status: "ended",
        endedAt: serverTimestamp(),
      });
    } catch (endTripError) {
      console.error("Failed to end trip:", endTripError);

      setError("Could not end the trip. Please try again.");
    } finally {
      setEndingTrip(false);
    }
  };

  const handleCopyTripId = async () => {
    try {
      await navigator.clipboard.writeText(tripId);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (copyError) {
      console.error("Could not copy Trip ID:", copyError);

      setError("Could not copy the Trip ID.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        Loading live trip...
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col gap-4 items-center justify-center px-6 text-center">
        <p>{error || "Trip not found."}</p>

        <button
          onClick={() => navigate("/")}
          className="text-blue-400 hover:text-blue-300"
        >
          Return Home
        </button>
      </div>
    );
  }

  const isConductor =
    currentUser &&
    currentUser.uid === trip.conductorId;

  const tripIsActive = trip.status === "active";

  const routeId = trip.routeId || DEFAULT_ROUTE_ID;

  const crowdLevel = getCrowdLevel(participantCount);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white px-6 py-8 sm:py-12">
      <ConductorLocationTracker
        tripId={tripId}
        routeId={routeId}
        enabled={Boolean(
          isConductor &&
            tripIsActive &&
            !demoRunning
        )}
      />

      <DemoRouteTracker
        tripId={tripId}
        routeId={routeId}
        enabled={Boolean(
          isConductor &&
            tripIsActive &&
            demoRunning
        )}
        onComplete={handleDemoComplete}
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[650px] w-[850px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[160px]" />

        <div className="absolute bottom-[-300px] right-[-200px] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <button
          onClick={() =>
            navigate(isConductor ? "/" : "/join-trip")
          }
          className="text-sm text-zinc-500 transition hover:text-white"
        >
          ← {isConductor ? "Back to Home" : "Back to Active Buses"}
        </button>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mt-10 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.035] shadow-[0_30px_120px_rgba(37,99,235,0.10)] backdrop-blur-xl"
        >
          <div className="border-b border-white/[0.07] px-6 py-6 sm:px-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      tripIsActive
                        ? "border-green-500/20 bg-green-500/10 text-green-400"
                        : "border-red-500/20 bg-red-500/10 text-red-400"
                    }`}
                  >
                    {tripIsActive ? "● LIVE TRIP" : "TRIP ENDED"}
                  </span>

                  <span className="text-xs font-medium tracking-[0.15em] text-zinc-600">
                    {isConductor
                      ? "CONDUCTOR DASHBOARD"
                      : "PASSENGER VIEW"}
                  </span>

                  {demoRunning && (
                    <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
                      ● DEMO RUNNING
                    </span>
                  )}

                  {demoCompleted && !demoRunning && (
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
                      DEMO COMPLETED
                    </span>
                  )}
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                  {trip.busNumber}
                </h1>

                <p className="mt-3 text-zinc-400">
                  {trip.routeName}
                </p>
              </div>

              <div
                className={`w-fit rounded-2xl border px-5 py-4 ${crowdLevel.classes}`}
              >
                <p className="text-xs font-semibold tracking-[0.12em]">
                  CROWD STATUS
                </p>

                <p className="mt-1 text-lg font-bold">
                  {crowdLevel.label}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-9 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/[0.07] bg-black/20 p-7 sm:p-9">
              <p className="text-sm font-medium text-zinc-500">
                LIVE PASSENGER COUNT
              </p>

              <div className="mt-4 flex items-end gap-4">
                <p className="gradientText text-7xl font-black tracking-[-0.05em] sm:text-8xl">
                  {participantCount}
                </p>

                <p className="mb-3 text-sm text-zinc-600">
                  contributing
                </p>
              </div>

              <p className="mt-5 text-sm text-zinc-500">
                {crowdLevel.description}
              </p>

              <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      (participantCount / 25) * 100,
                      100
                    )}%`,
                  }}
                  transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${
                    participantCount <= 5
                      ? "bg-green-500"
                      : participantCount <= 15
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs text-zinc-700">
                <span>Low</span>
                <span>Moderate</span>
                <span>High</span>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-white/[0.07] bg-black/20 p-7">
              <p className="text-sm font-medium text-zinc-500">
                TRIP ID
              </p>

              <p className="mt-4 break-all font-mono text-sm leading-6 text-blue-400">
                {tripId}
              </p>

              <button
                onClick={handleCopyTripId}
                className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold transition hover:bg-white/[0.08]"
              >
                {copied ? "Copied ✓" : "Copy Trip ID"}
              </button>

              <div className="mt-6 border-t border-white/[0.07] pt-6">
                <p className="text-xs leading-5 text-zinc-600">
                  Share this Trip ID with passengers so they can open
                  this live trip directly.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.07] px-6 py-6 sm:px-9">
            {!isConductor && tripIsActive && (
              <>
                {!hasContributed ? (
                  <button
                    onClick={handleContribute}
                    disabled={
                      checkingContribution ||
                      contributing ||
                      leavingBus
                    }
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 py-4 font-semibold shadow-[0_15px_50px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkingContribution
                      ? "Checking contribution..."
                      : contributing
                      ? "Adding contribution..."
                      : "I'm On This Bus"}
                  </button>
                ) : (
                  <div>
                    <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-center text-sm text-green-400">
                      ✓ You are contributing to this live trip
                    </div>

                    <button
                      onClick={handleStopContributing}
                      disabled={leavingBus || contributing}
                      className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-4 font-semibold text-red-400 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {leavingBus
                        ? "Stopping Contribution..."
                        : "Stop Contributing"}
                    </button>
                  </div>
                )}
              </>
            )}

            {isConductor && tripIsActive && (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={handleStartDemo}
                  disabled={demoRunning || endingTrip}
                  className="w-full rounded-xl border border-purple-500/20 bg-purple-500/10 py-4 font-semibold text-purple-400 transition hover:bg-purple-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {demoRunning
                    ? "Demo Route Running..."
                    : demoCompleted
                    ? "Run Demo Route Again"
                    : "Start Demo Route"}
                </button>

                <button
                  onClick={handleEndTrip}
                  disabled={endingTrip || demoRunning}
                  className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-4 font-semibold text-red-400 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {endingTrip ? "Ending Trip..." : "End Live Trip"}
                </button>
              </div>
            )}

            {!tripIsActive && (
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-xl bg-white/[0.06] py-4 font-semibold transition hover:bg-white/[0.09]"
              >
                Return Home
              </button>
            )}

            {error && (
              <p className="mt-4 text-center text-sm text-red-400">
                {error}
              </p>
            )}
          </div>
        </motion.section>

        <section className="mt-6">
          <RouteMap
            routeId={routeId}
            busLocation={trip.busLocation}
          />
        </section>
      </div>
    </main>
  );
}