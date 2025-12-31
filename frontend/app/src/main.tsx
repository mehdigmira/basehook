import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router";
import { Nav } from "../app/components/nav";
import Home from "../app/routes/home";
import Webhooks from "../app/routes/webhooks";
import Metrics from "../app/routes/metrics";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <NuqsAdapter>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/metrics" element={<Metrics />} />
        </Routes>
      </NuqsAdapter>
    </BrowserRouter>
  </React.StrictMode>
);
