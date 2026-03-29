export const dynamic = "force-dynamic"
export const dynamicParams = true

export function GET() {
  return Response.json({
    auth: {
      env: "A2R_TOKEN",
      method: "browser",
    },
  })
}
