#!/usr/bin/env python3
"""Build a reviewable Workbook source-audio to textbook-page mapping plan.

The latest MP4 audio extractions are source assets, not production-ready tracks.
This script never edits audio. It classifies each source and emits a CSV plan that
must be reviewed before any per-page MP3 is rendered or uploaded.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
from collections import Counter
from pathlib import Path


PAGE_PATTERNS = {
    1: re.compile(r"^-p(?P<page>\d+)\.mp3$", re.IGNORECASE),
    2: re.compile(r"^workbook-2-p(?P<page>\d+)(?:-read-aloud)?\.mp3$", re.IGNORECASE),
    3: re.compile(r"^p(?P<page>\d+)(?:-|\.mp3$)", re.IGNORECASE),
}
CURRENT_PAGE_PATTERN = re.compile(r"\bP(?P<page>\d+)(?:\D|$)", re.IGNORECASE)
QUESTION_RANGE_PATTERN = re.compile(r"^(?P<start>\d+)-(?P<end>\d+)\s*\.mp3$", re.IGNORECASE)

REVIEWED_QUESTION_PAGE_MAP = {
    4: {
        (1, 7): 9, (8, 14): 13, (15, 21): 15, (22, 28): 17,
        (29, 35): 24, (36, 42): 26, (43, 49): 28, (50, 56): 32,
        (57, 63): 34, (64, 70): 36, (71, 77): 38, (78, 84): 40,
        (85, 91): 46, (92, 98): 48, (99, 105): 50, (106, 112): 52,
        (113, 119): 54, (120, 126): 59, (127, 133): 61,
        (134, 140): 63, (141, 147): 64, (148, 154): 71,
        (155, 161): 76, (162, 167): 80, (168, 174): 81,
        (175, 181): 82, (182, 188): 86, (189, 195): 89,
        (196, 202): 91, (203, 209): 93, (210, 216): 95,
    },
    5: {
        (1, 7): 2, (8, 14): 4, (15, 21): 6, (22, 28): 8,
        (29, 35): 13, (36, 42): 15, (43, 49): 26, (50, 56): 27,
        (57, 63): 30, (64, 70): 35, (71, 77): 36, (78, 84): 38,
        (85, 91): 42, (92, 98): 43, (99, 105): 47, (106, 112): 58,
        (113, 119): 60, (120, 126): 62, (127, 133): 64,
        (134, 140): 69, (141, 147): 72, (148, 154): 74,
        (155, 164): 82, (165, 170): 83, (172, 178): 84,
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--comparison", required=True, type=Path)
    parser.add_argument("--transcripts", required=True, type=Path)
    parser.add_argument("--output-csv", required=True, type=Path)
    parser.add_argument("--output-gap-csv", required=True, type=Path)
    parser.add_argument("--output-summary", required=True, type=Path)
    parser.add_argument("--render-output-root", type=Path)
    parser.add_argument("--render-manifest", type=Path)
    return parser.parse_args()


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_score(row: dict[str, str]) -> float:
    values = []
    for key in ("bag_word_similarity", "sequence_similarity"):
        try:
            values.append(float(row.get(key) or 0))
        except ValueError:
            values.append(0.0)
    return max(values, default=0.0)


def page_from_reference(reference: str) -> str:
    match = CURRENT_PAGE_PATTERN.search(reference or "")
    return match.group("page") if match else ""


def classify_source(
    workbook: int,
    name: str,
    comparison: dict[tuple[int, str], dict[str, str]],
) -> dict[str, str]:
    lower_name = name.lower()
    row = comparison.get((workbook, name), {})
    score = parse_score(row)

    if workbook in PAGE_PATTERNS:
        direct = PAGE_PATTERNS[workbook].search(name)
        if direct:
            page = direct.group("page")
            return {
                "source_kind": "page_labeled_review" if "review" in lower_name else "page_labeled",
                "suggested_page": page,
                "question_range": "",
                "mapping_score": f"{score:.4f}",
                "mapping_status": "page_candidate",
                "mapping_evidence": "source filename contains page; content review remains required before production",
                "requires_manual_review": "no",
            }

    question_range = QUESTION_RANGE_PATTERN.search(name)
    if workbook in (4, 5) and question_range:
        question_key = (int(question_range.group("start")), int(question_range.group("end")))
        reviewed_page = REVIEWED_QUESTION_PAGE_MAP.get(workbook, {}).get(question_key)
        page = str(reviewed_page or page_from_reference(row.get("current_reference", "")))
        status = "page_candidate" if reviewed_page else "needs_manual_mapping"
        manual = "no" if reviewed_page else "yes"
        return {
            "source_kind": "question_range",
            "suggested_page": page,
            "question_range": f"Q{question_range.group('start')}-Q{question_range.group('end')}",
            "mapping_score": f"{score:.4f}",
            "mapping_status": status,
            "mapping_evidence": (
                "teacher PDF page content and latest transcript sequence"
                if reviewed_page
                else "best current-page transcript match; confirm against teacher PDF"
            ),
            "requires_manual_review": manual,
        }

    review_span = re.search(r"(?:page-|p)?(\d+)-to-(?:page-|p)?(\d+)", lower_name)
    before_page = re.search(r"before-(?:page-|p)?(\d+)", lower_name)
    hint = ""
    if review_span:
        hint = f"P{review_span.group(1)}-P{review_span.group(2)}"
    elif before_page:
        hint = f"before P{before_page.group(1)}"

    return {
        "source_kind": "cross_page_or_unmapped_review",
        "suggested_page": "",
        "question_range": hint,
        "mapping_score": f"{score:.4f}",
        "mapping_status": "needs_manual_mapping",
        "mapping_evidence": "review/range source has no reliable single-page target",
        "requires_manual_review": "yes",
    }


def main() -> None:
    args = parse_args()
    manifest = load_csv(args.manifest)
    comparison_rows = load_csv(args.comparison)
    comparison = {
        (int(row["workbook"]), row["latest_name"]): row for row in comparison_rows
    }

    output_rows = []
    for source in manifest:
        if source.get("status") != "created":
            continue
        workbook = int(source["workbook"])
        name = source["output_name"]
        mapping = classify_source(workbook, name, comparison)
        page = mapping["suggested_page"]
        output_rows.append(
            {
                "workbook": workbook,
                "source_audio": name,
                "source_path": source["output_mp3"],
                "duration_seconds": source["output_duration_seconds"],
                **mapping,
                "proposed_output_name": (
                    f"Workbook_{workbook}_P{page}.mp3" if page else ""
                ),
                "production_action": (
                    "render_single_page_after_content_review"
                    if page
                    else "locate_page_boundaries_before_render"
                ),
                "source_sha256": source["output_sha256"],
                "notes": "",
            }
        )

    output_rows.sort(key=lambda row: (int(row["workbook"]), row["source_audio"].lower()))
    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(output_rows[0].keys())
    with args.output_csv.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    latest_pages: dict[int, set[int]] = {workbook: set() for workbook in range(1, 6)}
    for row in output_rows:
        if row["mapping_status"] == "page_candidate" and row["suggested_page"]:
            latest_pages[int(row["workbook"])].add(int(row["suggested_page"]))

    current_pages: dict[int, set[int]] = {workbook: set() for workbook in range(1, 6)}
    for row in load_csv(args.transcripts):
        if row.get("kind") != "production_reference":
            continue
        if re.search(r"question|answer", row.get("name", ""), re.IGNORECASE):
            continue
        page_match = re.search(r"P(\d+)", row.get("name", ""), re.IGNORECASE)
        if page_match:
            current_pages[int(row["workbook"])].add(int(page_match.group(1)))

    gap_rows = []
    gap_summary = {}
    for workbook in range(1, 6):
        all_pages = sorted(latest_pages[workbook] | current_pages[workbook])
        counts = Counter()
        for page in all_pages:
            in_latest = page in latest_pages[workbook]
            in_current = page in current_pages[workbook]
            if in_latest and in_current:
                status = "overlap"
            elif in_latest:
                status = "latest_only"
            else:
                status = "current_only"
            counts[status] += 1
            gap_rows.append(
                {
                    "workbook": workbook,
                    "page": page,
                    "status": status,
                    "latest_page_candidate": "yes" if in_latest else "no",
                    "current_main_page_reference": "yes" if in_current else "no",
                    "required_action": {
                        "overlap": "compare_and_replace_only_after_approval",
                        "latest_only": "create_new_page_track_after_approval",
                        "current_only": "keep_current_until_obsolete_status_confirmed",
                    }[status],
                }
            )
        gap_summary[str(workbook)] = dict(sorted(counts.items()))
    args.output_gap_csv.parent.mkdir(parents=True, exist_ok=True)
    with args.output_gap_csv.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(gap_rows[0].keys()))
        writer.writeheader()
        writer.writerows(gap_rows)

    status_counts = Counter(row["mapping_status"] for row in output_rows)
    book_counts = Counter(str(row["workbook"]) for row in output_rows)
    summary = {
        "source_count": len(output_rows),
        "by_workbook": dict(sorted(book_counts.items())),
        "by_mapping_status": dict(sorted(status_counts.items())),
        "page_comparison": gap_summary,
        "rules": {
            "production_unit": "one textbook page per main audio file",
            "source_assets_are_not_production_ready": True,
            "production_mutation_performed": False,
        },
    }
    args.output_summary.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    if args.render_output_root:
        if not args.render_manifest:
            raise ValueError("--render-manifest is required with --render-output-root")
        render_rows = []
        destinations = set()
        for row in output_rows:
            if row["mapping_status"] != "page_candidate":
                continue
            destination = (
                args.render_output_root
                / f"Workbook {row['workbook']}"
                / row["proposed_output_name"]
            )
            destination_key = str(destination).lower()
            if destination_key in destinations:
                raise ValueError(f"Duplicate page output: {destination}")
            destinations.add(destination_key)
            destination.parent.mkdir(parents=True, exist_ok=True)
            source_path = Path(row["source_path"])
            shutil.copyfile(source_path, destination)
            digest = sha256_file(destination)
            if digest != row["source_sha256"]:
                raise ValueError(f"Hash mismatch after copy: {destination}")
            render_rows.append(
                {
                    "workbook": row["workbook"],
                    "page": row["suggested_page"],
                    "source_audio": row["source_audio"],
                    "output_path": str(destination),
                    "duration_seconds": row["duration_seconds"],
                    "sha256": digest,
                    "status": "page_candidate_rendered",
                }
            )
        args.render_manifest.parent.mkdir(parents=True, exist_ok=True)
        with args.render_manifest.open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(render_rows[0].keys()))
            writer.writeheader()
            writer.writerows(render_rows)


if __name__ == "__main__":
    main()
