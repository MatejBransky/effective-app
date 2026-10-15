import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Generates short spoken-tone WAV fixtures (one per slot) for local E2E - the
// production stand-in for S3 audio. 4s sine tones at distinct pitches so a
// listener (or a Playwright run) can tell the slots apart by ear. No
// dependencies: 16-bit mono PCM written by hand.
const SAMPLE_RATE = 22050;
const SECONDS = 4;

const TONES = [
  { key: "focus.wav", freq: 440, label: "daily focus" },
  { key: "recharge1.wav", freq: 554, label: "recharge one" },
  { key: "recharge2.wav", freq: 659, label: "recharge two" },
];

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "audio");

const beepPattern = (t: number, freq: number): number => {
  // Three soft pulses per file so progress/ended events fire on a signal with
  // real onsets, not a flat tone - closer to chaptered audio.
  const pulse = Math.floor(t / (SAMPLE_RATE / 2)) % 2 === 0 ? 1 : 0.25;

  return Math.sin(2 * Math.PI * freq * (t / SAMPLE_RATE)) * 0.4 * pulse;
};

const makeWav = (freq: number): Buffer => {
  const frames = SAMPLE_RATE * SECONDS;
  const data = Buffer.alloc(frames * 2);

  for (let t = 0; t < frames; t++) {
    data.writeInt16LE(Math.round(beepPattern(t, freq) * 32767), t * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
};

await mkdir(dir, { recursive: true });

for (const tone of TONES) {
  await writeFile(join(dir, tone.key), makeWav(tone.freq));
  console.log(`wrote ${tone.key} (${tone.label})`);
}
