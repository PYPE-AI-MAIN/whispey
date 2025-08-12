// Test connection route - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { MockDataService } from '@/lib/mockData'

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Test mock data service connection
    const projects = MockDataService.getProjects()
    const agents = MockDataService.getAgents()
    const callLogs = MockDataService.getCallLogs()

    return NextResponse.json({
      success: true,
      data: {
        message: 'Mock data service connection successful',
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'development',
        stats: {
          totalProjects: projects.length,
          totalAgents: agents.length,
          totalCallLogs: callLogs.length
        }
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}