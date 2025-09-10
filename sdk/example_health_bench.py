#!/usr/bin/env python3
"""
Simple HealthBench Example
"""

from whispey import LivekitObserve

def main():
    print("Simple HealthBench Example")
    print("=" * 30)
    
    # Initialize with HealthBench
    pype = LivekitObserve(
        agent_id="your-agent-id",
        apikey="your-api-key", 
        eval="healthbench"
    )
    
    print("✅ HealthBench enabled!")
    print("📊 Evaluation runs automatically")
    print("📋 Results in metadata['evaluation']")

if __name__ == "__main__":
    main()