export const dynamic = "force-dynamic"

/** Indique quels providers OAuth sont configurés (l'UI cache les boutons sinon). */
export async function GET() {
  return Response.json({
    google: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    apple: !!process.env.APPLE_CLIENT_ID && !!process.env.APPLE_CLIENT_SECRET,
  })
}
