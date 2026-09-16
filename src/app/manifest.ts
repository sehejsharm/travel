import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Manifest — trip planner",
    short_name: "Manifest",
    description: "Everything about your trip, in one file.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1116",
    theme_color: "#0b1116",
    orientation: "portrait",
    categories: ["travel", "productivity"],
    // Lets the OS share sheet send a Reel or a screenshot caption straight here.
    share_target: {
      action: "/add",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops to its own shape; this one keeps the mark inside the safe zone.
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
      // Next serves the generated PNG at /apple-icon, without the extension.
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
