#!/bin/bash
# Clean previous builds
rm -rf dist/ build/ *.egg-info

# Build source and wheel distributions
python setup.py sdist bdist_wheel

# Upload to PyPI (asks for credentials if not configured)
twine upload dist/*
