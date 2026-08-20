import {
  createAudioMediaRecorder,
  formatRecordingTime,
  getAudioRecordingFilename,
  getPreferredAudioMimeType,
} from "./audio-recording";

export const getPreferredAuraAudioMimeType = getPreferredAudioMimeType;
export const createAuraMediaRecorder = createAudioMediaRecorder;

export function getAuraAudioFilename(mimeType?: string): string {
  return getAudioRecordingFilename(mimeType, "percepcao-aura");
}

export const formatAuraRecordingTime = formatRecordingTime;
