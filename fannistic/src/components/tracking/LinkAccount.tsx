"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/i18n";

export function LinkAccount({ reference, token, d }: { reference: string; token: string; d: Dict }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const link = async () => {
    setState("busy");
    const res = await fetch(`/api/requests/${reference}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token }),
    }).catch(() => null);
    if (res?.ok) {
      setState("done");
      router.refresh();
    } else setState("error");
  };
  if (state === "done") return <p className="text-sm font-medium text-success" role="status">{d.tracking.linked}</p>;
  return (
    <div>
      <button type="button" onClick={link} disabled={state === "busy"} className="btn-ghost btn-sm">
        {d.tracking.linkAccount}
      </button>
      {state === "error" && <p className="field-error" role="alert">{d.common.error}</p>}
    </div>
  );
}
