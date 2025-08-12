// API Route for JSON Data Management
import { NextRequest, NextResponse } from 'next/server'
import { jsonFileService } from '@/lib/jsonFileService.server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'current', 'default', 'all'
    const table = searchParams.get('table') // 'projects', 'agents', 'users', 'callLogs'

    switch (type) {
      case 'default':
        const defaultData = jsonFileService.getDefaultData()
        return NextResponse.json(defaultData, { status: 200 })

      case 'current':
      default:
        const currentData = jsonFileService.readData()
        
        if (table) {
          // Return specific table data
          const tableData = currentData[table as keyof typeof currentData] || []
          return NextResponse.json(tableData, { status: 200 })
        }
        
        // Return all current data
        return NextResponse.json(currentData, { status: 200 })
    }
  } catch (error) {
    console.error('Error in data GET:', error)
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, table, data, id } = body

    switch (action) {
      case 'create':
        if (!table || !data) {
          return NextResponse.json({ error: 'Table and data required' }, { status: 400 })
        }

        let success = false
        switch (table) {
          case 'projects':
            success = jsonFileService.addProject(data)
            break
          case 'agents':
            success = jsonFileService.addAgent(data)
            break
          case 'callLogs':
            success = jsonFileService.addCallLog(data)
            break
          default:
            return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
        }

        return NextResponse.json({ success }, { status: success ? 201 : 500 })

      case 'update':
        if (!table || !id || !data) {
          return NextResponse.json({ error: 'Table, ID, and data required' }, { status: 400 })
        }

        let updateSuccess = false
        switch (table) {
          case 'projects':
            updateSuccess = jsonFileService.updateProject(id, data)
            break
          case 'agents':
            updateSuccess = jsonFileService.updateAgent(id, data)
            break
          default:
            return NextResponse.json({ error: 'Invalid table for update' }, { status: 400 })
        }

        return NextResponse.json({ success: updateSuccess }, { status: updateSuccess ? 200 : 404 })

      case 'delete':
        if (!table || !id) {
          return NextResponse.json({ error: 'Table and ID required' }, { status: 400 })
        }

        let deleteSuccess = false
        switch (table) {
          case 'projects':
            deleteSuccess = jsonFileService.deleteProject(id)
            break
          case 'agents':
            deleteSuccess = jsonFileService.deleteAgent(id)
            break
          default:
            return NextResponse.json({ error: 'Invalid table for delete' }, { status: 400 })
        }

        return NextResponse.json({ success: deleteSuccess }, { status: deleteSuccess ? 200 : 404 })

      case 'reset':
        const resetSuccess = jsonFileService.resetToDefault()
        return NextResponse.json({ success: resetSuccess }, { status: resetSuccess ? 200 : 500 })

      case 'backup':
        const backupFile = jsonFileService.backupCurrentData()
        return NextResponse.json({ 
          success: !!backupFile, 
          backupFile 
        }, { status: backupFile ? 200 : 500 })

      case 'overwrite':
        if (!data) {
          return NextResponse.json({ error: 'Data required for overwrite' }, { status: 400 })
        }
        
        const overwriteSuccess = jsonFileService.writeData(data)
        return NextResponse.json({ success: overwriteSuccess }, { status: overwriteSuccess ? 200 : 500 })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in data POST:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const success = jsonFileService.writeData(data)
    
    return NextResponse.json({ success }, { status: success ? 200 : 500 })
  } catch (error) {
    console.error('Error in data PUT:', error)
    return NextResponse.json({ error: 'Failed to update data' }, { status: 500 })
  }
}
