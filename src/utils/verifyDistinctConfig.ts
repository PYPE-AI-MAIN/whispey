/**
 * Utility to verify distinct config is saved correctly in the database
 * Run this in browser console to check saved custom totals
 */

export async function verifyDistinctConfig(projectId: string, agentId: string) {
  try {
    const res = await fetch(`/api/custom-totals/${projectId}/${agentId}`)
    const json = (await res.json()) as { configs?: Array<Record<string, unknown>>; error?: string }
    if (!res.ok) {
      console.error('❌ Error fetching:', json.error)
      return
    }
    const data = json.configs || []

    console.log('🔍 Verification Results:')
    console.log('='.repeat(60))

    if (data.length === 0) {
      console.log('No custom totals found')
      return
    }

    data.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.name}`)
      console.log(`   Aggregation: ${row.aggregation}`)
      console.log(
        `   Column: ${row.column_name}${row.json_field ? ` (field: ${row.json_field})` : ''}`
      )
      console.log(`   Distinct Config:`, row.distinct_config)
      console.log(`   Distinct Config Type:`, typeof row.distinct_config)
      console.log(`   Distinct Config Stringified:`, JSON.stringify(row.distinct_config))

      if (row.distinct_config) {
        try {
          const parsed =
            typeof row.distinct_config === 'string'
              ? JSON.parse(row.distinct_config as string)
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

    const withDistinct = data.filter((row) => row.distinct_config).length
    console.log(`\n📊 Summary:`)
    console.log(`   Total custom totals: ${data.length}`)
    console.log(`   With distinct config: ${withDistinct}`)
    console.log(`   Without distinct config: ${data.length - withDistinct}`)
  } catch (error) {
    console.error('❌ Verification failed:', error)
  }
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { verifyDistinctConfig: typeof verifyDistinctConfig }).verifyDistinctConfig =
    verifyDistinctConfig
  console.log('💡 Tip: Run verifyDistinctConfig(projectId, agentId) in console to check saved distinct configs')
}
