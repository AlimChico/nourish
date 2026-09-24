import { ImageResponse } from "next/og"

// Image d'aperçu de marque (1200×630) quand un lien Sahtek est partagé
// sur WhatsApp, iMessage, X, LinkedIn… Satori exige display:flex partout.
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Sahtek — ton coach nutrition tunisien"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b0f0d",
          backgroundImage:
            "radial-gradient(circle at 88% 0%, rgba(61,220,132,0.45), rgba(11,15,13,0) 55%), radial-gradient(circle at 4% 100%, rgba(74,222,128,0.35), rgba(11,15,13,0) 55%)",
          color: "#e6fff1",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo : disque feuille + S */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            borderRadius: 36,
            backgroundColor: "#0f1f17",
            border: "3px solid rgba(167,243,208,0.25)",
            fontSize: 84,
            fontWeight: 800,
            color: "#34d399",
          }}
        >
          S
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#a7f3d0",
          }}
        >
          Sahtek
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: 38,
            color: "#8fb5a3",
          }}
        >
          Ton coach nutrition tunisien
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 44,
            padding: "16px 36px",
            borderRadius: 999,
            backgroundColor: "rgba(52,211,153,0.14)",
            border: "2px solid rgba(52,211,153,0.35)",
            fontSize: 30,
            fontWeight: 700,
            color: "#34d399",
          }}
        >
          Calories · Scan repas · Recettes 🇹🇳
        </div>
      </div>
    ),
    size,
  )
}
