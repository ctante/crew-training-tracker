"""Local narration with Kokoro, a neural text-to-speech model.

The voice is af_heart: a warm American English voice. espeak-ng is only used
to turn words into phonemes. The sound itself comes from the Kokoro model.
"""

import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
VOICE = "af_heart"
SPEED = 1.0
SAMPLE_RATE = 24000


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {dest.name}", flush=True)
    urllib.request.urlretrieve(url, dest)


def load() -> Kokoro:
    download(MODEL_URL, CACHE / "kokoro-v1.0.onnx")
    download(VOICES_URL, CACHE / "voices-v1.0.bin")
    return Kokoro(str(CACHE / "kokoro-v1.0.onnx"), str(CACHE / "voices-v1.0.bin"))


def render(job: dict) -> None:
    kokoro = load()
    voice = job.get("voice") or VOICE
    speed = float(job.get("speed") or SPEED)
    base = Path(job["dir"])
    base.mkdir(parents=True, exist_ok=True)
    durations: dict[str, list[float]] = {}
    for group in job["groups"]:
        lengths: list[float] = []
        for index, line in enumerate(group["lines"]):
            audio, sample_rate = kokoro.create(
                line,
                voice=voice,
                speed=speed,
                lang="en-us",
                sentence_pause=0.4,
                clause_pause=0.16,
            )
            if sample_rate != SAMPLE_RATE:
                raise SystemExit(f"Unexpected sample rate {sample_rate}")
            sf.write(base / f"{group['id']}-{index}.wav", audio, sample_rate)
            lengths.append(len(audio) / sample_rate)
        durations[group["id"]] = lengths
    (base / "durations.json").write_text(json.dumps(durations))
    print(json.dumps(durations), flush=True)


def place(job: dict) -> None:
    sample_rate = SAMPLE_RATE
    total = max(1, int(float(job["duration"]) * sample_rate))
    mix = np.zeros(total, dtype=np.float32)
    for cue in job["cues"]:
        audio, file_rate = sf.read(cue["file"], dtype="float32")
        if audio.ndim > 1:
            audio = audio[:, 0]
        if file_rate != sample_rate:
            raise SystemExit(f"Unexpected sample rate {file_rate}")
        start = int(float(cue["start"]) * sample_rate)
        if start >= total:
            continue
        end = min(total, start + len(audio))
        mix[start:end] += audio[: end - start]
    peak = float(np.max(np.abs(mix))) if total else 0.0
    if peak > 0.98:
        mix *= 0.98 / peak
    sf.write(job["out"], mix, sample_rate)


def main() -> None:
    mode, job_path = sys.argv[1], sys.argv[2]
    job = json.loads(Path(job_path).read_text())
    if mode == "render":
        render(job)
    elif mode == "place":
        place(job)
    else:
        raise SystemExit(f"Unknown mode {mode}")


if __name__ == "__main__":
    main()
