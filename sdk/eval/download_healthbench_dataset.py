#!/usr/bin/env python3
"""
Download and cache HealthBench dataset locally to avoid repeated downloads
"""

import os
import json
import requests
from pathlib import Path

# HealthBench dataset URLs (from the original healthbench_eval.py)
DATASET_URLS = {
    "main": "https://openaipublic.blob.core.windows.net/simple-evals/healthbench/2025-05-07-06-14-12_oss_eval.jsonl",
    "hard": "https://openaipublic.blob.core.windows.net/simple-evals/healthbench/hard_2025-05-08-21-00-10.jsonl",
    "consensus": "https://openaipublic.blob.core.windows.net/simple-evals/healthbench/consensus_2025-05-09-20-00-46.jsonl"
}

def download_dataset(url: str, filename: str, cache_dir: Path) -> Path:
    """Download dataset if not already cached"""
    cache_file = cache_dir / filename
    
    if cache_file.exists():
        print(f"✅ Dataset already cached: {cache_file}")
        return cache_file
    
    print(f"📥 Downloading {filename}...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Ensure cache directory exists
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Download and save
        with open(cache_file, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"✅ Downloaded: {cache_file} ({cache_file.stat().st_size} bytes)")
        return cache_file
        
    except Exception as e:
        print(f"❌ Failed to download {filename}: {e}")
        return None

def load_cached_dataset(subset_name: str = None) -> list:
    """Load dataset from cache"""
    cache_dir = Path(__file__).parent / "healthbench_cache"
    
    # Determine which dataset to load
    if subset_name == "hard":
        filename = "healthbench_hard.jsonl"
        url = DATASET_URLS["hard"]
    elif subset_name == "consensus":
        filename = "healthbench_consensus.jsonl"
        url = DATASET_URLS["consensus"]
    else:
        filename = "healthbench_main.jsonl"
        url = DATASET_URLS["main"]
    
    # Download if not cached
    cache_file = download_dataset(url, filename, cache_dir)
    
    if not cache_file or not cache_file.exists():
        print(f"❌ Could not load dataset: {filename}")
        return []
    
    # Load and parse JSONL
    examples = []
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if line:
                    try:
                        example = json.loads(line)
                        examples.append(example)
                    except json.JSONDecodeError as e:
                        print(f"⚠️ Skipping invalid JSON on line {line_num}: {e}")
        
        print(f"✅ Loaded {len(examples)} examples from {filename}")
        return examples
        
    except Exception as e:
        print(f"❌ Error loading dataset {filename}: {e}")
        return []

def download_all_datasets():
    """Download all HealthBench datasets"""
    cache_dir = Path(__file__).parent / "healthbench_cache"
    
    print("📥 Downloading all HealthBench datasets...")
    
    datasets = {
        "main": ("healthbench_main.jsonl", DATASET_URLS["main"]),
        "hard": ("healthbench_hard.jsonl", DATASET_URLS["hard"]),
        "consensus": ("healthbench_consensus.jsonl", DATASET_URLS["consensus"])
    }
    
    for name, (filename, url) in datasets.items():
        print(f"\n📦 Processing {name} dataset...")
        cache_file = download_dataset(url, filename, cache_dir)
        
        if cache_file:
            # Validate the file
            examples = []
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            examples.append(json.loads(line.strip()))
                print(f"✅ Validated {len(examples)} examples in {name} dataset")
            except Exception as e:
                print(f"⚠️ Validation warning for {name}: {e}")
    
    print(f"\n🎉 All datasets cached in: {cache_dir}")
    print("\nDataset files:")
    if cache_dir.exists():
        for file in cache_dir.glob("*.jsonl"):
            size_mb = file.stat().st_size / (1024 * 1024)
            print(f"  - {file.name}: {size_mb:.1f} MB")

if __name__ == "__main__":
    print("🏥 HealthBench Dataset Downloader")
    print("=" * 40)
    
    # Download all datasets
    download_all_datasets()
    
    # Test loading
    print("\n🧪 Testing dataset loading...")
    for subset in [None, "hard", "consensus"]:
        examples = load_cached_dataset(subset)
        subset_name = subset or "main"
        print(f"  {subset_name}: {len(examples)} examples")
    
    print("\n✅ Setup complete! HealthBench datasets are now cached locally.")
