import path from "path";

export interface AuraAudioMetadata {
  filename: string;
  mimeType: string;
}

function detectAuraAudioContainer(buffer?: Buffer): { mimeType: string; extension: string } | null {
  if (!buffer || buffer.length < 4) return null;

  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mimeType: "audio/webm", extension: ".webm" };
  }
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return { mimeType: "audio/ogg", extension: ".ogg" };
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return { mimeType: "audio/mp4", extension: ".mp4" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return { mimeType: "audio/wav", extension: ".wav" };
  }
  if (
    buffer.subarray(0, 3).toString("ascii") === "ID3" ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return { mimeType: "audio/mpeg", extension: ".mp3" };
  }
  if (buffer.subarray(0, 5).toString("ascii") === "#!AMR") {
    return { mimeType: "audio/amr", extension: ".amr" };
  }

  return null;
}

function normalizeAuraAudioMime(mimeType?: string) {
  const mime = String(mimeType || "").toLowerCase().split(";")[0].trim();
  if (mime === "audio/x-m4a" || mime === "video/mp4" || mime === "video/quicktime") return "audio/mp4";
  if (mime === "audio/mp3") return "audio/mpeg";
  if (mime === "audio/x-wav") return "audio/wav";
  if (mime === "audio/opus") return "audio/ogg";
  return mime;
}

export function resolveAuraAudioMetadata(
  originalName?: string,
  receivedMimeType?: string,
  buffer?: Buffer,
): AuraAudioMetadata {
  const detected = detectAuraAudioContainer(buffer);
  if (detected) {
    return {
      filename: `percepcao-aura${detected.extension}`,
      mimeType: detected.mimeType,
    };
  }

  const originalExt = path.extname(originalName || "").toLowerCase();
  const normalizedMime = normalizeAuraAudioMime(receivedMimeType);
  const allowedMimes = new Set([
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "audio/aac",
    "audio/wav",
    "audio/webm",
    "audio/3gpp",
    "audio/amr",
  ]);
  const mimeByExtension: Record<string, string> = {
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".opus": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".mov": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".3gp": "audio/3gpp",
    ".amr": "audio/amr",
  };
  const mimeType = allowedMimes.has(normalizedMime)
    ? normalizedMime
    : mimeByExtension[originalExt] || "audio/webm";
  const extensionByMime: Record<string, string> = {
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": originalExt === ".m4a" ? ".m4a" : ".mp4",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "audio/3gpp": ".3gp",
    "audio/amr": ".amr",
  };

  return {
    filename: `percepcao-aura${extensionByMime[mimeType] || ".webm"}`,
    mimeType,
  };
}
