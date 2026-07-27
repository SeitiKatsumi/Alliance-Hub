import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuraAudioMetadata } from "./aura-audio";

test("uses the MP4 container signature when an iPhone recording is mislabeled as WebM", () => {
  const mp4Header = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftyp", "ascii"),
    Buffer.from("M4A ", "ascii"),
  ]);

  assert.deepEqual(
    resolveAuraAudioMetadata("percepcao-aura.webm", "audio/mp4;codecs=mp4a.40.2", mp4Header),
    {
      filename: "percepcao-aura.mp4",
      mimeType: "audio/mp4",
    },
  );
});

test("normalizes uploaded M4A files for the transcription API", () => {
  assert.deepEqual(resolveAuraAudioMetadata("gravacao.m4a", "audio/x-m4a"), {
    filename: "percepcao-aura.m4a",
    mimeType: "audio/mp4",
  });
});

test("keeps valid WebM recordings as WebM", () => {
  const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);

  assert.deepEqual(resolveAuraAudioMetadata("percepcao-aura.webm", "audio/webm;codecs=opus", webmHeader), {
    filename: "percepcao-aura.webm",
    mimeType: "audio/webm",
  });
});
