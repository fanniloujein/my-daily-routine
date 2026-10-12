import { ImageResponse } from "next/og";

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const s = [192, 512, 180].includes(Number(size)) ? Number(size) : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e2a4a 0%, #3460be 55%, #9b87f5 100%)",
          color: "white",
          fontSize: s * 0.38,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: s * 0.62, height: s * 0.62, borderRadius: s * 0.2, background: "rgba(255,255,255,0.16)" }}>L</div>
      </div>
    ),
    { width: s, height: s },
  );
}
