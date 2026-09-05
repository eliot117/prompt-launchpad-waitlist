import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prompt Launchpad",
    short_name: "Prompt Launchpad",
    description:
      "Prompt Launchpad turns any rough idea into a production-ready Master Prompt for any AI — written by Elia.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1877f2",
    icons: [
      {
        src: "/assets/prompt-launchpad-logo.png",
        sizes: "215x215",
        type: "image/png",
      },
    ],
  };
}
