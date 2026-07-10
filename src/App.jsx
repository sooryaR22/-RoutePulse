import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import StartTrip from "./pages/StartTrip";
import JoinTrip from "./pages/JoinTrip";
import LiveTrip from "./pages/LiveTrip";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/start-trip" element={<StartTrip />} />
      <Route path="/join-trip" element={<JoinTrip />} />
      <Route path="/trip/:tripId" element={<LiveTrip />} />
    </Routes>
  );
}