from setuptools import setup, find_packages

setup(
    name="Whispey",
    version="2.8.0",
    author="Whispey AI Voice Analytics",
    author_email="deepesh@pypeai.com",
    description="Voice Analytics SDK for AI Agents",
    long_description="Monitor, track, and analyze AI voice agent conversations with Whispey's advanced analytics platform.",
    url="https://whispey.xyz/",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.8",
    install_requires=[
        "livekit-agents>=1.2.2",
        "livekit-plugins-openai",
        "livekit-plugins-deepgram", 
        "livekit-plugins-elevenlabs",
        "livekit-plugins-silero",
        "livekit-plugins-cartesia",
        "livekit-plugins-turn-detector",
        "opentelemetry-api",
        "opentelemetry-sdk", 
        "opentelemetry-exporter-otlp",
        "aiohttp>=3.8.0",
        "python-dotenv>=1.0.0",
    ],
    keywords="voice analytics, AI agents, conversation intelligence, whispey"
)