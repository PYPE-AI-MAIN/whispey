# Professional Admin Panel - Complete Feature List

## Overview
A comprehensive, enterprise-grade admin panel for monitoring and managing errors across all agents in the system.

## Available Sections

### 1. Error Monitoring ⚠️
**Features:**
- Multi-agent selection dropdown (scrollable, max 500px height)
- Real-time error aggregation (auto-refresh every 30 seconds)
- Dynamic error type detection (no hardcoded types)
- Error counts by:
  - SIP Status Codes (408, 480, 500, etc.)
  - HTTP Status Codes
  - Component:ErrorType combinations
  - Component breakdown (STT, LLM, TTS, SIP, Server)
- Detailed error logs with:
  - Component filtering
  - Customer number tracking
  - Session ID tracking
  - Timestamp information
  - Error messages and details

**API Endpoints Used:**
- `GET /errors/recent` - Fetch recent errors
- `GET /errors/statistics/project/{projectId}` - Get statistics

### 2. Analytics Dashboard 📊
**Features:**
- Hourly error breakdown chart (24-hour view)
- Component distribution visualization
- Top error types ranking
- Date range selection
- Multi-agent aggregation

**API Endpoints Used:**
- `GET /errors/hourly` - Hourly breakdown
- `GET /errors/count/component` - Component counts
- `GET /errors/count/type` - Error type counts

### 3. Session Management 🕐
**Features:**
- Top error sessions list
- Session error count ranking
- Component and error type breakdown per session
- Delete session errors functionality
- Date-based filtering

**API Endpoints Used:**
- `GET /errors/top-sessions` - Get top error sessions
- `DELETE /errors/session/{sessionId}` - Delete session errors

### 4. Customer Tracking 👥
**Features:**
- Search errors by customer number
- Customer error statistics
- Total errors per customer
- Unique sessions affected
- Component breakdown per customer
- Full error history for customer

**API Endpoints Used:**
- `GET /errors/customer/{customerNumber}` - Get customer errors
- `GET /errors/statistics/customer/{customerNumber}` - Customer statistics

### 5. Data Management 🗄️
**Features:**
- Delete project errors (by date)
- Delete agent errors (by date)
- Delete session errors
- Cleanup old errors (by days)
- Safety warnings and confirmations

**API Endpoints Used:**
- `DELETE /errors/project/{projectId}` - Delete project errors
- `DELETE /errors/agent/{agentId}` - Delete agent errors
- `DELETE /errors/session/{sessionId}` - Delete session errors
- `DELETE /errors/cleanup` - Cleanup old errors

## Complete API Integration

### All Available Endpoints (21 Total)

#### Error Logging
1. ✅ `POST /errors/log` - Log single error
2. ✅ `POST /errors/batch` - Batch log errors

#### Error Retrieval
3. ✅ `GET /errors/recent` - Recent errors (dashboard)
4. ✅ `GET /errors/session/{sessionId}` - Session errors
5. ✅ `GET /errors/project/{projectId}` - Project errors
6. ✅ `GET /errors/agent/{agentId}` - Agent errors
7. ✅ `GET /errors/project/{projectId}/agent/{agentId}` - Project+Agent errors
8. ✅ `GET /errors/customer/{customerNumber}` - Customer errors
9. ✅ `GET /errors/time-range` - Time range errors
10. ✅ `GET /errors/component/{component}` - Component errors

#### Statistics & Analytics
11. ✅ `GET /errors/statistics/project/{projectId}` - Project statistics
12. ✅ `GET /errors/statistics/agent/{agentId}` - Agent statistics
13. ✅ `GET /errors/statistics/customer/{customerNumber}` - Customer statistics
14. ✅ `GET /errors/count/component` - Component counts
15. ✅ `GET /errors/count/type` - Error type counts
16. ✅ `GET /errors/hourly` - Hourly breakdown
17. ✅ `GET /errors/top-sessions` - Top error sessions

#### Data Management
18. ✅ `DELETE /errors/session/{sessionId}` - Delete session
19. ✅ `DELETE /errors/project/{projectId}` - Delete project
20. ✅ `DELETE /errors/agent/{agentId}` - Delete agent
21. ✅ `DELETE /errors/cleanup` - Cleanup old errors

## Key Features

### Global Agent View
- Fetches ALL agents from database (not project-specific)
- Multi-select with searchable dropdown
- Scrollable list (max 500px height)
- Agents grouped by project

### Dynamic Error Aggregation
- No hardcoded error types
- Automatically detects all error types from data
- Real-time aggregation across selected agents
- Percentage calculations
- Visual charts and graphs

### Professional UI/UX
- Clean, modern interface
- Responsive design (mobile + desktop)
- Dark mode support
- Loading states
- Error handling
- Confirmation dialogs for destructive actions

### Real-time Updates
- Auto-refresh every 30 seconds
- Manual refresh button
- Live error counts
- Real-time aggregation

## Technical Architecture

### Frontend Components
```
src/components/admin/
├── AdminPanel.tsx (Main container with tabs)
├── sections/
│   ├── ErrorMonitoring.tsx
│   ├── AnalyticsDashboard.tsx
│   ├── SessionManagement.tsx
│   ├── CustomerTracking.tsx
│   └── DataManagement.tsx
├── ErrorAggregation.tsx
└── ErrorLogsDisplay.tsx
```

### API Routes
```
src/app/api/admin/
├── all-errors/route.ts
├── statistics/route.ts
├── recent-errors/route.ts
├── hourly-breakdown/route.ts
├── component-counts/route.ts
├── error-type-counts/route.ts
├── top-sessions/route.ts
├── customer-errors/route.ts
├── delete-session/route.ts
└── delete-errors/route.ts
```

## Configuration

Set in `.env.local`:
```env
ERROR_LOGGER_API_BASE=http://0.0.0.0:4000/dev/api/v1
```

**Important:** The base URL should NOT include `/api/v1` if your serverless logger already includes it in the base path.

## Usage

1. Navigate to `/{projectId}/admin`
2. Select agents from the dropdown
3. View real-time error monitoring
4. Switch between tabs for different views
5. Use filters and date selectors as needed

