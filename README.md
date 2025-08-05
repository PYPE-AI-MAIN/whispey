# 🔮 PypeHorus – Voice AI Observability Platform

**Track, analyze, and improve your Voice AI applications with beautiful dashboards and actionable insights.**
Use our hosted cloud platform, or self-host with Supabase + Clerk.

---

## 🚀 Quick Start (Cloud Option)

Want to skip setup and start sending data instantly?

👉 Use our hosted dashboard:
**🌐 [https://pype-voice-analytics-dashboard.vercel.app](https://pype-voice-analytics-dashboard.vercel.app)**
📦 PyPI SDK: **[pypehorus on PyPI](https://pypi.org/project/pypehorus/1.0.0/)**

### Install the SDK

```bash
pip install pypehorus
```

### ⚙️ Setup Observability in Your LiveKit Agent


```python
from pypehorus import LivekitObserve

# Instantiate once (usually at the top of your entrypoint)
pype = LivekitObserve(agent_id="your-agent-id")
```

###  🔁 Wrap Session Lifecycle

```python
session = AgentSession(...)  # Your configured LiveKit agent session

# Start tracking (you can optionally add a phone number or recording URL)
session_id = pype.start_session(session, phone_number="+1234567890")

# Ensure observability data is sent on shutdown
async def pype_observe_shutdown():
    await pype.export(session_id)

ctx.add_shutdown_callback(pype_observe_shutdown)

# Start your session as usual
await session.start(...)

```

➡️ Analytics will show up in the cloud dashboard.

---

## 🛠 Self-Host Option

You can also host the entire platform yourself using:

* 🔗 **Supabase** (for DB & Auth)
* 🙋 **Clerk.dev** (for user management)
* 💻 **Next.js** frontend (dashboard)

---

### 1. Clone the Repo & Install

```bash
git clone https://github.com/PYPE-AI-MAIN/horus
cd horus
npm install
```

---

### 2. Set Up Supabase

1. Go to [https://supabase.com](https://supabase.com) and create a project
2. Open the SQL editor → paste `setup-supabase.sql` from the repo
3. Get your **Project URL** and **Anon/public key**

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

---

### 3. Set Up Clerk

1. Go to [https://clerk.dev](https://clerk.dev) and create an account
2. Configure your instance:

   * Allowed domains: `localhost`, `your-domain.com`
   * Copy **frontend API** and **publishable key**

```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret
```

---

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📊 Features

✅ View analytics for every call
✅ Track STT, TTS, and LLM latency/costs
✅ Filter by agent, date, call reason, etc.
✅ Column customization, saved views, CSV export
✅ Multi-project support
✅ Built with Supabase, Clerk, Next.js, Tailwind

---

## 💡 Use Cases

* Monitor **Voice AI bots** in production
* Audit call transcripts for compliance
* Debug agent behavior and latency
* Track **costs across STT, TTS, LLMs**
* Visualize real-time agent performance

---

## 🤝 Contributing

We welcome contributions!
To get started:

```bash
git clone https://github.com/PYPE-AI-MAIN/horus
npm install
```

Then follow the [self-host guide above](#self-host-option).

---

## 🧠 Credits

Built by [Pype AI](https://pypeai.com)
MIT Licensed

---

Would you like me to also generate a clean `setup.py` / `pyproject.toml` and badge set (`Made with Supabase`, `Deploy on Vercel`, etc.)?
