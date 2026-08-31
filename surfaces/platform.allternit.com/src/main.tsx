import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PlatformAuthProvider } from "@/lib/platform-auth-client";
import App from "@/App";
import "@/styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PlatformAuthProvider>
        <App />
      </PlatformAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
