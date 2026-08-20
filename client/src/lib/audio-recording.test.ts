import assert from "node:assert/strict";
import test from "node:test";
import { formatRecordingTime, getAudioRecordingFilename } from "./audio-recording";

test("gera extensão compatível com o formato gravado pelo navegador", () => {
  assert.equal(getAudioRecordingFilename("audio/webm;codecs=opus", "cadastro-imovel"), "cadastro-imovel.webm");
  assert.equal(getAudioRecordingFilename("audio/mp4;codecs=mp4a.40.2", "cadastro-imovel"), "cadastro-imovel.mp4");
  assert.equal(getAudioRecordingFilename("audio/ogg", "cadastro-imovel"), "cadastro-imovel.ogg");
});

test("formata a duração da gravação para exibição", () => {
  assert.equal(formatRecordingTime(0), "00:00");
  assert.equal(formatRecordingTime(65), "01:05");
});
