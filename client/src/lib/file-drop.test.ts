import test from "node:test";
import assert from "node:assert/strict";
import { applyDroppedFiles, droppedFilesError } from "./file-drop";

const pdf = new File(["documento fictício"], "documento.PDF", { type: "application/pdf" });
const image = new File(["imagem fictícia"], "foto.png", { type: "image/png" });

test("arraste respeita arquivo único, múltiplos e formatos por extensão/MIME", () => {
  assert.equal(droppedFilesError([pdf], ".pdf,image/*", false), null);
  assert.equal(droppedFilesError([image], "image/*", false), null);
  assert.equal(droppedFilesError([pdf, image], ".pdf,image/png", true), null);
  assert.match(droppedFilesError([pdf, image], "", false)!, /um arquivo por vez/);
  assert.match(droppedFilesError([pdf, image], ".pdf", true)!, /foto.png/);
  assert.match(droppedFilesError([], "", true)!, /Arraste um arquivo/);
  assert.equal(droppedFilesError([new File(["texto"], "sem-mime.pdf")], "application/pdf", false), null);
});

test("arraste aciona o mesmo change nativo uma vez e preserva seleção ao rejeitar arquivos", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "DataTransfer");
  class Transfer {
    files: File[] = [];
    items = { add: (file: File) => this.files.push(file) };
  }
  Object.defineProperty(globalThis, "DataTransfer", { configurable: true, value: Transfer });
  try {
    const changes: Event[] = [];
    const field: any = { accept: ".pdf,.png", multiple: true, disabled: false, matches: () => false,
      files: [], dispatchEvent: (event: Event) => changes.push(event) };
    assert.equal(applyDroppedFiles(field, [pdf, image]), null);
    assert.deepEqual(field.files, [pdf, image]);
    assert.equal(changes.length, 1); assert.equal(changes[0].type, "change"); assert.equal(changes[0].bubbles, true);
    field.multiple = false;
    assert.match(applyDroppedFiles(field, [pdf, image])!, /um arquivo por vez/);
    assert.deepEqual(field.files, [pdf, image]); assert.equal(changes.length, 1);
    field.disabled = true;
    assert.equal(applyDroppedFiles(field, [pdf]), null); assert.equal(changes.length, 1);
    field.disabled = false; field.matches = () => true;
    assert.equal(applyDroppedFiles(field, [pdf]), null); assert.equal(changes.length, 1);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "DataTransfer", descriptor);
    else Reflect.deleteProperty(globalThis, "DataTransfer");
  }
});
