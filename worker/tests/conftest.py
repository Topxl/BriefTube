"""pytest configuration for BriefTube worker tests."""

import sys
from pathlib import Path

# Add worker directory to sys.path so tests can import worker modules directly
sys.path.insert(0, str(Path(__file__).parent.parent))
