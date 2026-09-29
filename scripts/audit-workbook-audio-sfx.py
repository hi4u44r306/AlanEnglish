#!/usr/bin/env python3
"""Audit rendered Workbook page audio for likely non-speech sound effects.

This tool is intentionally read-only. It combines Silero VAD probabilities with
frame energy, spectral change, and stereo side-channel energy. It writes a
review queue; it never edits source audio or decides that a candidate is safe
to mute without a later content review.

The script expects faster-whisper and its bundled Silero ONNX model to be
available on PYTHONPATH.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
from faster_whisper.audio import decode_audio
from faster_whisper.vad import get_vad_model


SAMPLE_RATE = 16_000
FRAME_SAMPLES = 512
FRAME_SECONDS = FRAME_SAMPLES / SAMPLE_RATE


@dataclass
class Event:
    workbook: int
    page: int
    audio_path: str
    start_seconds: float
    end_seconds: float
    duration_seconds: float
    mean_dbfs: float
    peak_dbfs: float
    speech_probability: float
    spectral_novelty: float
    stereo_side_ratio_db: float
    risk_score: int
    reason: str


def dbfs(value: np.ndarray | float) -> np.ndarray | float:
    return 20.0 * np.log10(np.maximum(value, 1e-8))


def frame_audio(audio: np.ndarray) -> np.ndarray:
    if audio.size == 0:
        return np.empty((0, FRAME_SAMPLES), dtype=np.float32)
    padding = (-audio.size) % FRAME_SAMPLES
    if padding:
        audio = np.pad(audio, (0, padding))
    return audio.reshape(-1, FRAME_SAMPLES)


def event_groups(mask: np.ndarray, max_gap_frames: int = 3) -> list[tuple[int, int]]:
    indexes = np.flatnonzero(mask)
    if indexes.size == 0:
        return []
    groups: list[tuple[int, int]] = []
    start = previous = int(indexes[0])
    for current_value in indexes[1:]:
        current = int(current_value)
        if current - previous > max_gap_frames + 1:
            groups.append((start, previous + 1))
            start = current
        previous = current
    groups.append((start, previous + 1))
    return groups


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def audit_file(workbook: int, page: int, path: Path) -> tuple[list[Event], dict]:
    left, right = decode_audio(str(path), sampling_rate=SAMPLE_RATE, split_stereo=True)
    sample_count = min(left.size, right.size)
    left = left[:sample_count]
    right = right[:sample_count]
    mono = ((left + right) * 0.5).astype(np.float32)
    side = ((left - right) * 0.5).astype(np.float32)

    mono_frames = frame_audio(mono)
    side_frames = frame_audio(side)
    if mono_frames.size == 0:
        return [], {
            "workbook": workbook,
            "page": page,
            "audio_path": str(path),
            "duration_seconds": 0.0,
            "event_count": 0,
            "max_risk_score": 0,
            "status": "empty_audio",
            "sha256": sha256_file(path),
        }

    rms = np.sqrt(np.mean(np.square(mono_frames), axis=1) + 1e-12)
    side_rms = np.sqrt(np.mean(np.square(side_frames), axis=1) + 1e-12)
    frame_db = dbfs(rms)
    side_ratio_db = dbfs(side_rms / np.maximum(rms, 1e-8))

    vad_audio = np.pad(mono, (0, (-mono.size) % FRAME_SAMPLES))
    speech_probability = np.asarray(get_vad_model()(vad_audio), dtype=np.float32)
    frame_count = min(len(frame_db), len(speech_probability))
    frame_db = frame_db[:frame_count]
    side_ratio_db = side_ratio_db[:frame_count]
    speech_probability = speech_probability[:frame_count]
    mono_frames = mono_frames[:frame_count]

    speech_frames = frame_db[speech_probability >= 0.5]
    speech_level = float(np.median(speech_frames)) if speech_frames.size else -20.0
    audible_threshold = max(-40.0, speech_level - 24.0)

    window = np.hanning(FRAME_SAMPLES).astype(np.float32)
    spectrum = np.abs(np.fft.rfft(mono_frames * window, axis=1))
    spectrum_sum = np.sum(spectrum, axis=1, keepdims=True) + 1e-8
    normalized_spectrum = spectrum / spectrum_sum
    spectral_novelty = np.zeros(frame_count, dtype=np.float32)
    if frame_count > 1:
        spectral_novelty[1:] = np.mean(
            np.abs(normalized_spectrum[1:] - normalized_spectrum[:-1]), axis=1
        )

    # High-confidence review candidates are audible frames that Silero considers
    # non-speech. Stereo side energy catches some video effects that overlap
    # otherwise speech-like content.
    non_speech_audible = (speech_probability <= 0.20) & (frame_db >= audible_threshold)
    stereo_anomaly = (
        (side_ratio_db >= -22.0)
        & (frame_db >= audible_threshold)
        & (speech_probability <= 0.45)
    )
    candidate_mask = non_speech_audible | stereo_anomaly

    events: list[Event] = []
    for start_frame, end_frame in event_groups(candidate_mask):
        duration = (end_frame - start_frame) * FRAME_SECONDS
        if duration < 0.096:
            continue
        region = slice(start_frame, end_frame)
        mean_level = float(np.mean(frame_db[region]))
        peak_level = float(np.max(frame_db[region]))
        mean_probability = float(np.mean(speech_probability[region]))
        novelty = float(np.max(spectral_novelty[region]))
        side_ratio = float(np.max(side_ratio_db[region]))

        score = 1
        reasons: list[str] = ["audible_non_speech"]
        if peak_level >= speech_level - 16.0:
            score += 2
            reasons.append("near_speech_volume")
        if mean_probability <= 0.08:
            score += 1
            reasons.append("very_low_speech_probability")
        if novelty >= 0.0025:
            score += 1
            reasons.append("abrupt_spectrum_change")
        if side_ratio >= -22.0:
            score += 1
            reasons.append("stereo_effect_candidate")
        if duration >= 0.35:
            score += 1
            reasons.append("sustained")

        events.append(
            Event(
                workbook=workbook,
                page=page,
                audio_path=str(path),
                start_seconds=round(start_frame * FRAME_SECONDS, 3),
                end_seconds=round(end_frame * FRAME_SECONDS, 3),
                duration_seconds=round(duration, 3),
                mean_dbfs=round(mean_level, 2),
                peak_dbfs=round(peak_level, 2),
                speech_probability=round(mean_probability, 4),
                spectral_novelty=round(novelty, 6),
                stereo_side_ratio_db=round(side_ratio, 2),
                risk_score=score,
                reason="|".join(reasons),
            )
        )

    return events, {
        "workbook": workbook,
        "page": page,
        "audio_path": str(path),
        "duration_seconds": round(sample_count / SAMPLE_RATE, 3),
        "speech_level_dbfs": round(speech_level, 2),
        "audible_threshold_dbfs": round(audible_threshold, 2),
        "event_count": len(events),
        "high_risk_event_count": sum(event.risk_score >= 5 for event in events),
        "max_risk_score": max((event.risk_score for event in events), default=0),
        "status": "review" if events else "no_isolated_sfx_candidate",
        "sha256": sha256_file(path),
    }


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    with args.manifest.open("r", encoding="utf-8-sig", newline="") as stream:
        manifest_rows = list(csv.DictReader(stream))
    if args.limit:
        manifest_rows = manifest_rows[: args.limit]

    all_events: list[Event] = []
    summaries: list[dict] = []
    for index, row in enumerate(manifest_rows, start=1):
        path = Path(row["output_path"])
        workbook = int(row["workbook"])
        page = int(row["page"])
        if not path.is_file():
            summaries.append(
                {
                    "workbook": workbook,
                    "page": page,
                    "audio_path": str(path),
                    "duration_seconds": row.get("duration_seconds", ""),
                    "speech_level_dbfs": "",
                    "audible_threshold_dbfs": "",
                    "event_count": 0,
                    "high_risk_event_count": 0,
                    "max_risk_score": 0,
                    "status": "missing_file",
                    "sha256": "",
                }
            )
            continue
        events, summary = audit_file(workbook, page, path)
        all_events.extend(events)
        summaries.append(summary)
        print(
            f"[{index}/{len(manifest_rows)}] Workbook {workbook} P{page}: "
            f"{len(events)} candidate event(s)",
            flush=True,
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    event_rows = [asdict(event) for event in all_events]
    write_csv(
        args.output_dir / "audio-sfx-events.csv",
        event_rows,
        list(Event.__dataclass_fields__),
    )
    write_csv(
        args.output_dir / "audio-sfx-file-summary.csv",
        summaries,
        [
            "workbook",
            "page",
            "audio_path",
            "duration_seconds",
            "speech_level_dbfs",
            "audible_threshold_dbfs",
            "event_count",
            "high_risk_event_count",
            "max_risk_score",
            "status",
            "sha256",
        ],
    )
    report = {
        "manifest": str(args.manifest),
        "file_count": len(summaries),
        "missing_file_count": sum(row["status"] == "missing_file" for row in summaries),
        "files_with_candidates": sum(row["event_count"] > 0 for row in summaries),
        "files_with_high_risk_candidates": sum(
            row["high_risk_event_count"] > 0 for row in summaries
        ),
        "event_count": len(all_events),
        "high_risk_event_count": sum(event.risk_score >= 5 for event in all_events),
        "method": {
            "sample_rate": SAMPLE_RATE,
            "frame_samples": FRAME_SAMPLES,
            "silero_non_speech_probability_max": 0.20,
            "stereo_anomaly_ratio_db_min": -22.0,
            "automatic_editing": False,
        },
    }
    (args.output_dir / "audio-sfx-audit-summary.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
