export function GET() {
  return Response.json({
    auth: {
      env: "ALLTERNIT_TOKEN",
      method: "browser",
    },
  })
}
