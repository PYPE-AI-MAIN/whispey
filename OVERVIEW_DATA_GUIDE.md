# 📊 Overview Data Management Guide

## 🎯 Where to Set/Edit Agent Overview Data

### **Method 1: Magic Editor (Recommended)**
**URL**: `http://localhost:3000/magic`

1. **Call Logs Tab**: Add/edit call logs that generate overview metrics
2. **Agents Tab**: Edit agent configurations
3. **Raw JSON Tab**: Direct JSON editing for advanced users

### **Method 2: Direct JSON File Editing**
**File**: `data/current-data.json`

Add call logs in the `callLogs` array:
```json
{
  "id": "call_005",
  "call_id": "call_20240115_005", 
  "agent_id": "agent_003",
  "customer_number": "+1555345678",
  "call_ended_reason": "completed",
  "duration_seconds": 300,
  "metadata": {
    "lead_score": 95,
    "interest_level": "very_high",
    "budget_qualified": true,
    "decision_timeframe": "within_week",
    "next_action": "send_proposal"
  },
  "total_stt_cost": 0.07,
  "total_tts_cost": 0.11,
  "total_llm_cost": 0.20,
  "avg_latency": 1000,
  "created_at": "2024-01-15T18:00:00Z"
}
```

### **Method 3: Browser Console (Force Sync)**
1. Open browser console (F12)
2. Run: `MockDataService.syncWithAPI()`
3. Check console for sync confirmation

## 📈 Overview Metrics Calculation

The overview data is automatically calculated from call logs:

- **Total Calls**: Count of call logs for the agent
- **Total Minutes**: Sum of `duration_seconds / 60`
- **Total Cost**: Sum of `total_stt_cost + total_tts_cost + total_llm_cost`
- **Success Rate**: Percentage of calls with `call_ended_reason: "completed"`
- **Average Response Time**: Average of `avg_latency` values

## 🔄 Force Data Refresh

If overview shows 0 values:

1. **Clear Browser Storage**:
   ```javascript
   localStorage.clear()
   location.reload()
   ```

2. **Force Sync**:
   ```javascript
   MockDataService.syncWithAPI()
   ```

3. **Reset to Fresh Data**:
   ```bash
   curl -X POST "http://localhost:3000/api/data" -H "Content-Type: application/json" -d '{"action": "reset"}'
   ```

## 🎨 Make It Look Good

### **Custom Metrics**
Add custom overview metrics via the Magic Editor:

1. Go to `http://localhost:3000/magic`
2. Click "Custom Metrics" tab
3. Add metrics like:
   - Conversion Rate
   - Customer Satisfaction
   - Lead Quality Score
   - Revenue Generated

### **Visual Enhancements**
The overview automatically includes:
- 📞 Call volume charts
- 📊 Success rate analysis  
- ⏱️ Response time metrics
- 💰 Cost breakdowns
- 📈 Trend analysis

## 🚀 Quick Start

1. **Add Sample Data**:
   ```bash
   # Go to magic editor
   open http://localhost:3000/magic
   ```

2. **Add Call Logs**:
   - Click "Call Logs" tab
   - Click "Add Call Log"
   - Fill in agent_003 data
   - Save

3. **View Results**:
   ```bash
   # Go to agent dashboard  
   open http://localhost:3000/agents/agent_003
   ```

## 🛠️ Troubleshooting

**Problem**: Overview shows 0 values
**Solution**: Run in browser console:
```javascript
localStorage.clear()
MockDataService.syncWithAPI()
location.reload()
```

**Problem**: Data not updating
**Solution**: Check browser console for errors and sync status

**Problem**: Call logs not appearing
**Solution**: Verify agent_id matches in call logs and agent data
