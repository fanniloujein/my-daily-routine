import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Fanni’stic — Design · Web · Branding";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#0E1633", display: "flex", alignItems: "center", justifyContent: "center", gap: 48 }}>
        <svg width="220" height="220" viewBox="0 0 64 64">
          <rect x="6" y="14" width="12" height="44" rx="6" fill="#FFFFFF" />
          <rect x="6" y="14" width="34" height="12" rx="6" fill="#FFC21A" />
          <rect x="24" y="32" width="11" height="11" rx="3" fill="#FFFFFF" />
          <path d="M51 3c.9 6.6 2.9 8.6 9.5 9.5-6.6.9-8.6 2.9-9.5 9.5-.9-6.6-2.9-8.6-9.5-9.5C48.1 11.6 50.1 9.6 51 3Z" fill="#1FC8E3" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 700, color: "#FFFFFF", letterSpacing: -3 }}>
            Fanni<span style={{ color: "#FFC21A" }}>’</span>stic
          </div>
          <div style={{ fontSize: 30, color: "#C9CEDD", letterSpacing: 10, marginTop: 8 }}>DESIGN • WEB • BRANDING</div>
        </div>
      </div>
    ),
    size,
  );
}
