const AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export function getPreferredAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  return AUDIO_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

export function createAudioMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = getPreferredAudioMimeType();
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

export function getAudioRecordingFilename(mimeType?: string, baseName = "gravacao"): string {
  const normalizedMime = String(mimeType || "").toLowerCase().split(";")[0].trim();

  if (normalizedMime === "audio/mp4" || normalizedMime === "video/mp4" || normalizedMime === "video/quicktime") {
    return `${baseName}.mp4`;
  }
  if (normalizedMime === "audio/ogg" || normalizedMime === "audio/opus") return `${baseName}.ogg`;
  if (normalizedMime === "audio/mpeg" || normalizedMime === "audio/mp3") return `${baseName}.mp3`;
  if (normalizedMime === "audio/wav" || normalizedMime === "audio/x-wav") return `${baseName}.wav`;
  if (normalizedMime === "audio/aac") return `${baseName}.aac`;
  if (normalizedMime === "audio/3gpp") return `${baseName}.3gp`;
  if (normalizedMime === "audio/amr") return `${baseName}.amr`;
  return `${baseName}.webm`;
}

export function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
