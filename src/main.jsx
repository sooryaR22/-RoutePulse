import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import {
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";

import "leaflet/dist/leaflet.css";
import "./index.css";

import App from "./App";
import { auth } from "./firebase";

const root = createRoot(document.getElementById("root"));

let appStarted = false;

function startApp() {
  if (appStarted) {
    return;
  }

  appStarted = true;

  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    startApp();
    return;
  }

  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error("Anonymous sign-in failed:", error);

    root.render(
      <div
        style={{
          minHeight: "100vh",
          background: "#000",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        Could not connect to RoutePulse.
      </div>
    );
  }
});