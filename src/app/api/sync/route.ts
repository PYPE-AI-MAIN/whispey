// API Route to trigger data sync
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // This endpoint will be called by the frontend to trigger a sync
    // The actual sync happens in the MockDataService.syncWithAPI method
    return NextResponse.json({ 
      success: true, 
      message: 'Sync triggered - check browser console for sync status' 
    }, { status: 200 })
  } catch (error) {
    console.error('Error in sync endpoint:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to trigger sync' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Use POST to trigger sync',
    instructions: 'Call MockDataService.syncWithAPI() from browser console to force sync'
  })
}
