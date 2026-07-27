const AURA_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

export function getPreferredAuraAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  return AURA_AUDIO_MIME_TYPES.find(mimeType => MediaRecorder.isTypeSupported(mimeType));
}

export function createAuraMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = getPreferredAuraAudioMimeType();
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

export function getAuraAudioFilename(mimeType?: string): string {
  const normalizedMime = String(mimeType || "").toLowerCase().split(";")[0].trim();

  if (normalizedMime === "audio/mp4" || normalizedMime === "video/mp4" || normalizedMime === "video/quicktime") {
    return "percepcao-aura.mp4";
  }
  if (normalizedMime === "audio/ogg" || normalizedMime === "audio/opus") {
    return "percepcao-aura.ogg";
  }
  if (normalizedMime === "audio/mpeg" || normalizedMime === "audio/mp3") {
    return "percepcao-aura.mp3";
  }
  if (normalizedMime === "audio/wav" || normalizedMime === "audio/x-wav") {
    return "percepcao-aura.wav";
  }
  if (normalizedMime === "audio/aac") {
    return "percepcao-aura.aac";
  }
  if (normalizedMime === "audio/3gpp") {
    return "percepcao-aura.3gp";
  }
  if (normalizedMime === "audio/amr") {
    return "percepcao-aura.amr";
  }

  return "percepcao-aura.webm";
}

export function formatAuraRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
