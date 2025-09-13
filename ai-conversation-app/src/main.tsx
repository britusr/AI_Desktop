import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import SidePanelPage from "./pages/SidePanelPage";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/sidepanel" element={<SidePanelPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
