# ❓ Frequently Asked Questions

Common questions and answers about Obsera voice analytics platform.

## 🚀 Getting Started

### Q: How do I get started with Obsera?

**A:** Getting started is easy! Follow these steps:

1. **Sign up** at [https://pype-voice-analytics-dashboard.vercel.app](https://pype-voice-analytics-dashboard.vercel.app)
2. **Create a project** and add an agent
3. **Get your Agent ID** from the dashboard
4. **Generate an API key** from your account settings
5. **Install the SDK**: `pip install obsera`
6. **Integrate** with your LiveKit agent

See our [Getting Started Guide](getting-started.md) for detailed instructions.

### Q: What are the system requirements?

**A:** Obsera requires:

- **Python 3.8+** for the SDK
- **LiveKit Agents 1.2.2+** for integration
- **Modern web browser** for the dashboard
- **Internet connection** for data synchronization

### Q: Is Obsera free to use?

**A:** Obsera offers both free and paid tiers:

- **Free Tier**: 100 calls/month, basic analytics
- **Pro Tier**: $49/month, unlimited calls, advanced features
- **Enterprise**: Custom pricing, dedicated support

## 🔧 Integration & SDK

### Q: How do I integrate Obsera with my existing LiveKit agent?

**A:** Integration is straightforward:

```python
from obsera import LivekitObserve

# Initialize with your agent ID
obsera = LivekitObserve(agent_id="your-agent-id")

# Start tracking
session_id = obsera.start_session(session)

# Export on shutdown
async def shutdown():
    await obsera.export(session_id)

ctx.add_shutdown_callback(shutdown)
```

### Q: Does Obsera affect my agent's performance?

**A:** No, Obsera is designed to be lightweight and non-intrusive:

- **Minimal overhead**: <1% performance impact
- **Asynchronous**: Data collection happens in background
- **Non-blocking**: Doesn't interfere with your agent's responses
- **Optional**: You can disable tracking for specific sessions

### Q: What data does Obsera collect?

**A:** Obsera collects comprehensive metrics:

- **🎙️ Speech-to-Text**: Audio duration, processing time, accuracy
- **🧠 LLM**: Token usage, response time, costs
- **🗣️ Text-to-Speech**: Character count, audio duration, quality
- **⏱️ Timing**: Turn-taking, response latency
- **💰 Costs**: Real-time cost tracking across providers

### Q: Is my conversation data secure?

**A:** Yes, security is our top priority:

- **End-to-end encryption** for data in transit
- **SOC 2 compliant** infrastructure
- **GDPR compliant** data handling
- **Self-hosting option** for complete data control
- **No sensitive data** stored in plain text

## 📊 Dashboard & Analytics

### Q: How long does it take for data to appear in the dashboard?

**A:** Data typically appears within 1-2 minutes:

- **Real-time metrics**: Updated every 30 seconds
- **Call data**: Available within 1 minute of completion
- **Cost tracking**: Updated in real-time
- **Analytics**: Processed within 5 minutes

### Q: Can I export my data?

**A:** Yes, multiple export options are available:

- **CSV export** for spreadsheet analysis
- **JSON export** for custom integrations
- **API access** for automated data retrieval
- **Scheduled exports** for regular reporting

### Q: How accurate are the cost calculations?

**A:** Cost calculations are highly accurate:

- **Real-time pricing** from all major providers
- **Token-level tracking** for precise billing
- **Provider-specific rates** for accurate calculations
- **Historical rate tracking** for trend analysis

### Q: Can I compare different agents or versions?

**A:** Yes, Obsera provides comprehensive comparison tools:

- **Agent comparison** across different versions
- **A/B testing** support for performance analysis
- **Cost comparison** between different configurations
- **Performance benchmarking** against industry standards

## 💰 Billing & Costs

### Q: How is Obsera priced?

**A:** Obsera uses a simple pricing model:

- **Free Tier**: 100 calls/month
- **Pro Tier**: $49/month, unlimited calls
- **Enterprise**: Custom pricing based on volume
- **Self-hosted**: One-time setup fee

### Q: Do I pay for failed calls?

**A:** No, you only pay for successful data collection:

- **Failed calls**: Not charged
- **Partial data**: Charged proportionally
- **Test calls**: Can be marked as non-billable
- **Development**: Separate billing for dev environments

### Q: Can I set spending limits?

**A:** Yes, multiple ways to control costs:

- **Daily limits**: Set maximum daily spending
- **Per-call limits**: Limit cost per individual call
- **Alert thresholds**: Get notified when limits are reached
- **Automatic shutdown**: Stop tracking when limits exceeded

## 🔒 Security & Privacy

### Q: Where is my data stored?

**A:** Data storage options:

- **Cloud hosting**: AWS/GCP with SOC 2 compliance
- **Self-hosting**: Your own infrastructure
- **Regional options**: Choose data center location
- **Backup**: Automatic daily backups

### Q: Can I self-host Obsera?

**A:** Yes, complete self-hosting is supported:

- **Docker deployment** for easy setup
- **Manual installation** for custom configurations
- **Database options**: PostgreSQL or Supabase
- **Full control** over your data

See our [Self-hosting Guide](self-hosting.md) for detailed instructions.

### Q: Is Obsera GDPR compliant?

**A:** Yes, Obsera is fully GDPR compliant:

- **Data portability**: Export all your data
- **Right to deletion**: Remove data on request
- **Consent management**: Clear data usage policies
- **Audit trails**: Complete data access logs

## 🛠️ Technical Support

### Q: What if my data isn't appearing?

**A:** Common troubleshooting steps:

1. **Check API key**: Verify it's correct and active
2. **Check agent ID**: Ensure it matches your dashboard
3. **Check network**: Ensure internet connectivity
4. **Check logs**: Enable debug mode for detailed logs
5. **Contact support**: If issues persist

### Q: How do I get help with integration?

**A:** Multiple support channels available:

- **📖 Documentation**: Comprehensive guides and examples
- **💬 Discord**: Active community for quick help
- **📧 Email**: support@obsera.ai for detailed support
- **🐛 GitHub**: Open issues for bugs and feature requests

### Q: Can I customize the analytics?

**A:** Yes, extensive customization options:

- **Custom metrics**: Define your own KPIs
- **Custom dashboards**: Build personalized views
- **API integration**: Connect with your existing tools
- **Webhook notifications**: Real-time alerts

## 🚀 Advanced Features

### Q: Does Obsera support multiple languages?

**A:** Yes, full multilingual support:

- **All major languages** supported
- **Automatic language detection**
- **Language-specific analytics**
- **Multi-language agent support**

### Q: Can I integrate with other tools?

**A:** Yes, extensive integration options:

- **Slack notifications** for alerts
- **Zapier integration** for automation
- **Webhook support** for custom integrations
- **API access** for custom development

### Q: Does Obsera work with all voice providers?

**A:** Yes, Obsera supports all major providers:

- **STT**: OpenAI Whisper, Deepgram, Azure, Google
- **TTS**: ElevenLabs, Azure, Google, Amazon Polly
- **LLM**: OpenAI, Anthropic, Google, Azure
- **Custom providers**: API for custom integrations

### Q: Can I use Obsera for non-voice AI?

**A:** Currently, Obsera is optimized for voice AI:

- **Voice-specific metrics** and analytics
- **Audio quality analysis**
- **Speech-to-text accuracy**
- **Voice agent optimization**

## 📈 Performance & Scalability

### Q: How many calls can Obsera handle?

**A:** Obsera is built for scale:

- **Free tier**: 100 calls/month
- **Pro tier**: Unlimited calls
- **Enterprise**: Millions of calls per month
- **Real-time processing**: No delays in analytics

### Q: What's the latency impact?

**A:** Minimal latency impact:

- **<1% overhead** on response times
- **Asynchronous processing** for data collection
- **Non-blocking operations** for real-time responses
- **Optimized SDK** for minimal resource usage

### Q: Can I use Obsera in production?

**A:** Yes, Obsera is production-ready:

- **99.9% uptime** SLA
- **Enterprise-grade** infrastructure
- **Production deployments** worldwide
- **24/7 monitoring** and support

## 🔄 Updates & Roadmap

### Q: How often is Obsera updated?

**A:** Regular updates and improvements:

- **Weekly updates** for bug fixes
- **Monthly releases** for new features
- **Quarterly major releases** for significant improvements
- **Continuous monitoring** and optimization

### Q: What's coming next?

**A:** Exciting features in development:

- **Multi-language SDKs** (JavaScript, Go, Rust)
- **Advanced ML insights** and anomaly detection
- **Mobile app** for monitoring on-the-go
- **GraphQL API** for flexible data access
- **Custom webhook integrations**

### Q: How can I request features?

**A:** Multiple ways to contribute:

- **💬 Discord**: Join discussions and share ideas
- **🐛 GitHub**: Open feature requests
- **📧 Email**: Send detailed proposals
- **Community voting**: Vote on upcoming features

## 💬 Community & Support

### Q: Is there a community I can join?

**A:** Yes, vibrant community available:

- **💬 Discord**: Active community with 1000+ members
- **🐛 GitHub**: Open source contributions welcome
- **📧 Email**: Direct support from the team
- **📱 Twitter**: Follow for updates and tips

### Q: How can I contribute to Obsera?

**A:** Multiple ways to contribute:

- **Code contributions**: Submit pull requests
- **Documentation**: Help improve guides
- **Bug reports**: Report issues you find
- **Feature ideas**: Suggest new features
- **Community support**: Help other users

### Q: Is Obsera open source?

**A:** Obsera is open source with commercial support:

- **MIT license** for the core platform
- **Open source SDK** available on GitHub
- **Community contributions** welcome
- **Commercial support** for enterprise users

---

**Still have questions?** Join our [Discord community](https://discord.gg/pypeai) or email support@obsera.ai for personalized help! 