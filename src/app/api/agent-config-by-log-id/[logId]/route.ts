import { NextRequest, NextResponse } from "next/server"
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb"
import { auth, currentUser } from "@clerk/nextjs/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getCallerGlobalRole } from "@/lib/prod-auth"

const REGION = process.env.AWS_REGION || "ap-south-1"
const CALL_CONFIG_TABLE = (process.env.CALL_CONFIG_TABLE || `call-log-agent-config-${process.env.STAGE || "dev"}`).trim()
const CONFIG_VERSIONS_TABLE = (process.env.CONFIG_VERSIONS_TABLE || `config-versions-${process.env.STAGE || "dev"}`).trim()
const client = new DynamoDBClient({ region: REGION })
const supabase = createServiceRoleClient()

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    const callerGlobalRole = await getCallerGlobalRole(userId)
    const isSuperAdmin = callerGlobalRole === "superadmin"

    const resolvedParams = await params
    const logId = resolvedParams.logId

    if (!logId) {
      return NextResponse.json({ message: "log_id is required" }, { status: 400 })
    }

    console.log(`📋 Fetching call config pointer from table: ${CALL_CONFIG_TABLE}, log_id: ${logId}`)

    // Step 1: log_id -> config_hash (tiny pointer row)
    const pointerResponse = await client.send(new GetItemCommand({
      TableName: CALL_CONFIG_TABLE,
      Key: { log_id: { S: logId } },
    }))

    if (!pointerResponse.Item) {
      return NextResponse.json(
        { message: "Agent config not found for this log_id" },
        { status: 404 }
      )
    }

    const configHash = pointerResponse.Item.config_hash?.S
    const agentId = pointerResponse.Item.agent_id?.S
    const projectId = pointerResponse.Item.project_id?.S

    if (!configHash) {
      return NextResponse.json(
        { message: "Agent config not found for this log_id" },
        { status: 404 }
      )
    }

    // Admin/owner (project-level) OR superadmin (global) only.
    // Fail CLOSED: no resolvable project_id means we cannot verify the caller's project role,
    // so deny rather than silently serve the config (older/legacy pointer rows may have
    // project_id stored as '' — must not be treated as "skip the check"). Superadmins bypass
    // this project-role check entirely, since their access isn't project-scoped.
    if (!isSuperAdmin) {
      if (!projectId) {
        console.error(`agent-config-by-log-id: pointer row for log_id=${logId} has no project_id — denying by default`)
        return NextResponse.json({ message: "Admin access required" }, { status: 403 })
      }

      const { data: userAccessMapping, error: accessError } = await supabase
        .from("pype_voice_email_project_mapping")
        .select("role, is_active")
        .eq("project_id", projectId)
        .or(`clerk_id.eq.${userId},email.ilike.${userEmail}`)
        .or("is_active.is.null,is_active.eq.true")
        .maybeSingle()

      if (accessError) {
        console.error("Error checking user access:", accessError)
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
      }

      if (!userAccessMapping || !["admin", "owner"].includes(userAccessMapping.role)) {
        return NextResponse.json({ message: "Admin access required" }, { status: 403 })
      }
    }

    // Step 2: config_hash -> actual config blob (deduped store)
    const versionResponse = await client.send(new GetItemCommand({
      TableName: CONFIG_VERSIONS_TABLE,
      Key: { config_hash: { S: configHash } },
    }))

    if (!versionResponse.Item?.full_config?.S) {
      return NextResponse.json(
        { message: "Agent config not found for this log_id" },
        { status: 404 }
      )
    }

    const item: any = {
      log_id: logId,
      agent_id: agentId,
      project_id: projectId,
    }

    try {
      item.full_config = JSON.parse(versionResponse.Item.full_config.S)
    } catch (e) {
      console.error("Error parsing full_config:", e)
      item.full_config = versionResponse.Item.full_config.S
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
