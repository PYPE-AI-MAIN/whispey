/**
 * Utility to verify distinct config is saved correctly in the database
 * Run this in browser console to check saved custom totals
 */

import { supabase } from '../lib/supabase'

export async function verifyDistinctConfig(projectId: string, agentId: string) {
  try {
    const { data, error } = await supabase
      .from('pype_voice_custom_totals_configs')
      .select('id, name, aggregation, distinct_config, column_name, json_field')
      .eq('project_id', projectId)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching:', error)
      return
    }

    console.log('🔍 Verification Results:')
    console.log('='.repeat(60))
    
    if (data.length === 0) {
      console.log('No custom totals found')
      return
    }

    data.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.name}`)
      console.log(`   Aggregation: ${row.aggregation}`)
      console.log(`   Column: ${row.column_name}${row.json_field ? ` (field: ${row.json_field})` : ''}`)
      console.log(`   Distinct Config:`, row.distinct_config)
      console.log(`   Distinct Config Type:`, typeof row.distinct_config)
      console.log(`   Distinct Config Stringified:`, JSON.stringify(row.distinct_config))
      
      if (row.distinct_config) {
        try {
          const parsed = typeof row.distinct_config === 'string' 
            ? JSON.parse(row.distinct_config) 
            : row.distinct_config
          console.log(`   ✅ Distinct Config Parsed:`, parsed)
        } catch (e) {
          console.log(`   ⚠️  Could not parse distinct_config:`, e)
        }
      } else {
        console.log(`   ⚠️  No distinct config found`)
      }
      console.log('-'.repeat(60))
    })

    // Summary
    const withDistinct = data.filter(row => row.distinct_config).length
    console.log(`\n📊 Summary:`)
    console.log(`   Total custom totals: ${data.length}`)
    console.log(`   With distinct config: ${withDistinct}`)
    console.log(`   Without distinct config: ${data.length - withDistinct}`)

  } catch (error) {
    console.error('❌ Verification failed:', error)
  }
}

// Make it available globally for easy console access
if (typeof window !== 'undefined') {
  (window as any).verifyDistinctConfig = verifyDistinctConfig
  console.log('💡 Tip: Run verifyDistinctConfig(projectId, agentId) in console to check saved distinct configs')
}

