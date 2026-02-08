#!/usr/bin/env python3
"""
Sandbars Weather Data Ingestion Pipeline

Usage:
    python main.py [command]

Commands:
    ndbc       - Fetch NDBC buoy observations
    wavewatch  - Fetch WAVEWATCH III global wave data
    all        - Run all ingestion tasks
"""
import sys
from models.ndbc import ingest_ndbc
from models.wavewatch import ingest_wavewatch


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == 'ndbc':
        print("=" * 50)
        print("NDBC Buoy Ingestion")
        print("=" * 50)
        ingest_ndbc()

    elif command == 'wavewatch' or command == 'ww3':
        print("=" * 50)
        print("WAVEWATCH III Ingestion")
        print("=" * 50)
        ingest_wavewatch()

    elif command == 'all':
        print("=" * 50)
        print("Running All Ingestion Tasks")
        print("=" * 50)

        print("\n--- NDBC Buoy Data ---")
        ingest_ndbc()

        print("\n--- WAVEWATCH III Data ---")
        ingest_wavewatch()

        print("\n" + "=" * 50)
        print("All ingestion tasks complete!")
        print("=" * 50)

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
