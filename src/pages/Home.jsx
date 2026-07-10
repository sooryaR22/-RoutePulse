import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";

const CONDUCTOR_UID = "F4ypVGrCxNOdlQq4RlF6K7sTAp52";

export default function Home() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("AUTH STATE CHANGED:", user);

      setCurrentUser(user);
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const isConductor =
    currentUser?.uid === CONDUCTOR_UID;

  console.log("CURRENT USER:", currentUser);
  console.log("CURRENT UID:", currentUser?.uid);
  console.log("EXPECTED CONDUCTOR UID:", CONDUCTOR_UID);
  console.log("IS CONDUCTOR:", isConductor);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[140px]" />

        <div className="absolute bottom-[-250px] right-[-150px] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 shadow-[0_0_25px_rgba(59,130,246,0.15)]">
            <span className="text-lg font-bold text-blue-400">
              R
            </span>
          </div>

          <div className="text-left">
            <p className="text-lg font-bold tracking-tight">
              RoutePulse
            </p>

            <p className="text-xs text-zinc-500">
              Live transit intelligence
            </p>
          </div>
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-400 sm:flex">
          <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />

          Network online
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-6 pb-16 pt-16 text-center lg:px-10 lg:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300"
        >
          Real-time crowd intelligence for public transport
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="max-w-4xl text-5xl font-black leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
        >
          Know the crowd.

          <span className="block gradientText">
            Choose the smarter ride.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-7 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg"
        >
          RoutePulse turns passenger contributions into live transit
          visibility, helping commuters discover active buses and make
          better travel decisions.
        </motion.p>

        {/* Loading auth */}
        {checkingAuth && (
          <div className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-6 py-5 text-sm text-zinc-500">
            Checking authentication...
          </div>
        )}

        {/* Main actions */}
        {!checkingAuth && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className={`mt-10 grid w-full gap-4 ${
              isConductor
                ? "max-w-3xl md:grid-cols-2"
                : "max-w-xl"
            }`}
          >
            {/* Passenger card */}
            <button
              onClick={() => navigate("/join-trip")}
              className="group rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-left shadow-[0_20px_70px_rgba(37,99,235,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_25px_90px_rgba(37,99,235,0.32)]"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold text-blue-100/70">
                    PASSENGER
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    Find an active bus
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-blue-100/70">
                    Explore live trips, view crowd levels, and contribute
                    your presence.
                  </p>
                </div>

                <span className="text-2xl transition group-hover:translate-x-1">
                  →
                </span>
              </div>
            </button>

            {/* Conductor card */}
            {isConductor && (
              <button
                onClick={() => navigate("/start-trip")}
                className="group rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-sm font-semibold text-zinc-500">
                      CONDUCTOR
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      Start a live trip
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      Publish your bus to the RoutePulse network and
                      monitor passenger activity live.
                    </p>
                  </div>

                  <span className="text-2xl text-zinc-500 transition group-hover:translate-x-1 group-hover:text-white">
                    →
                  </span>
                </div>
              </button>
            )}
          </motion.div>
        )}

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 grid w-full max-w-5xl gap-4 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left">
            <p className="text-sm text-zinc-500">
              LIVE DISCOVERY
            </p>

            <p className="mt-2 font-semibold">
              Active buses appear instantly
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left">
            <p className="text-sm text-zinc-500">
              REAL-TIME SYNC
            </p>

            <p className="mt-2 font-semibold">
              Crowd data updates across devices
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left">
            <p className="text-sm text-zinc-500">
              UNIQUE CONTRIBUTION
            </p>

            <p className="mt-2 font-semibold">
              One passenger, one contribution
            </p>
          </div>
        </motion.div>
      </section>
    </main>
  );
}