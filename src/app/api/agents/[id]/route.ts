// Agent by ID API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Check if agent exists
    const agent = jsonFileService.getAgentById(id)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Delete agent using JSON file service
    const success = jsonFileService.deleteAgent(id)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      )
    }

    console.log(`Successfully deleted agent with ID: ${id}`)
    return NextResponse.json(
      { success: true, message: 'Agent deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error deleting agent:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Get agent from JSON file service
    const agent = jsonFileService.getAgentById(id)
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(agent, { status: 200 })

  } catch (error) {
    console.error('Unexpected error fetching agent:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Check if agent exists
    const existingAgent = jsonFileService.getAgentById(id)
    if (!existingAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Update agent using JSON file service
    const updatedAgent = jsonFileService.updateAgent(id, body)
    
    if (!updatedAgent) {
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    console.log(`Successfully updated agent with ID: ${id}`)
    return NextResponse.json(updatedAgent, { status: 200 })

  } catch (error) {
    console.error('Unexpected error updating agent:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}