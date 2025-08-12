// Force sync endpoint that returns JavaScript to execute
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const forceScript = `
// Force complete data refresh
console.log('🔄 Force sync: Starting complete data refresh...');

// Step 1: Clear all localStorage
localStorage.clear();
console.log('✅ Force sync: Cleared localStorage');

// Step 2: Fetch fresh data from API
fetch('/api/data?type=current')
  .then(response => response.json())
  .then(freshData => {
    console.log('✅ Force sync: Received fresh data:', {
      projects: freshData.projects?.length || 0,
      agents: freshData.agents?.length || 0,
      callLogs: freshData.callLogs?.length || 0,
      agent_001_calls: freshData.callLogs?.filter(c => c.agent_id === 'agent_001')?.length || 0
    });
    
    // Step 3: Store fresh data in localStorage
    if (freshData.projects) localStorage.setItem('mockData_projects', JSON.stringify(freshData.projects));
    if (freshData.agents) localStorage.setItem('mockData_agents', JSON.stringify(freshData.agents));
    if (freshData.callLogs) localStorage.setItem('mockData_callLogs', JSON.stringify(freshData.callLogs));
    if (freshData.users) localStorage.setItem('mockData_users', JSON.stringify(freshData.users));
    localStorage.setItem('mockData_metrics', JSON.stringify(freshData.customOverviewMetrics || []));
    localStorage.setItem('mockData_transcriptLogs', JSON.stringify([]));
    
    console.log('✅ Force sync: Stored fresh data in localStorage');
    
    // Step 4: Test MockDataService if available
    if (typeof MockDataService !== 'undefined') {
      const testCalls = MockDataService.getCallLogs('agent_001');
      console.log('✅ Force sync: MockDataService test:', testCalls.length, 'calls for agent_001');
    }
    
    // Step 5: Reload page
    console.log('🔄 Force sync: Reloading page...');
    location.reload();
  })
  .catch(error => {
    console.error('❌ Force sync failed:', error);
    console.log('🔄 Reloading anyway...');
    location.reload();
  });
`;

  return new Response(forceScript, {
    headers: {
      'Content-Type': 'text/javascript',
    },
  })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    message: 'Copy this script and paste it into your browser console',
    script: `
// Quick fix
localStorage.clear(); 
location.reload();
`,
    detailed_script_url: 'GET /api/force-sync'
  })
}
