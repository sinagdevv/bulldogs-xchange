import "./recovery-token";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./design.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>);

if("serviceWorker" in navigator)window.addEventListener("load",()=>import.meta.env.DEV
  ?navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.filter(r=>new URL(r.scope).origin===location.origin).map(r=>r.unregister())))
  :navigator.serviceWorker.register("/sw.js"));
