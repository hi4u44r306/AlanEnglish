#!/usr/bin/env python3
"""Classify audio-effect audit events with a local AudioSet ONNX model.

The classifier only enriches the review queue. It does not edit audio. Stereo
events remain independently identifiable because educational narration in the
source set is effectively dual mono.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from faster_whisper.audio import decode_audio
from transformers.audio_utils import mel_filter_bank, spectrogram, window_function


SAMPLE_RATE = 16_000
SPEECH_LABEL_TOKENS = (
    "speech",
    "conversation",
    "narration",
    "whisper",
    "child speaking",
    "man speaking",
    "woman speaking",
    "speech synthesizer",
)


class AstNumpyFeatureExtractor:
    """AST log-Mel preprocessing without the optional PyTorch dependency."""

    def __init__(
        self,
        sampling_rate: int = SAMPLE_RATE,
        num_mel_bins: int = 128,
        max_length: int = 1024,
        mean: float = -4.2677393,
        std: float = 4.5689974,
    ) -> None:
        self.sampling_rate = sampling_rate
        self.num_mel_bins = num_mel_bins
        self.max_length = max_length
        self.mean = mean
        self.std = std
        self.mel_filters = mel_filter_bank(
            num_frequency_bins=257,
            num_mel_filters=num_mel_bins,
            min_frequency=20,
            max_frequency=sampling_rate // 2,
            sampling_rate=sampling_rate,
            norm=None,
            mel_scale="kaldi",
            triangularize_in_mel_space=True,
        )
        self.window = window_function(400, "hann", periodic=False)

    def __call__(self, waveforms: list[np.ndarray]) -> np.ndarray:
        features: list[np.ndarray] = []
        for waveform in waveforms:
            fbank = spectrogram(
                np.squeeze(waveform),
                self.window,
                frame_length=400,
                hop_length=160,
                fft_length=512,
                power=2.0,
                center=False,
                preemphasis=0.97,
                mel_filters=self.mel_filters,
                log_mel="log",
                mel_floor=1.192092955078125e-07,
                remove_dc_offset=True,
            ).T
            if fbank.shape[0] < self.max_length:
                fbank = np.pad(fbank, ((0, self.max_length - fbank.shape[0]), (0, 0)))
            else:
                fbank = fbank[: self.max_length]
            features.append(((fbank - self.mean) / (self.std * 2)).astype(np.float32))
        return np.stack(features)


def sigmoid(values: np.ndarray) -> np.ndarray:
    positive = values >= 0
    result = np.empty_like(values, dtype=np.float32)
    result[positive] = 1.0 / (1.0 + np.exp(-values[positive]))
    exponential = np.exp(values[~positive])
    result[~positive] = exponential / (1.0 + exponential)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", type=Path, required=True)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    with args.events.open("r", encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if args.limit:
        rows = rows[: args.limit]

    config = json.loads((args.model_dir / "config.json").read_text(encoding="utf-8"))
    id_to_label = {int(key): value for key, value in config["id2label"].items()}
    extractor = AstNumpyFeatureExtractor()
    session = ort.InferenceSession(
        str(args.model_dir / "onnx" / "model_int8.onnx"),
        providers=["CPUExecutionProvider"],
    )

    decoded_path: str | None = None
    decoded_audio: np.ndarray | None = None
    batches: list[tuple[dict, np.ndarray]] = []
    for row in rows:
        audio_path = row["audio_path"]
        if decoded_path != audio_path:
            decoded_audio = decode_audio(audio_path, sampling_rate=SAMPLE_RATE)
            decoded_path = audio_path
        assert decoded_audio is not None
        start = max(0, int(float(row["start_seconds"]) * SAMPLE_RATE))
        end = min(decoded_audio.size, int(float(row["end_seconds"]) * SAMPLE_RATE))
        clip = decoded_audio[start:end].astype(np.float32, copy=False)
        if clip.size == 0:
            clip = np.zeros(1, dtype=np.float32)
        batches.append((row, clip))

    output_rows: list[dict] = []
    for batch_start in range(0, len(batches), args.batch_size):
        batch = batches[batch_start : batch_start + args.batch_size]
        features = extractor([clip for _, clip in batch])
        logits = session.run(["logits"], {"input_values": features})[0]
        probabilities = sigmoid(logits)
        for (row, _), scores in zip(batch, probabilities):
            top_indexes = np.argsort(scores)[-5:][::-1]
            top_labels = [id_to_label[int(index)] for index in top_indexes]
            top_scores = [float(scores[int(index)]) for index in top_indexes]
            speech_score = max(
                (
                    float(score)
                    for index, score in enumerate(scores)
                    if any(
                        token in id_to_label[index].lower()
                        for token in SPEECH_LABEL_TOKENS
                    )
                ),
                default=0.0,
            )
            stereo_ratio = float(row["stereo_side_ratio_db"])
            peak_db = float(row["peak_dbfs"])
            duration = float(row["duration_seconds"])
            if stereo_ratio >= -22.0 and peak_db >= -25.0 and duration >= 0.30:
                classification = "confirmed_sfx_stereo"
            elif speech_score >= 0.50 or any(
                any(token in label.lower() for token in SPEECH_LABEL_TOKENS)
                for label in top_labels[:2]
            ):
                classification = "likely_speech_false_positive"
            elif duration < 0.18 and peak_db < -30.0:
                classification = "inaudible_or_codec_noise"
            else:
                classification = "manual_review_non_speech"

            enriched = dict(row)
            enriched.update(
                {
                    "audioset_classification": classification,
                    "audioset_speech_score": f"{speech_score:.6f}",
                    "audioset_top_labels": " | ".join(top_labels),
                    "audioset_top_scores": " | ".join(
                        f"{score:.6f}" for score in top_scores
                    ),
                }
            )
            output_rows.append(enriched)
        print(
            f"classified {min(batch_start + len(batch), len(batches))}/{len(batches)}",
            flush=True,
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(output_rows[0]) if output_rows else []
    with args.output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    counts: dict[str, int] = {}
    for row in output_rows:
        key = row["audioset_classification"]
        counts[key] = counts.get(key, 0) + 1
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
