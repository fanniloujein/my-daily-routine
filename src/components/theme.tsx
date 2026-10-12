"use client";

import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    let p: ThemePref = "system";
    try {
      p = (localStorage.getItem("mlos-theme") as ThemePref) || "system";
    } catch {}
    setPref(p);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let cur: ThemePref = "system";
      try {
        cur = (localStorage.getItem("mlos-theme") as ThemePref) || "system";
      } catch {}
      if (cur === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const set = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem("mlos-theme", p);
    } catch {}
    apply(p);
  };
  return { pref, set };
}
