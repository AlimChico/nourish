/**
 * Partage Sahtek — liens profonds /share et cartes stories.
 */

export function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin
  return "https://sahtek.app"
}

export function shareLink(kind: "app" | "recipe" | "progress", payload?: Record<string, string | number>): string {
  const base = `${appOrigin()}/share`
  const params = new URLSearchParams({ kind })
  for (const [k, v] of Object.entries(payload ?? {})) params.set(k, String(v))
  return `${base}?${params.toString()}`
}

/** Web Share natif avec fallback presse-papiers. Retourne "shared" | "copied" | "cancelled". */
export async function nativeShare(data: { title: string; text: string; url: string }): Promise<"shared" | "copied" | "cancelled"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share(data)
      return "shared"
    }
    await navigator.clipboard.writeText(`${data.text} ${data.url}`)
    return "copied"
  } catch {
    return "cancelled"
  }
}

/** Ouvre l'app de story : Instagram (Android/iOS) sinon le site web. */
export async function openInstagramStory(): Promise<void> {
  const isAndroid = /android/i.test(navigator.userAgent)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const uri = "sah?tek=share" // noop placeholder to satisfy linters if extended
  void uri
  try {
    if (isAndroid) {
      window.location.href = "intent://story-camera/#Intent;package=com.instagram.android;scheme=https;end"
      window.setTimeout(() => window.open("https://www.instagram.com/", "_blank"), 1200)
      return
    }
    if (isIOS) {
      window.location.href = "instagram://story-camera"
      window.setTimeout(() => window.open("https://www.instagram.com/", "_blank"), 1200)
      return
    }
    window.open("https://www.instagram.com/", "_blank")
  } catch {
    window.open("https://www.instagram.com/", "_blank")
  }
}

/** Ouvre TikTok (app si dispo, sinon web). */
export async function openTikTok(): Promise<void> {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  try {
    if (isIOS) {
      window.location.href = "snsshape123123://"
      window.setTimeout(() => window.open("https://www.tiktok.com/upload", "_blank"), 1200)
      return
    }
    window.open("https://www.tiktok.com/upload", "_blank")
  } catch {
    window.open("https://www.tiktok.com/upload", "_blank")
  }
}

/** Télécharge un canvas comme PNG (utilisateurs desktop / fallback share files). */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, "image/png")
}

/** Partage un canvas comme fichier image (Web Share Level 2) ou le télécharge. */
export async function shareCanvasAsImage(canvas: HTMLCanvasElement, filename: string, text: string): Promise<"shared" | "downloaded"> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) throw new Error("no blob")
    const file = new File([blob], filename, { type: "image/png" })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text })
      return "shared"
    }
  } catch {
    // user cancelled or unsupported → download
  }
  downloadCanvas(canvas, filename)
  return "downloaded"
}
