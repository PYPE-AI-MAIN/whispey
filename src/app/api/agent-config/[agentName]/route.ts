import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    // pathname = "/api/agent-config/FanaticAuthorship"
    const pathSegments = url.pathname.split("/")
    const agentName = pathSegments[pathSegments.length - 1]

    if (!agentName) {
      return NextResponse.json({ message: "Agent name is required" }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
    if (!baseUrl) {
      return NextResponse.json({ message: "Missing NEXT_PUBLIC_PYPEAI_API_URL" }, { status: 500 })
    }

    const apiUrl = `${baseUrl}/agent_config/${encodeURIComponent(agentName)}`
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "pype-api-v1",
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json(
        {
          message: `Failed to fetch agent config: ${response.status} ${response.statusText}`,
          error: errorText || undefined,
        },
        { status: response.status },
      )
    }

    const data = await response.json().catch(async () => {
      // fallback for non-JSON content
      const raw = await response.text().catch(() => "")
      return raw ? JSON.parse(raw) : null
    })

    return NextResponse.json(data, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { message: "Unexpected error fetching agent config", error: err?.message },
      { status: 500 },
    )
  }
}
