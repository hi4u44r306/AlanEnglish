#!/usr/bin/env python3
"""Reduce stereo effects while preserving centered Workbook narration.

This utility is intentionally limited to 16-bit stereo WAV input. It uses a
short-time Fourier transform and attenuates frequency bins whose side-channel
energy is high relative to the mid channel. It never edits the source file.
"""

from __future__ import annotations

import argparse
import wave
from pathlib import Path

import numpy as np


def read_stereo_pcm16(path: Path) -> tuple[int, np.ndarray]:
    with wave.open(str(path), "rb") as stream:
        if stream.getsampwidth() != 2 or stream.getnchannels() != 2:
            raise ValueError("Input must be 16-bit stereo PCM WAV")
        sample_rate = stream.getframerate()
        samples = np.frombuffer(stream.readframes(stream.getnframes()), dtype="<i2")
    return sample_rate, samples.reshape(-1, 2).astype(np.float32) / 32768.0


def write_stereo_pcm16(path: Path, sample_rate: int, stereo: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.round(np.clip(stereo, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(sample_rate)
        stream.writeframes(pcm.tobytes())


def separate_centered_speech(
    stereo: np.ndarray,
    *,
    frame_length: int,
    hop_length: int,
    strength: float,
    power: float,
    minimum_gain: float,
) -> np.ndarray:
    if frame_length <= 0 or hop_length <= 0 or hop_length > frame_length:
        raise ValueError("Invalid frame or hop length")
    if strength <= 0 or power <= 0:
        raise ValueError("Strength and power must be positive")
    if not 0.0 <= minimum_gain <= 1.0:
        raise ValueError("Minimum gain must be between 0 and 1")

    sample_count = stereo.shape[0]
    padded_count = max(frame_length, sample_count)
    remainder = (padded_count - frame_length) % hop_length
    if remainder:
        padded_count += hop_length - remainder
    padded = np.zeros((padded_count, 2), dtype=np.float32)
    padded[:sample_count] = stereo

    window = np.hanning(frame_length).astype(np.float32)
    output = np.zeros(padded_count, dtype=np.float64)
    weights = np.zeros(padded_count, dtype=np.float64)
    epsilon = 1e-8
    for start in range(0, padded_count - frame_length + 1, hop_length):
        frame = padded[start : start + frame_length] * window[:, None]
        left = np.fft.rfft(frame[:, 0])
        right = np.fft.rfft(frame[:, 1])
        mid = (left + right) * 0.5
        side = (left - right) * 0.5
        side_ratio = np.abs(side) / (np.abs(mid) + epsilon)
        mask = 1.0 / (1.0 + np.power(strength * side_ratio, power))
        mask = np.maximum(mask, minimum_gain)
        centered = np.fft.irfft(mid * mask, n=frame_length).real
        output[start : start + frame_length] += centered * window
        weights[start : start + frame_length] += window * window

    nonzero = weights > epsilon
    output[nonzero] /= weights[nonzero]
    return output[:sample_count].astype(np.float32)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--frame-length", type=int, default=1024)
    parser.add_argument("--hop-length", type=int, default=256)
    parser.add_argument("--strength", type=float, default=2.0)
    parser.add_argument("--power", type=float, default=2.0)
    parser.add_argument("--minimum-gain", type=float, default=0.05)
    parser.add_argument("--start-seconds", type=float)
    parser.add_argument("--end-seconds", type=float)
    parser.add_argument("--fade-seconds", type=float, default=0.04)
    args = parser.parse_args()

    sample_rate, stereo = read_stereo_pcm16(args.input)
    if (args.start_seconds is None) != (args.end_seconds is None):
        raise ValueError("Start and end seconds must be provided together")
    start = 0
    end = stereo.shape[0]
    if args.start_seconds is not None and args.end_seconds is not None:
        start = max(0, round(args.start_seconds * sample_rate))
        end = min(stereo.shape[0], round(args.end_seconds * sample_rate))
        if end <= start:
            raise ValueError("Selected interval is empty")
    centered = separate_centered_speech(
        stereo[start:end],
        frame_length=args.frame_length,
        hop_length=args.hop_length,
        strength=args.strength,
        power=args.power,
        minimum_gain=args.minimum_gain,
    )
    replacement = np.column_stack((centered, centered))
    output = stereo.copy()
    weights = np.ones(end - start, dtype=np.float32)
    fade_samples = min(round(args.fade_seconds * sample_rate), weights.size // 2)
    if fade_samples > 0:
        weights[:fade_samples] = np.linspace(0.0, 1.0, fade_samples, endpoint=False)
        weights[-fade_samples:] = np.linspace(1.0, 0.0, fade_samples, endpoint=False)
    weights = weights[:, None]
    output[start:end] = stereo[start:end] * (1.0 - weights) + replacement * weights
    write_stereo_pcm16(args.output, sample_rate, output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
