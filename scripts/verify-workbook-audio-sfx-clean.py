#!/usr/bin/env python3
"""Verify that planned SFX intervals were attenuated without timeline drift."""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from faster_whisper.audio import decode_audio


SAMPLE_RATE = 16_000


def dbfs(value: float) -> float:
    return 20.0 * math.log10(max(value, 1e-10))


def rms(audio: np.ndarray) -> float:
    if audio.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(audio.astype(np.float64)))))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--edit-log", type=Path, required=True)
    parser.add_argument("--output-csv", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    args = parser.parse_args()

    with args.manifest.open("r", encoding="utf-8-sig", newline="") as stream:
        manifest_rows = list(csv.DictReader(stream))
    with args.edit_log.open("r", encoding="utf-8-sig", newline="") as stream:
        edit_rows = list(csv.DictReader(stream))

    manifest_by_output = {row["output_path"]: row for row in manifest_rows}
    events_by_output: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in edit_rows:
        events_by_output[row["output_path"]].append(row)

    verification_rows: list[dict[str, str]] = []
    file_results: list[dict] = []
    for output_path_text, events in sorted(events_by_output.items()):
        output_path = Path(output_path_text)
        source_path = Path(events[0]["source_path"])
        source_audio = decode_audio(str(source_path), sampling_rate=SAMPLE_RATE)
        output_audio = decode_audio(str(output_path), sampling_rate=SAMPLE_RATE)
        common_samples = min(source_audio.size, output_audio.size)
        duration_delta = (output_audio.size - source_audio.size) / SAMPLE_RATE

        keep_mask = np.ones(common_samples, dtype=bool)
        event_passes = 0
        for event in events:
            start_seconds = float(event["start_seconds"])
            end_seconds = float(event["end_seconds"])
            start = max(0, int(start_seconds * SAMPLE_RATE))
            end = min(common_samples, int(end_seconds * SAMPLE_RATE))
            keep_start = max(0, start - int(0.08 * SAMPLE_RATE))
            keep_end = min(common_samples, end + int(0.08 * SAMPLE_RATE))
            keep_mask[keep_start:keep_end] = False
            source_level = dbfs(rms(source_audio[start:end]))
            output_level = dbfs(rms(output_audio[start:end]))
            attenuation = source_level - output_level
            passed = attenuation >= 25.0 or output_level <= -55.0
            event_passes += int(passed)
            verification_rows.append(
                {
                    "workbook": event["workbook"],
                    "page": event["page"],
                    "source_path": str(source_path),
                    "output_path": str(output_path),
                    "start_seconds": event["start_seconds"],
                    "end_seconds": event["end_seconds"],
                    "source_rms_dbfs": f"{source_level:.2f}",
                    "output_rms_dbfs": f"{output_level:.2f}",
                    "attenuation_db": f"{attenuation:.2f}",
                    "passed": str(passed).lower(),
                }
            )

        source_kept = source_audio[:common_samples][keep_mask]
        output_kept = output_audio[:common_samples][keep_mask]
        correlation = float(np.corrcoef(source_kept, output_kept)[0, 1])
        manifest_row = manifest_by_output[output_path_text]
        file_passed = (
            event_passes == len(events)
            and abs(duration_delta) <= 0.05
            and correlation >= 0.995
            and Path(manifest_row["output_path"]).is_file()
        )
        file_results.append(
            {
                "workbook": int(events[0]["workbook"]),
                "page": int(events[0]["page"]),
                "event_count": len(events),
                "event_pass_count": event_passes,
                "duration_delta_seconds": round(duration_delta, 6),
                "unedited_waveform_correlation": round(correlation, 8),
                "passed": file_passed,
            }
        )

    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    with args.output_csv.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(verification_rows[0]))
        writer.writeheader()
        writer.writerows(verification_rows)

    summary = {
        "file_count": len(file_results),
        "file_pass_count": sum(row["passed"] for row in file_results),
        "event_count": len(verification_rows),
        "event_pass_count": sum(row["passed"] == "true" for row in verification_rows),
        "minimum_attenuation_db": min(
            float(row["attenuation_db"]) for row in verification_rows
        ),
        "minimum_unedited_waveform_correlation": min(
            row["unedited_waveform_correlation"] for row in file_results
        ),
        "maximum_absolute_duration_delta_seconds": max(
            abs(row["duration_delta_seconds"]) for row in file_results
        ),
        "files": file_results,
    }
    args.output_json.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if summary["file_pass_count"] != summary["file_count"]:
        return 1
    if summary["event_pass_count"] != summary["event_count"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
