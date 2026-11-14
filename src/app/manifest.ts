import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cempaka Costing",
    short_name: "Cempaka",
    description: "BOQ, costing, revisi, dan approval quotation Cempaka",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#714b67",
    lang: "id",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }
}
