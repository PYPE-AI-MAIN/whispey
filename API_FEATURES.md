# Complete API Features Documentation

## Error Logging API - All Available Endpoints

### 1. Error Logging
- **POST** `/errors/log` - Log a single error
- **POST** `/errors/batch` - Batch log multiple errors (max 25)

### 2. Error Retrieval
- **GET** `/errors/recent` - Get most recent errors (dashboard)
- **GET** `/errors/session/{sessionId}` - Get all errors for a session
- **GET** `/errors/project/{projectId}` - Get errors by project
- **GET** `/errors/agent/{agentId}` - Get errors by agent
- **GET** `/errors/project/{projectId}/agent/{agentId}` - Get errors by project + agent
- **GET** `/errors/customer/{customerNumber}` - Get errors by customer
- **GET** `/errors/time-range` - Get errors within time range
- **GET** `/errors/component/{component}` - Get errors by component type

### 3. Statistics & Analytics
- **GET** `/errors/statistics/project/{projectId}` - Project error statistics
- **GET** `/errors/statistics/agent/{agentId}` - Agent error statistics
- **GET** `/errors/statistics/customer/{customerNumber}` - Customer error statistics
- **GET** `/errors/count/component` - Error counts by component
- **GET** `/errors/count/type` - Error counts by type
- **GET** `/errors/hourly` - Hourly error breakdown
- **GET** `/errors/top-sessions` - Sessions with most errors

### 4. Data Management
- **DELETE** `/errors/session/{sessionId}` - Delete session errors
- **DELETE** `/errors/project/{projectId}` - Delete project errors
- **DELETE** `/errors/agent/{agentId}` - Delete agent errors
- **DELETE** `/errors/cleanup` - Delete old errors (cleanup)

### 5. Health
- **GET** `/health` - Health check endpoint

