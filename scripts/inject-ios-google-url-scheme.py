#!/usr/bin/env python3
"""
Set Info.plist CFBundleURLTypes for Google Sign-In from VITE_GOOGLE_IOS_CLIENT_ID.

The iOS OAuth client ID looks like: 123456789-abc.apps.googleusercontent.com
Apple expects the URL scheme (REVERSED_CLIENT_ID): com.googleusercontent.apps.123456789-abc

Run after `npx cap sync ios` (Codemagic: after Sync to iOS). Requires Python 3.9+.
"""
from __future__ import annotations

import os
import plistlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INFO_PLIST = REPO / "ios" / "App" / "App" / "Info.plist"
SUFFIX = ".apps.googleusercontent.com"


def reversed_client_id(ios_client_id: str) -> str:
    ios_client_id = ios_client_id.strip()
    if not ios_client_id:
        raise ValueError("empty client id")
    if ios_client_id.startswith("com.googleusercontent.apps."):
        return ios_client_id
    if not ios_client_id.endswith(SUFFIX):
        raise ValueError(
            f"expected *{SUFFIX} or com.googleusercontent.apps.*, got {ios_client_id!r}"
        )
    prefix = ios_client_id[: -len(SUFFIX)]
    return f"com.googleusercontent.apps.{prefix}"


def strip_placeholder_google_url_types(pl: dict) -> bool:
    """Remove placeholder / invalid Google URL schemes; return True if plist changed."""
    url_types = pl.get("CFBundleURLTypes")
    if not isinstance(url_types, list):
        return False
    filtered: list = []
    for entry in url_types:
        if isinstance(entry, dict):
            schemes = entry.get("CFBundleURLSchemes")
            if isinstance(schemes, list) and any(
                isinstance(s, str) and "REPLACE_WITH" in s for s in schemes
            ):
                continue
        filtered.append(entry)
    if not filtered and url_types:
        pl.pop("CFBundleURLTypes", None)
        return True
    if len(filtered) != len(url_types):
        pl["CFBundleURLTypes"] = filtered
        return True
    return False


def main() -> int:
    if not INFO_PLIST.is_file():
        print(f"Missing {INFO_PLIST}", file=sys.stderr)
        return 1

    raw = os.environ.get("VITE_GOOGLE_IOS_CLIENT_ID", "").strip()

    with INFO_PLIST.open("rb") as f:
        pl = plistlib.load(f)

    if raw.startswith("$") or raw == "${VITE_GOOGLE_IOS_CLIENT_ID}":
        print(
            "VITE_GOOGLE_IOS_CLIENT_ID is not resolved (value looks like a placeholder, e.g. '$VITE_GOOGLE_IOS_CLIENT_ID').\n"
            "In Codemagic → App → Environment variables → group appstore_credentials:\n"
            "  Add variable VITE_GOOGLE_IOS_CLIENT_ID with the real iOS OAuth client ID from Firebase\n"
            "  (format: 123456789-xxxxx.apps.googleusercontent.com). Do not paste the dollar-sign reference as the value.",
            file=sys.stderr,
        )
        return 1

    if not raw:
        print(
            "VITE_GOOGLE_IOS_CLIENT_ID not set; stripping invalid Google URL schemes if any.",
            file=sys.stderr,
        )
        if strip_placeholder_google_url_types(pl):
            with INFO_PLIST.open("wb") as f:
                plistlib.dump(pl, f, fmt=plistlib.FMT_XML)
            print(f"Updated {INFO_PLIST}")
        return 0

    scheme = reversed_client_id(raw)
    google_entry = {
        "CFBundleTypeRole": "Editor",
        "CFBundleURLName": "Google",
        "CFBundleURLSchemes": [scheme],
    }

    url_types = pl.get("CFBundleURLTypes")
    if not isinstance(url_types, list):
        pl["CFBundleURLTypes"] = [google_entry]
    else:
        replaced = False
        for i, entry in enumerate(url_types):
            if isinstance(entry, dict) and entry.get("CFBundleURLName") == "Google":
                url_types[i] = google_entry
                replaced = True
                break
        if not replaced:
            url_types.append(google_entry)

    with INFO_PLIST.open("wb") as f:
        plistlib.dump(pl, f, fmt=plistlib.FMT_XML)

    print(f"Set Google CFBundleURLSchemes to {scheme!r} in {INFO_PLIST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
