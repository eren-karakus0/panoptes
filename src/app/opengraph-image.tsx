import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Panoptes - Chain Intelligence, Unblinking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1C0F2B 0%, #4C1D95 50%, #1C0F2B 100%)",
          color: "#EDE9FE",
          fontFamily: "sans-serif",
        }}
      >
        {/* Eye icon */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8B5CF6"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </svg>

        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 700,
            marginTop: 24,
            background: "linear-gradient(to right, #8B5CF6, #C4B5FD)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Panoptes
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#C4B5FD",
            marginTop: 12,
          }}
        >
          Chain Intelligence, Unblinking.
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 18,
            color: "#C4B5FD",
            opacity: 0.6,
            marginTop: 16,
            maxWidth: 600,
            textAlign: "center",
          }}
        >
          Validator monitoring, endpoint health, smart routing & anomaly detection for Republic AI
        </div>
      </div>
    ),
    { ...size }
  );
}
