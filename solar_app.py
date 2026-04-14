"""
Solar Presentation App — Master Deck metadata (60 slides, indices 0–59).

Use this module for mail-merge / deck automation (e.g. python-pptx) so slide
picks stay aligned with the numbered master.
"""

from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict

SLIDE_COUNT = 60
FIRST_SLIDE_INDEX = 0
LAST_SLIDE_INDEX = 59

Language = Optional[Literal["ENGLISH", "SPANISH"]]
Brand = Optional[Literal["EMT SOLAR", "Big Wave"]]
Roof = Optional[Literal["ROOF"]]
UtilityName = Literal["ACE", "PSE&G", "JCP&L"]
Utility = Optional[UtilityName]
Panel = Optional[Literal["Q cell", "JA SOLAR"]]
Inverter = Optional[Literal["IQ8HC", "IQ8MC"]]


class SlideMeta(TypedDict):
    language: Language
    brand: Brand
    roof: Roof
    utility: Utility
    panel: Panel
    inverter: Inverter


def _row(
    language: Language = None,
    brand: Brand = None,
    roof: Roof = None,
    utility: Utility = None,
    panel: Panel = None,
    inverter: Inverter = None,
) -> SlideMeta:
    return {
        "language": language,
        "brand": brand,
        "roof": roof,
        "utility": utility,
        "panel": panel,
        "inverter": inverter,
    }


# One entry per slide index (0 … 59), matching the Master Deck spreadsheet.
SLIDE_METADATA: list[SlideMeta] = [
    _row(),
    _row(),
    _row(language="ENGLISH", brand="Big Wave"),
    _row(language="SPANISH", brand="Big Wave"),
    _row(language="ENGLISH", brand="Big Wave"),
    _row(language="SPANISH", brand="Big Wave"),
    _row(language="ENGLISH", brand="Big Wave", roof="ROOF"),
    _row(language="SPANISH", brand="Big Wave", roof="ROOF"),
    _row(brand="Big Wave", roof="ROOF"),
    _row(language="ENGLISH", brand="EMT SOLAR"),
    _row(language="ENGLISH", brand="EMT SOLAR"),
    _row(language="SPANISH", brand="EMT SOLAR"),
    _row(language="ENGLISH", brand="EMT SOLAR", roof="ROOF"),
    _row(language="SPANISH", brand="EMT SOLAR", roof="ROOF"),
    _row(brand="EMT SOLAR", roof="ROOF"),
    _row(roof="ROOF"),
    _row(utility="ACE"),
    _row(utility="PSE&G"),
    _row(utility="JCP&L"),
    _row(utility="PSE&G"),
    _row(utility="ACE"),
    _row(utility="JCP&L"),
    _row(),
    _row(language="ENGLISH"),
    _row(language="SPANISH"),
    _row(language="ENGLISH"),
    _row(language="SPANISH"),
    _row(language="ENGLISH", utility="ACE"),
    _row(language="SPANISH", utility="ACE"),
    _row(language="ENGLISH", utility="PSE&G"),
    _row(language="SPANISH", utility="PSE&G"),
    _row(language="ENGLISH", utility="JCP&L"),
    _row(language="SPANISH", utility="JCP&L"),
    _row(language="ENGLISH"),
    _row(language="SPANISH"),
    _row(utility="PSE&G"),
    _row(utility="ACE"),
    _row(utility="JCP&L"),
    _row(),
    _row(),
    _row(),
    _row(language="ENGLISH"),
    _row(language="SPANISH"),
    _row(),
    _row(),
    _row(inverter="IQ8HC"),
    _row(panel="Q cell"),
    _row(inverter="IQ8MC"),
    _row(panel="JA SOLAR"),
    _row(),
    _row(),
    _row(language="ENGLISH"),
    _row(language="SPANISH"),
    _row(language="ENGLISH"),
    _row(language="ENGLISH"),
    _row(language="ENGLISH"),
    _row(language="ENGLISH", brand="EMT SOLAR"),
    _row(language="ENGLISH", brand="EMT SOLAR"),
    _row(language="SPANISH", brand="EMT SOLAR"),
    _row(language="SPANISH", brand="EMT SOLAR"),
]

assert len(SLIDE_METADATA) == SLIDE_COUNT, "SLIDE_METADATA must have 60 entries"

# --- Merge helpers (e.g. formatted $/kWh from WattWalker CSV) ---

# Utility-only block near start of deck (no language column on master).
PRICE_MERGE_SLIDE_INDICES: tuple[int, ...] = (16, 17, 18, 19, 20, 21)

# Bilingual slides that also carry a utility label (EN then ES pairs).
UTILITY_BILINGUAL_SLIDES: dict[UtilityName, tuple[int, int]] = {
    "ACE": (27, 28),
    "PSE&G": (29, 30),
    "JCP&L": (31, 32),
}

# Additional utility-only slides later in the deck.
UTILITY_EXTRA_SLIDE_INDICES: tuple[int, ...] = (35, 36, 37)

# Hardware callout slides (panel / inverter).
PANEL_SLIDE_INDICES: tuple[int, ...] = (46, 48)
INVERTER_SLIDE_INDICES: tuple[int, ...] = (45, 47)


def slide_meta(index: int) -> SlideMeta:
    if index < 0 or index >= SLIDE_COUNT:
        raise IndexError(f"slide index {index} out of range 0–{LAST_SLIDE_INDEX}")
    return SLIDE_METADATA[index]


def slides_matching(**kwargs: Any) -> list[int]:
    """Return sorted indices where every non-None kwarg equals the slide field."""
    out: list[int] = []
    for i, m in enumerate(SLIDE_METADATA):
        ok = True
        for key, want in kwargs.items():
            if want is None:
                continue
            if m.get(key) != want:  # type: ignore[union-attr]
                ok = False
                break
        if ok:
            out.append(i)
    return out


def all_price_merge_indices() -> tuple[int, ...]:
    """Every slide index that may carry the canonical price-per-kWh merge field."""
    s = set(PRICE_MERGE_SLIDE_INDICES)
    s.update(UTILITY_EXTRA_SLIDE_INDICES)
    for pair in UTILITY_BILINGUAL_SLIDES.values():
        s.update(pair)
    return tuple(sorted(s))
