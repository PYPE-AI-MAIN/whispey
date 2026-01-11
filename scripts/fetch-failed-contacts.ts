/**
 * Script to fetch failed contacts from DynamoDB
 * Fetches contacts where status="failed" and campaign_id matches the specified campaign
 * 
 * Usage: 
 *   npm run fetch-failed-contacts <campaign-id> [output-file]
 *   or
 *   npx tsx scripts/fetch-failed-contacts.ts <campaign-id> [output-file]
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import * as fs from 'fs'
import * as path from 'path'

// Try to load environment variables from .env files
try {
  // @ts-ignore - dotenv may not be installed
  const dotenv = require('dotenv')
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
} catch (e) {
  // dotenv not available, rely on environment variables being set
}

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const docClient = DynamoDBDocumentClient.from(client)

// Table name - adjust if different for production
const TABLE_NAME = process.env.DYNAMODB_CONTACTS_TABLE || 'contacts-prod'

interface FailedContact {
  [key: string]: any // DynamoDB items can have various fields
}

async function fetchFailedContacts(campaignId: string, outputFile?: string) {
  console.log(`\n📊 Fetching failed contacts from DynamoDB`)
  console.log(`   Campaign ID: ${campaignId}`)
  console.log(`   Status: failed`)
  console.log(`   Table: ${TABLE_NAME}\n`)

  const allContacts: FailedContact[] = []
  let lastEvaluatedKey: any = undefined
  let totalScanned = 0
  let hasMore = true

  try {
    while (hasMore) {
      // Build filter expression for status="failed" and campaign_id
      // Note: "status" is a reserved keyword in DynamoDB, so we must use ExpressionAttributeNames
      const filterExpression: string[] = []
      const expressionAttributeNames: Record<string, string> = {}
      const expressionAttributeValues: Record<string, any> = {}

      // Filter by status - must use ExpressionAttributeNames since "status" is reserved
      filterExpression.push('#status = :status')
      expressionAttributeNames['#status'] = 'status'
      expressionAttributeValues[':status'] = 'failed'

      // Filter by campaign_id (try both camelCase and snake_case)
      filterExpression.push('(campaignId = :campaignId OR campaign_id = :campaignId)')
      expressionAttributeValues[':campaignId'] = campaignId

      const scanParams = {
        TableName: TABLE_NAME,
        FilterExpression: filterExpression.join(' AND '),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100, // Fetch in batches
      }

      console.log(`  🔍 Scanning batch... (scanned: ${totalScanned})`)

      const command = new ScanCommand(scanParams)
      const result = await docClient.send(command)

      const items = result.Items || []
      allContacts.push(...items)
      
      totalScanned += result.ScannedCount || 0
      lastEvaluatedKey = result.LastEvaluatedKey
      hasMore = !!lastEvaluatedKey

      console.log(`  ✓ Found ${items.length} failed contacts in this batch (Total: ${allContacts.length})`)

      // Safety break to avoid infinite loops
      if (totalScanned > 10000) {
        console.warn(`  ⚠️  Reached scan limit of 10,000 items. Stopping scan.`)
        break
      }
    }

    console.log(`\n✅ Total failed contacts fetched: ${allContacts.length}`)
    console.log(`   Total items scanned: ${totalScanned}`)

    if (allContacts.length === 0) {
      console.log('⚠️  No failed contacts found for this campaign')
      return
    }

    // Prepare output data
    const outputData = {
      campaign_id: campaignId,
      status: 'failed',
      export_date: new Date().toISOString(),
      total_contacts: allContacts.length,
      table_name: TABLE_NAME,
      data: allContacts,
    }

    // Determine output file path
    const defaultFileName = `failed-contacts-${campaignId}-${new Date().toISOString().split('T')[0]}.json`
    const outputPath = outputFile 
      ? path.resolve(outputFile)
      : path.resolve(process.cwd(), 'exports', defaultFileName)

    // Ensure exports directory exists
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8')

    console.log(`\n💾 Data saved to: ${outputPath}`)
    console.log(`📁 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`)
    
    // Print summary statistics
    console.log('\n📈 Summary Statistics:')
    console.log(`   - Total failed contacts: ${allContacts.length}`)
    
    // Extract unique fields to show what data is available
    const fieldCounts: Record<string, number> = {}
    allContacts.forEach(contact => {
      Object.keys(contact).forEach(key => {
        fieldCounts[key] = (fieldCounts[key] || 0) + 1
      })
    })

    console.log(`   - Unique fields found: ${Object.keys(fieldCounts).length}`)
    if (Object.keys(fieldCounts).length > 0) {
      console.log(`\n📋 Available fields:`)
      Object.entries(fieldCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([field, count]) => {
          console.log(`   - ${field}: ${count} contacts`)
        })
    }

    // Show sample of phone numbers if available
    const phoneFields = ['phoneNumber', 'phone_number', 'phone', 'customer_number']
    const phoneField = phoneFields.find(field => fieldCounts[field])
    if (phoneField) {
      const samplePhones = allContacts
        .slice(0, 5)
        .map(c => c[phoneField])
        .filter(Boolean)
      if (samplePhones.length > 0) {
        console.log(`\n📞 Sample phone numbers (first 5):`)
        samplePhones.forEach(phone => console.log(`   - ${phone}`))
      }
    }

  } catch (error: any) {
    console.error('\n❌ Error fetching contacts:', error.message)
    if (error.name === 'ResourceNotFoundException') {
      console.error(`   Table "${TABLE_NAME}" not found. Please check the table name.`)
    }
    if (error.details) {
      console.error('Details:', error.details)
    }
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

// Main execution
const campaignId = process.argv[2]
const outputFile = process.argv[3]

if (!campaignId) {
  console.error('Usage: npx tsx scripts/fetch-failed-contacts.ts <campaign-id> [output-file]')
  console.error('\nExample:')
  console.error('  npx tsx scripts/fetch-failed-contacts.ts 0e726ff9-f622-417c-9f18-e36effd11df5')
  console.error('  npx tsx scripts/fetch-failed-contacts.ts 0e726ff9-f622-417c-9f18-e36effd11df5 ./failed-contacts.json')
  console.error('\nEnvironment variables required:')
  console.error('  - AWS_REGION (default: ap-south-1)')
  console.error('  - AWS_ACCESS_KEY_ID')
  console.error('  - AWS_SECRET_ACCESS_KEY')
  console.error('  - DYNAMODB_CONTACTS_TABLE (optional, default: pype-samunnati-dynamodb-2)')
  process.exit(1)
}

// Validate AWS credentials
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('Error: Missing AWS credentials')
  console.error('Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set')
  process.exit(1)
}

fetchFailedContacts(campaignId, outputFile)
  .then(() => {
    console.log('\n✨ Export completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Export failed:', error)
    process.exit(1)
  })

