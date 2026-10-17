#!/usr/bin/env python3
"""Force AndroidManifest to allow tablet rotation (portrait + landscape)."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    path = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else "android/app/src/main/AndroidManifest.xml"
    )
    if not path.exists():
        print(f"ERROR: missing {path}", file=sys.stderr)
        return 1

    text = path.read_text()

    # Unlock orientation for tablets like TL10 (was locked to portrait).
    if 'android:screenOrientation=' in text:
        text2, n = re.subn(
            r'android:screenOrientation="[^"]*"',
            'android:screenOrientation="fullUser"',
            text,
            count=1,
        )
        if n == 0:
            print("WARNING: screenOrientation attribute not replaced")
        else:
            text = text2
            print("Patched screenOrientation -> fullUser")
    else:
        text, n = re.subn(
            r"(<activity\b[^>]*android:name=\"\.MainActivity\"[^>]*)(>)",
            r'\1 android:screenOrientation="fullUser"\2',
            text,
            count=1,
            flags=re.S,
        )
        if n == 0:
            # Fallback: inject on first activity tag
            text, n = re.subn(
                r"(<activity\b)",
                r'\1 android:screenOrientation="fullUser"',
                text,
                count=1,
            )
        print(f"Injected screenOrientation fullUser (count={n})")

    # Help tablets/multi-window keep a normal layout
    if "android:resizeableActivity=" not in text:
        text = text.replace(
            'android:screenOrientation="fullUser"',
            'android:screenOrientation="fullUser" android:resizeableActivity="true"',
            1,
        )
        print("Added resizeableActivity=true")

    if 'android:configChanges="' in text and "orientation" not in text.split('android:configChanges="', 1)[1].split('"', 1)[0]:
        text = re.sub(
            r'android:configChanges="([^"]*)"',
            lambda m: f'android:configChanges="{m.group(1)}|orientation|screenSize|screenLayout|smallestScreenSize"',
            text,
            count=1,
        )
        print("Extended configChanges for rotation")

    path.write_text(text)
    print(f"Wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
