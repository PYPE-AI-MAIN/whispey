from setuptools import setup, find_packages

setup(
    name="pypehorus",
    version="1.0.0",
    author="Pype AI Voice Analytics",
    author_email="support@pype.ai",
    description="Voice Analytics SDK for AI Agents",
    long_description="Monitor, track, and analyze AI voice agent conversations with Pype's advanced analytics platform.",
    url="https://pypeai.com/home",
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
        "aiohttp>=3.8.0",
        "python-dotenv>=1.0.0",
    ],
    keywords="voice analytics, AI agents, conversation intelligence, pype"
)