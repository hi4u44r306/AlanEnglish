#!/usr/bin/env python3
"""Render non-destructive Workbook page-audio candidates with SFX muted."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
from collections import defaultdict
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(ffprobe: Path, path: Path) -> dict:
    result = subprocess.run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-show_entries",
            "format=duration,bit_rate:stream=codec_name,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(result.stdout)


def merge_intervals(intervals: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not intervals:
        return []
    merged: list[list[float]] = [[intervals[0][0], intervals[0][1]]]
    for start, end in intervals[1:]:
        if start - merged[-1][1] <= 0.12:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [(start, end) for start, end in merged]


def volume_filter(start: float, end: float, fade: float = 0.04) -> str:
    fade_start = max(0.0, start - fade)
    fade_end = end + fade
    expression = (
        f"if(lt(t,{fade_start:.6f}),1,"
        f"if(lt(t,{start:.6f}),({start:.6f}-t)/{fade:.6f},"
        f"if(lt(t,{end:.6f}),0,"
        f"if(lt(t,{fade_end:.6f}),(t-{end:.6f})/{fade:.6f},1))))"
    )
    return f"volume='{expression}':eval=frame"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    parser.add_argument("--ffprobe", type=Path, required=True)
    parser.add_argument("--only-workbook", type=int)
    parser.add_argument("--only-page", type=int)
    args = parser.parse_args()

    with args.manifest.open("r", encoding="utf-8-sig", newline="") as stream:
        manifest_rows = list(csv.DictReader(stream))
    with args.plan.open("r", encoding="utf-8-sig", newline="") as stream:
        plan_rows = [
            row
            for row in csv.DictReader(stream)
            if row["review_action"] == "remove_high_confidence"
        ]

    events_by_path: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in plan_rows:
        if args.only_workbook and int(row["workbook"]) != args.only_workbook:
            continue
        if args.only_page and int(row["page"]) != args.only_page:
            continue
        events_by_path[row["audio_path"]].append(row)

    args.output_root.mkdir(parents=True, exist_ok=True)
    rendered: dict[str, dict] = {}
    edit_log: list[dict[str, str]] = []
    for index, (source_path_text, events) in enumerate(
        sorted(events_by_path.items()), start=1
    ):
        source_path = Path(source_path_text)
        workbook = int(events[0]["workbook"])
        page = int(events[0]["page"])
        intervals = merge_intervals(
            sorted(
                (
                    (
                        max(
                            0.0,
                            float(row["start_seconds"])
                            - (
                                0.04
                                if row["review_reason"]
                                == "stereo_effect_after_spoken_sentence"
                                else 0.0
                            ),
                        ),
                        float(row["end_seconds"])
                        + (
                            0.04
                            if row["review_reason"]
                            == "stereo_effect_after_spoken_sentence"
                            else 0.0
                        ),
                    )
                    for row in events
                )
            )
        )
        output_dir = args.output_root / f"Workbook {workbook}"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"Workbook_{workbook}_P{page}_no_sfx.mp3"
        filters = ",".join(volume_filter(start, end) for start, end in intervals)
        subprocess.run(
            [
                str(args.ffmpeg),
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source_path),
                "-af",
                filters,
                "-map_metadata",
                "0",
                "-ar",
                "48000",
                "-ac",
                "2",
                "-b:a",
                "192k",
                str(output_path),
            ],
            check=True,
        )
        source_probe = probe(args.ffprobe, source_path)
        output_probe = probe(args.ffprobe, output_path)
        source_duration = float(source_probe["format"]["duration"])
        output_duration = float(output_probe["format"]["duration"])
        duration_delta = output_duration - source_duration
        stream = output_probe["streams"][0]
        if abs(duration_delta) > 0.05:
            raise RuntimeError(
                f"Duration drift for Workbook {workbook} P{page}: {duration_delta:.6f}s"
            )
        if stream.get("sample_rate") != "48000" or stream.get("channels") != 2:
            raise RuntimeError(f"Unexpected output format for {output_path}")

        rendered[source_path_text] = {
            "output_path": str(output_path),
            "duration_seconds": f"{output_duration:.3f}",
            "sha256": sha256_file(output_path),
            "event_count": len(events),
            "merged_interval_count": len(intervals),
            "duration_delta_seconds": f"{duration_delta:.6f}",
        }
        for row in events:
            edit_log.append(
                {
                    "workbook": row["workbook"],
                    "page": row["page"],
                    "source_path": source_path_text,
                    "output_path": str(output_path),
                    "start_seconds": row["start_seconds"],
                    "end_seconds": row["end_seconds"],
                    "audioset_top_labels": row["audioset_top_labels"],
                    "review_reason": row["review_reason"],
                }
            )
        print(
            f"[{index}/{len(events_by_path)}] Workbook {workbook} P{page}: "
            f"muted {len(events)} event(s)",
            flush=True,
        )

    output_manifest_rows: list[dict[str, str]] = []
    for row in manifest_rows:
        enriched = dict(row)
        rendered_row = rendered.get(row["output_path"])
        if rendered_row:
            enriched["original_output_path"] = row["output_path"]
            enriched["output_path"] = rendered_row["output_path"]
            enriched["duration_seconds"] = rendered_row["duration_seconds"]
            enriched["sha256"] = rendered_row["sha256"]
            enriched["status"] = "sfx_clean_candidate_rendered"
            enriched["sfx_removed_event_count"] = str(rendered_row["event_count"])
        else:
            enriched["original_output_path"] = ""
            enriched["sfx_removed_event_count"] = "0"
        output_manifest_rows.append(enriched)

    manifest_path = args.output_root / "page-audio-sfx-clean-manifest.csv"
    fieldnames = list(output_manifest_rows[0])
    with manifest_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_manifest_rows)

    edit_log_path = args.output_root / "audio-sfx-edit-log.csv"
    with edit_log_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(edit_log[0]))
        writer.writeheader()
        writer.writerows(edit_log)

    summary = {
        "manifest_rows": len(output_manifest_rows),
        "rendered_file_count": len(rendered),
        "muted_event_count": len(edit_log),
        "source_overwritten": False,
        "duration_preserved_within_seconds": 0.05,
    }
    (args.output_root / "audio-sfx-render-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
