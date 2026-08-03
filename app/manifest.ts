import { SiteConfig } from "@/site-config";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SiteConfig.title,
    short_name: SiteConfig.title,
    description: SiteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#fff",
    theme_color: SiteConfig.brand.primary,
    // Android n'installe une PWA que s'il trouve un PNG de 192 ou 512 px : un
    // .ico en `sizes: "any"` ne compte pas, et l'app se posait sur l'écran
    // d'accueil avec l'icône générique du navigateur. Le .ico reste pour les
    // onglets desktop. Le maskable est le seul que le masque rond d'Android
    // ne rogne pas (motif tenu dans 62 % du canvas, fond plein bord à bord).
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
