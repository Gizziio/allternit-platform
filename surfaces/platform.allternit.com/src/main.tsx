import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PlatformAuthProvider } from "@/lib/platform-auth-client";
import { initializeTheme } from "@/lib/theme";
import App from "@/App";
import "@/styles/global.css";

initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PlatformAuthProvider>
        <App />
      </PlatformAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
