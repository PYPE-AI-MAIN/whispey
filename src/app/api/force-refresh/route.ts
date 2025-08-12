// API Route to provide instructions for forcing data refresh
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'To force refresh agent overview data:',
    instructions: [
      '1. Open browser console (F12)',
      '2. Run: localStorage.clear()',
      '3. Run: location.reload()',
      'OR',
      '4. Run: MockDataService.syncWithAPI().then(() => location.reload())'
    ],
    direct_links: {
      agent_001: 'http://localhost:3000/agents/agent_001?tab=overview',
      agent_002: 'http://localhost:3000/agents/agent_002?tab=overview', 
      agent_003: 'http://localhost:3000/agents/agent_003?tab=overview'
    },
    expected_metrics_agent_001: {
      total_calls: 4,
      total_minutes: 10.5,
      total_cost: 1.14,
      success_rate: '75%'
    }
  })
}

export async function POST(request: NextRequest) {
  // This endpoint returns JavaScript code to execute in browser console
  const refreshScript = `
// Clear localStorage and force data refresh
console.log('🔄 Clearing localStorage...');
localStorage.clear();

console.log('🔄 Reloading page to fetch fresh data...');
location.reload();
`;

  const advancedRefreshScript = `
// Advanced refresh with API sync
console.log('🔄 Clearing localStorage...');
localStorage.clear();

console.log('📡 Fetching fresh data from API...');
fetch('/api/data?type=current')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Fresh data received:', data);
    console.log('🔄 Reloading page...');
    location.reload();
  })
  .catch(err => {
    console.error('❌ API fetch failed:', err);
    console.log('🔄 Reloading anyway...');
    location.reload();
  });
`;

  return NextResponse.json({
    success: true,
    simple_script: refreshScript,
    advanced_script: advancedRefreshScript,
    instructions: [
      'SIMPLE: Copy and paste the simple_script into your browser console',
      'ADVANCED: Copy and paste the advanced_script for API verification'
    ],
    quick_fix: 'localStorage.clear(); location.reload();'
  })
}
