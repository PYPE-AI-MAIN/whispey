import { NextRequest, NextResponse } from "next/server"
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb"

const REGION = process.env.AWS_REGION || "ap-south-1"
const TABLE_NAME = process.env.AGENT_CONFIG_TABLE_NAME || "call-log-agent-config-test"
const client = new DynamoDBClient({ region: REGION })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    const resolvedParams = await params
    const logId = resolvedParams.logId

    if (!logId) {
      return NextResponse.json({ message: "log_id is required" }, { status: 400 })
    }

    console.log(`📋 Fetching agent config from table: ${TABLE_NAME}, log_id: ${logId}`)

    const command = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        log_id: { S: logId },
      },
    })

    const response = await client.send(command)

    if (!response.Item) {
      return NextResponse.json(
        { message: "Agent config not found for this log_id" },
        { status: 404 }
      )
    }

    // Parse DynamoDB item
    const item: any = {}
    for (const [key, value] of Object.entries(response.Item)) {
      if (value.S) {
        item[key] = value.S
      } else if (value.N) {
        item[key] = parseFloat(value.N)
      } else if (value.BOOL !== undefined) {
        item[key] = value.BOOL
      }
    }

    // Parse full_config if it exists
    if (item.full_config) {
      try {
        item.full_config = JSON.parse(item.full_config)
      } catch (e) {
        console.error("Error parsing full_config:", e)
      }
    }

    return NextResponse.json(item, { status: 200 })
  } catch (err: any) {
    console.error("Error fetching agent config:", err)
    return NextResponse.json(
      { message: "Unexpected error fetching agent config", error: err?.message },
      { status: 500 }
    )
  }
}

