<p align="center">
  <b>🔮 PypeHorus – Voice AI Observability Platform</b>
</p>


<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-v3.8+-blue.svg)](https://www.python.org/downloads/)
[![PyPI version](https://badge.fury.io/py/pypehorus.svg)](https://badge.fury.io/py/pypehorus)
[![Documentation](https://img.shields.io/badge/docs-available-brightgreen.svg)](https://pype-voice-analytics-dashboard.vercel.app/docs)

**Track, analyze, and improve your Voice AI applications with beautiful dashboards and actionable insights.**

[📊 Live Demo](https://pype-voice-analytics-dashboard.vercel.app) • [📖 Documentation](https://pype-voice-analytics-dashboard.vercel.app/docs) • [💬 Discord](https://discord.gg/pypeai)
</div>

<div align="center">
    <img width="748" height="348" alt="Screenshot 2025-08-05 at 8 22 16 PM" src="https://github.com/user-attachments/assets/6de46186-2999-4278-a1ab-55088509e345" />
</div>

## ✨ Features

- **🔍 Real-time Monitoring** - Track every voice interaction with comprehensive analytics
- **💰 Cost Tracking** - Monitor STT, TTS, and LLM costs across all providers
- **⚡ Performance Metrics** - Analyze latency, response times, and quality scores
- **🎯 Multi-Project Support** - Organize and compare multiple voice AI applications
- **📈 Beautiful Dashboards** - Intuitive visualizations with customizable views
- **🔒 Privacy-First** - Self-host option with complete data control
- **📤 Data Export** - Export analytics to CSV for further analysis
- **🔧 Easy Integration** - One-line SDK integration with LiveKit agents

## 🚀 Quick Start

### Cloud Platform (Recommended)

Get started in under 2 minutes with our hosted platform:

```bash
# Install the SDK
pip install pypehorus
```

```python
from pypehorus import LivekitObserve

# Initialize observability
pype = LivekitObserve(agent_id="your-agent-id")

# Wrap your LiveKit session
session = AgentSession(...)
session_id = pype.start_session(session, phone_number="+1234567890")

# Ensure data is exported on shutdown
async def pype_observe_shutdown():
    await pype.export(session_id)

ctx.add_shutdown_callback(pype_observe_shutdown)
await session.start(...)
```

**📊 View your analytics:** [https://pype-voice-analytics-dashboard.vercel.app](https://pype-voice-analytics-dashboard.vercel.app)

### Self-Hosted Installation

For complete control over your data, deploy PypeHorus on your own infrastructure:

```bash
# Clone and setup
git clone https://github.com/PYPE-AI-MAIN/horus
cd horus
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase and Clerk credentials

# Run development server
npm run dev
```

**🔧 Detailed setup guide:** [Self-hosting Documentation](docs/self-hosting.md)

## 🏗️ Architecture

PypeHorus consists of three main components:

- **Python SDK** - Lightweight library for data collection
- **Dashboard** - Next.js web application for analytics visualization  
- **Backend** - Supabase for data storage and real-time updates

## 📊 What You Can Track

| Metric | Description | Providers |
|--------|-------------|-----------|
| **Latency** | Response times for each component | All STT/TTS/LLM providers |
| **Costs** | Token usage and billing across services | OpenAI, Anthropic, Google, Azure |
| **Quality** | Transcription accuracy, response relevance | Custom scoring algorithms |
| **Usage** | Call volume, session duration, user patterns | Built-in analytics |

## 🎯 Use Cases

- **Production Monitoring** - Keep voice AI applications running smoothly
- **Cost Optimization** - Identify expensive operations and optimize spending
- **Quality Assurance** - Review call transcripts and agent responses
- **Performance Debugging** - Diagnose latency issues and bottlenecks
- **Business Intelligence** - Generate reports for stakeholders

## 🛠️ Technology Stack

- **Frontend:** Next.js 14, React, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL + Real-time)
- **Authentication:** Clerk.dev
- **SDK:** Python 3.8+, asyncio
- **Analytics:** Custom metrics engine
- **Deployment:** Vercel, Docker support

## 📚 Documentation

- [🚀 Getting Started Guide](docs/getting-started.md)
- [🔧 SDK Reference](docs/sdk-reference.md)
- [🏠 Self-hosting Guide](docs/self-hosting.md)
- [📊 Dashboard Tutorial](docs/dashboard-guide.md)
- [🔌 API Documentation](docs/api-reference.md)
- [❓ FAQ](docs/faq.md)

## 🤝 Contributing

We welcome contributions from the community! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests
4. **Run the test suite:** `npm test`
5. **Commit your changes:** `git commit -m 'Add amazing feature'`
6. **Push to the branch:** `git push origin feature/amazing-feature`
7. **Open a Pull Request**

Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 🔒 Security

Security is a top priority for PypeHorus. We implement:

- **End-to-end encryption** for data in transit
- **SOC 2 compliant** infrastructure partners
- **Regular security audits** and dependency updates
- **Privacy-first design** with optional self-hosting

Found a security issue? Please email security@pypeai.com instead of opening a public issue.

## 📈 Roadmap

- [ ] Multi-language SDK support (JavaScript, Go, Rust)
- [ ] Advanced ML-powered insights and anomaly detection
- [ ] Slack/Discord integrations for alerts
- [ ] GraphQL API
- [ ] Mobile app for monitoring on-the-go
- [ ] Custom webhook integrations

See our [public roadmap](https://github.com/PYPE-AI-MAIN/horus/projects/1) for more details.

## 💬 Community & Support

- **🐛 Bug Reports:** [GitHub Issues](https://github.com/PYPE-AI-MAIN/horus/issues)
- **💡 Feature Requests:** [GitHub Discussions](https://github.com/PYPE-AI-MAIN/horus/discussions)
- **💬 Chat:** [Discord Community](https://discord.gg/pypeai)
- **📧 Email:** support@pypeai.com
- **📱 Twitter:** [@PypeAI](https://twitter.com/PypeAI)

## 🏢 Enterprise

Need enterprise features like SSO, custom deployments, or dedicated support? 

**Contact us:** enterprise@pypeai.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ by the [Pype AI](https://pypeai.com) team
- Inspired by the observability tools from Datadog, New Relic, and Honeycomb
- Special thanks to the LiveKit community for their amazing real-time infrastructure
- Icons by [Lucide](https://lucide.dev)

---

<div align="center">

**⭐ Star us on GitHub if PypeHorus helps your voice AI applications!**

[⬆ Back to top](#-pypehorus--voice-ai-observability-platform)

</div>
