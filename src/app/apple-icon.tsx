import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1C0F2B 0%, #4C1D95 100%)",
          borderRadius: 36,
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
        >
          <path d="M60 28L88 44L88 70L60 86L32 70L32 44Z" fill="url(#ag)" />
          <path d="M60 28L88 44L60 57Z" fill="white" opacity="0.1" />
          <circle cx="60" cy="57" r="6" fill="#1C0F2B" />
          <circle cx="58" cy="55" r="1.8" fill="white" opacity="0.5" />
          <line x1="46" y1="78" x2="30" y2="108" stroke="rgba(196,181,253,0.6)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="60" y1="86" x2="60" y2="108" stroke="rgba(196,181,253,0.6)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="74" y1="78" x2="90" y2="108" stroke="rgba(196,181,253,0.6)" strokeWidth="2.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="ag" x1="32" y1="28" x2="88" y2="86" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4C1D95" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    ),
    { ...size }
  );
}
