#!/usr/bin/env python3
"""
Configure Android builds to use the stable project keystore.

Why: GitHub Actions creates a fresh debug.keystore on every runner. Signing each
APK with a different cert makes Android refuse in-place updates ("App not
installed" / erro ao atualizar). Using android-signing/solar-calculator.keystore
keeps the certificate identical across releases.
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path


SIGNING_CONFIGS = """    signingConfigs {
        release {
            def keystorePropertiesFile = rootProject.file("keystore.properties")
            def keystoreProperties = new java.util.Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(new java.io.FileInputStream(keystorePropertiesFile))
            }
            storeFile file(keystoreProperties['storeFile'] ?: "solar-calculator.keystore")
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }"""


def find_block(text: str, keyword: str, start_at: int = 0) -> tuple[int, int] | None:
    """Return [start, end) spanning `keyword { ... }` with balanced braces."""
    match = re.search(rf"\b{re.escape(keyword)}\s*\{{", text[start_at:])
    if not match:
        return None
    abs_start = start_at + match.start()
    brace = start_at + match.end() - 1
    depth = 0
    for i in range(brace, len(text)):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return abs_start, i + 1
    raise RuntimeError(f"unbalanced braces for {keyword}")


def indent_of(text: str, index: int) -> str:
    line_start = text.rfind("\n", 0, index) + 1
    spaces = []
    for ch in text[line_start:index]:
        if ch in (" ", "\t"):
            spaces.append(ch)
        else:
            break
    return "".join(spaces)


def replace_signing_configs(text: str) -> str:
    block = find_block(text, "signingConfigs")
    if block:
        start, end = block
        indent = indent_of(text, start)
        replacement = SIGNING_CONFIGS.replace("    ", indent)
        return text[:start] + replacement + text[end:]

    bt = find_block(text, "buildTypes")
    if not bt:
        raise RuntimeError("could not find signingConfigs or buildTypes")
    start, _ = bt
    indent = indent_of(text, start)
    replacement = SIGNING_CONFIGS.replace("    ", indent)
    return text[:start] + replacement + "\n\n" + indent + text[start:]


def patch_build_type_signing(text: str, build_type: str) -> str:
    bt = find_block(text, "buildTypes")
    if not bt:
        raise RuntimeError("buildTypes not found")
    bt_start, bt_end = bt
    inner = text[bt_start:bt_end]

    # Search only inside buildTypes for the named type
    match = re.search(rf"\b{re.escape(build_type)}\s*\{{", inner)
    if not match:
        print(f"WARNING: buildTypes.{build_type} not found", file=sys.stderr)
        return text

    local_brace = match.end() - 1
    depth = 0
    local_end = None
    for i in range(local_brace, len(inner)):
        ch = inner[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                local_end = i
                break
    if local_end is None:
        raise RuntimeError(f"unbalanced buildTypes.{build_type}")

    header = inner[match.start() : local_brace + 1]
    body = inner[local_brace + 1 : local_end]
    body = re.sub(r"\n[ \t]*signingConfig\s+[^\n]+", "", body)
    body = "\n            signingConfig signingConfigs.release" + body
    new_inner = inner[: match.start()] + header + body + inner[local_end:]
    return text[:bt_start] + new_inner + text[bt_end:]


def main() -> int:
    gradle_path = Path(sys.argv[1] if len(sys.argv) > 1 else "android/app/build.gradle")
    if not gradle_path.exists():
        print(f"ERROR: missing {gradle_path}", file=sys.stderr)
        return 1

    app_dir = gradle_path.parent.resolve()
    android_dir = app_dir.parent
    project_root = android_dir.parent

    src_keystore = project_root / "android-signing" / "solar-calculator.keystore"
    if not src_keystore.exists():
        print(f"ERROR: missing stable keystore at {src_keystore}", file=sys.stderr)
        return 1

    dest_keystore = app_dir / "solar-calculator.keystore"
    dest_props = android_dir / "keystore.properties"
    shutil.copy2(src_keystore, dest_keystore)
    dest_props.write_text(
        "storeFile=solar-calculator.keystore\n"
        "storePassword=solarcalc2026\n"
        "keyAlias=solarcalculator\n"
        "keyPassword=solarcalc2026\n"
    )
    print(f"Copied keystore -> {dest_keystore}")
    print(f"Wrote properties -> {dest_props}")

    try:
        text = gradle_path.read_text()
        text = replace_signing_configs(text)
        text = patch_build_type_signing(text, "debug")
        text = patch_build_type_signing(text, "release")
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    # Validate: signingConfigs.release must define storeFile (not a signingConfig line)
    sc = find_block(text, "signingConfigs")
    if not sc:
        print("ERROR: signingConfigs missing after patch", file=sys.stderr)
        return 1
    sc_body = text[sc[0] : sc[1]]
    if "storeFile" not in sc_body:
        print("ERROR: signingConfigs.release missing storeFile", file=sys.stderr)
        return 1
    if re.search(r"signingConfigs\s*\{[^}]*signingConfig\s+", sc_body, re.S):
        # Avoid nested signingConfig assignment inside signingConfigs
        if "signingConfig signingConfigs" in sc_body:
            print("ERROR: signingConfig line leaked into signingConfigs block", file=sys.stderr)
            return 1

    bt = find_block(text, "buildTypes")
    assert bt is not None
    bt_body = text[bt[0] : bt[1]]
    if bt_body.count("signingConfig signingConfigs.release") < 2:
        print("ERROR: debug+release must use signingConfigs.release", file=sys.stderr)
        print(bt_body, file=sys.stderr)
        return 1
    if "signingConfigs.debug" in bt_body:
        print("ERROR: buildTypes still references signingConfigs.debug", file=sys.stderr)
        return 1

    gradle_path.write_text(text)
    print(f"Patched {gradle_path}: debug/release use stable signingConfigs.release")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
