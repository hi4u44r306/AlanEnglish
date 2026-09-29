#!/usr/bin/env python3
"""Build a conservative removal plan from classified Workbook audio events."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


EFFECT_LABEL_TOKENS = (
    "music",
    "sound effect",
    "ding",
    "clang",
    "beep",
    "bleep",
    "ping",
    "bell",
    "chime",
    "spray",
    "meow",
    "moo",
    "animal",
    "hiss",
    "snake",
    "hoot",
    "howl",
    "explosion",
    "horn",
    "buzz",
    "whistle",
    "violin",
    "crow",
    "squawk",
    "rub",
    "static",
    "cacophony",
)


def decision(row: dict[str, str]) -> tuple[str, str]:
    classification = row["audioset_classification"]
    duration = float(row["duration_seconds"])
    peak_db = float(row["peak_dbfs"])
    speech_score = float(row["audioset_speech_score"])
    top_labels = row["audioset_top_labels"].lower()
    has_effect_label = any(token in top_labels for token in EFFECT_LABEL_TOKENS)

    if classification == "confirmed_sfx_stereo" and speech_score <= 0.15:
        return "remove_high_confidence", "stereo_effect_with_low_vad"
    if classification == "confirmed_sfx_stereo":
        return "manual_review", "stereo_effect_overlaps_possible_speech"
    if (
        classification == "manual_review_non_speech"
        and duration >= 0.30
        and peak_db >= -32.0
        and speech_score <= 0.08
        and has_effect_label
    ):
        return "remove_high_confidence", "audioset_effect_low_speech_score"
    if (
        classification == "manual_review_non_speech"
        and duration >= 0.20
        and peak_db >= -20.0
        and speech_score <= 0.05
        and has_effect_label
    ):
        return "remove_high_confidence", "loud_effect_low_speech_score"
    if classification == "manual_review_non_speech":
        return "manual_review", "insufficient_evidence_for_automatic_edit"
    if classification == "inaudible_or_codec_noise":
        return "keep", "below_audible_review_threshold"
    return "keep", "classified_as_speech"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--classified-events", type=Path, required=True)
    parser.add_argument("--output-csv", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    args = parser.parse_args()

    with args.classified_events.open("r", encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))

    decisions = Counter()
    output_rows: list[dict[str, str]] = []
    affected_files: set[str] = set()
    for row in rows:
        action, reason = decision(row)
        enriched = dict(row)
        enriched["review_action"] = action
        enriched["review_reason"] = reason
        output_rows.append(enriched)
        decisions[action] += 1
        if action == "remove_high_confidence":
            affected_files.add(row["audio_path"])

    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    with args.output_csv.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(output_rows[0]))
        writer.writeheader()
        writer.writerows(output_rows)

    summary = {
        "event_count": len(rows),
        "decision_counts": dict(sorted(decisions.items())),
        "high_confidence_affected_file_count": len(affected_files),
        "automatic_edit_policy": {
            "preserve_duration": True,
            "overwrite_source": False,
            "mute_only_non_speech_regions": True,
            "manual_review_for_ambiguous_events": True,
        },
    }
    args.output_json.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
