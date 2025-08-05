# 📊 Dashboard Tutorial

Master the Obsera dashboard to analyze your voice AI performance and gain actionable insights.

## 🎯 Dashboard Overview

The Obsera dashboard provides comprehensive analytics for your voice AI applications:

- **📈 Real-time Metrics** - Live performance monitoring
- **💰 Cost Analysis** - Track spending across providers
- **🎙️ Voice Quality** - Audio and transcription insights
- **💬 Conversation Flow** - Turn analysis and patterns
- **📊 Custom Reports** - Build your own analytics views

## 🚀 Getting Started

### Accessing Your Dashboard

1. **Visit**: [https://pype-voice-analytics-dashboard.vercel.app](https://pype-voice-analytics-dashboard.vercel.app)
2. **Sign in** with your account
3. **Select your project** from the dropdown
4. **Navigate** to different sections using the sidebar

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header: Project Selector | User Menu | Notifications   │
├─────────────────────────────────────────────────────────┤
│ Sidebar:                                                │
│ 📊 Overview                                            │
│ 🎙️ Calls                                              │
│ 💰 Costs                                               │
│ 📈 Analytics                                           │
│ ⚙️ Settings                                            │
└─────────────────────────────────────────────────────────┘
```

## 📊 Overview Dashboard

### Key Metrics Cards

The overview shows your most important metrics:

- **Total Calls** - Number of voice interactions
- **Success Rate** - Percentage of completed calls
- **Average Duration** - Mean call length
- **Total Cost** - Cumulative spending
- **Active Agents** - Currently running agents

### Real-time Charts

#### Call Volume Over Time
```
📈 Call Volume (Last 24 Hours)
│    ████
│   ██████
│  ████████
│ ██████████
└─────────────────
 00:00  12:00  24:00
```

#### Cost Breakdown
```
💰 Cost by Provider
OpenAI: ████████ 45%
Deepgram: █████ 25%
ElevenLabs: ███ 15%
Others: ██ 15%
```

## 🎙️ Calls Section

### Call List View

| Call ID | Agent | Duration | Cost | Status | Actions |
|---------|-------|----------|------|--------|---------|
| `abc123` | Support Bot | 2:34 | $0.12 | ✅ Complete | 📊 View |
| `def456` | Sales Agent | 1:45 | $0.08 | ❌ Failed | 📊 View |

### Call Details

Click on any call to see detailed information:

#### Call Summary
```
📞 Call Details
Customer: +1 (555) 123-4567
Agent: Support Bot v2.1
Duration: 2 minutes 34 seconds
Cost: $0.12
Status: Completed successfully
```

#### Conversation Transcript
```
👤 User: "I need help with my account"
🤖 Agent: "I'd be happy to help you with your account. 
    What specific issue are you experiencing?"
👤 User: "I can't log in"
🤖 Agent: "Let me help you troubleshoot that. 
    Have you tried resetting your password?"
```

#### Performance Metrics
```
⚡ Performance
Response Time: 1.2s average
STT Accuracy: 95.2%
TTS Quality: 4.8/5.0
User Satisfaction: 4.5/5.0
```

## 💰 Costs Section

### Cost Overview

Track spending across different providers and time periods:

#### Monthly Cost Breakdown
```
📊 January 2024 Costs
┌─────────────────────────────────────┐
│ OpenAI (LLM)     │ $245.67 │ 45%  │
│ Deepgram (STT)   │ $134.23 │ 25%  │
│ ElevenLabs (TTS) │ $89.45  │ 16%  │
│ Azure (STT)      │ $67.89  │ 12%  │
│ Others           │ $12.76  │ 2%   │
└─────────────────────────────────────┘
Total: $550.00
```

### Cost Optimization

#### High-Cost Calls Analysis
```
🚨 High-Cost Calls (>$1.00)
Call ID: xyz789
Duration: 8:45
Cost: $2.34
Reason: Long conversation with complex queries
Recommendation: Implement conversation summarization
```

#### Provider Comparison
```
📊 Provider Cost Comparison
Provider    │ Avg Cost/Call │ Quality Score │ Recommendation
OpenAI      │ $0.12        │ 4.8/5.0      │ ✅ Optimal
Anthropic   │ $0.15        │ 4.9/5.0      │ ⚠️ Higher cost
Google      │ $0.08        │ 4.2/5.0      │ ⚠️ Lower quality
```

## 📈 Analytics Section

### Custom Reports

Build your own analytics views:

#### 1. Create New Report
```
📊 New Report
Name: Agent Performance Comparison
Description: Compare different agent versions
```

#### 2. Select Metrics
```
✅ Metrics to Include:
☑️ Call Duration
☑️ Success Rate
☑️ Cost per Call
☑️ User Satisfaction
☑️ Response Time
```

#### 3. Choose Visualization
```
📊 Chart Type:
○ Line Chart (Time series)
● Bar Chart (Comparison)
○ Pie Chart (Distribution)
○ Heatmap (Correlation)
```

### Advanced Analytics

#### Trend Analysis
```
📈 Response Time Trends
Week 1: 1.2s average
Week 2: 1.1s average ⬇️ 8% improvement
Week 3: 1.0s average ⬇️ 9% improvement
Week 4: 0.9s average ⬇️ 10% improvement
```

#### Correlation Analysis
```
🔍 Cost vs. Satisfaction
Correlation: 0.15 (weak positive)
Insight: Higher cost doesn't guarantee better satisfaction
Recommendation: Focus on efficiency over spending
```

## ⚙️ Settings & Configuration

### Project Settings

#### Agent Configuration
```
🤖 Agent Settings
Name: Customer Support Bot
Version: 2.1.0
Status: Active
Cost Alerts: $1.00 per call
Performance Alerts: >3s response time
```

#### Notification Preferences
```
🔔 Notifications
Email Alerts: ✅ Enabled
Slack Integration: ⚠️ Not configured
Cost Threshold: $100/day
Performance Threshold: 2s response time
```

### Data Export

#### Export Options
```
📤 Export Data
Format: CSV, JSON, Excel
Date Range: Last 30 days
Include: Calls, Costs, Transcripts
Schedule: Weekly automated export
```

## 🎯 Best Practices

### Daily Monitoring

1. **Check Overview** - Review key metrics
2. **Monitor Costs** - Watch for unusual spending
3. **Review Failures** - Analyze failed calls
4. **Update Alerts** - Adjust thresholds as needed

### Weekly Analysis

1. **Performance Review** - Compare weekly metrics
2. **Cost Optimization** - Identify savings opportunities
3. **Quality Assessment** - Review user satisfaction
4. **Report Generation** - Create executive summaries

### Monthly Planning

1. **Trend Analysis** - Identify long-term patterns
2. **Provider Evaluation** - Compare service quality
3. **Budget Planning** - Forecast future costs
4. **Strategy Updates** - Adjust based on insights

## 🔧 Advanced Features

### Custom Dashboards

Create personalized views for different stakeholders:

#### Executive Dashboard
```
📊 Executive Summary
- Total calls this month: 1,234
- Cost per call: $0.15
- Success rate: 94.2%
- ROI: 340% improvement
```

#### Technical Dashboard
```
🔧 Technical Metrics
- Average response time: 1.1s
- STT accuracy: 96.8%
- TTS quality: 4.7/5.0
- System uptime: 99.9%
```

### API Integration

#### Webhook Notifications
```
🔔 Webhook Configuration
URL: https://your-app.com/webhooks/obsera
Events: call_completed, cost_alert, performance_alert
Secret: your_webhook_secret
```

#### Custom Metrics
```
📊 Custom Metrics
- Business conversion rate
- Customer satisfaction score
- Agent efficiency rating
- Cost per conversion
```

## 🆘 Troubleshooting

### Common Issues

#### Dashboard Not Loading
```
❌ Issue: Dashboard shows loading spinner
✅ Solution: Check browser console for errors
✅ Solution: Clear browser cache
✅ Solution: Verify internet connection
```

#### Missing Data
```
❌ Issue: Recent calls not appearing
✅ Solution: Check API key configuration
✅ Solution: Verify agent ID is correct
✅ Solution: Check SDK integration
```

#### Performance Issues
```
❌ Issue: Dashboard is slow
✅ Solution: Use date filters to limit data
✅ Solution: Clear browser cache
✅ Solution: Check network connection
```

## 📚 Related Documentation

- [🚀 Getting Started Guide](getting-started.md)
- [🔧 SDK Reference](sdk-reference.md)
- [🏠 Self-hosting Guide](self-hosting.md)

## 💬 Support

- **💬 Discord**: [Join our community](https://discord.gg/pypeai)
- **📧 Email**: support@obsera.ai
- **🐛 Issues**: [GitHub Issues](https://github.com/PYPE-AI-MAIN/obsera/issues)

---

**🎉 You're now a dashboard expert!** Use these insights to optimize your voice AI applications and drive better results. 