import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Panoptes - Chain Intelligence",
    short_name: "Panoptes",
    description:
      "Chain intelligence platform for Republic AI. Validator monitoring, endpoint health, smart routing, and anomaly detection.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#1C0F2B",
    theme_color: "#1C0F2B",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
