#!/usr/bin/env python3
"""Transcribe ambiguous audio-effect candidates with and without context."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio


SAMPLE_RATE = 16_000


def transcribe_clip(model: WhisperModel, audio: np.ndarray) -> tuple[str, str, str]:
    segments_iterator, _ = model.transcribe(
        audio,
        language="en",
        beam_size=1,
        best_of=1,
        vad_filter=False,
        condition_on_previous_text=False,
        temperature=0.0,
    )
    segments = list(segments_iterator)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    if not segments:
        return "", "", ""
    average_logprob = sum(segment.avg_logprob for segment in segments) / len(segments)
    no_speech_probability = max(segment.no_speech_prob for segment in segments)
    return text, f"{average_logprob:.6f}", f"{no_speech_probability:.6f}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--context-seconds", type=float, default=0.5)
    args = parser.parse_args()

    with args.plan.open("r", encoding="utf-8-sig", newline="") as stream:
        rows = [
            row
            for row in csv.DictReader(stream)
            if row["review_action"] == "manual_review"
        ]

    model = WhisperModel(str(args.model_dir), device="cpu", compute_type="int8")
    decoded_path: str | None = None
    decoded_audio: np.ndarray | None = None
    output_rows: list[dict[str, str]] = []
    for index, row in enumerate(rows, start=1):
        audio_path = row["audio_path"]
        if decoded_path != audio_path:
            decoded_audio = decode_audio(audio_path, sampling_rate=SAMPLE_RATE)
            decoded_path = audio_path
        assert decoded_audio is not None

        start_seconds = float(row["start_seconds"])
        end_seconds = float(row["end_seconds"])
        start = max(0, int(start_seconds * SAMPLE_RATE))
        end = min(decoded_audio.size, int(end_seconds * SAMPLE_RATE))
        context_start = max(
            0, int((start_seconds - args.context_seconds) * SAMPLE_RATE)
        )
        context_end = min(
            decoded_audio.size,
            int((end_seconds + args.context_seconds) * SAMPLE_RATE),
        )

        exact_text, exact_logprob, exact_no_speech = transcribe_clip(
            model, decoded_audio[start:end]
        )
        context_text, context_logprob, context_no_speech = transcribe_clip(
            model, decoded_audio[context_start:context_end]
        )
        enriched = dict(row)
        enriched.update(
            {
                "whisper_exact_text": exact_text,
                "whisper_exact_avg_logprob": exact_logprob,
                "whisper_exact_no_speech_prob": exact_no_speech,
                "whisper_context_text": context_text,
                "whisper_context_avg_logprob": context_logprob,
                "whisper_context_no_speech_prob": context_no_speech,
            }
        )
        output_rows.append(enriched)
        print(f"transcribed {index}/{len(rows)}", flush=True)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(output_rows[0]))
        writer.writeheader()
        writer.writerows(output_rows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
