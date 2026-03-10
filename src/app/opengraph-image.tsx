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
        {/* Prism icon */}
        <svg
          width="100"
          height="100"
          viewBox="0 0 120 120"
          fill="none"
        >
          <circle cx="60" cy="57" r="45" fill="rgba(139,92,246,0.15)" />
          <line x1="60" y1="4" x2="60" y2="30" stroke="rgba(196,181,253,0.8)" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 28L88 44L88 70L60 86L32 70L32 44Z" fill="url(#og-pg)" />
          <path d="M60 28L88 44L60 57Z" fill="white" opacity="0.08" />
          <path d="M60 28L32 44L60 57Z" fill="white" opacity="0.04" />
          <circle cx="60" cy="57" r="6" fill="#1C0F2B" />
          <circle cx="58" cy="55" r="1.8" fill="white" opacity="0.5" />
          <line x1="46" y1="78" x2="22" y2="114" stroke="rgba(196,181,253,0.7)" strokeWidth="2" strokeLinecap="round" />
          <line x1="60" y1="86" x2="60" y2="114" stroke="rgba(196,181,253,0.7)" strokeWidth="2" strokeLinecap="round" />
          <line x1="74" y1="78" x2="98" y2="114" stroke="rgba(196,181,253,0.7)" strokeWidth="2" strokeLinecap="round" />
          <defs>
            <linearGradient id="og-pg" x1="32" y1="28" x2="88" y2="86" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4C1D95" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
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
