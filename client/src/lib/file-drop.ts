export function droppedFilesError(files: File[], accept: string, multiple: boolean): string | null {
  if (!files.length) return "Arraste um arquivo para esta área.";
  if (!multiple && files.length > 1) return "Este campo aceita um arquivo por vez.";
  const formats = accept.toLowerCase().split(",").map(value => value.trim()).filter(Boolean);
  const invalid = files.find(file => formats.length && !formats.some(format => {
    if (format.startsWith(".")) return file.name.toLowerCase().endsWith(format);
    // Some operating systems omit the MIME type. The upload endpoint still validates the file.
    if (!file.type) return true;
    const mime = file.type.toLowerCase();
    return format.endsWith("/*") ? mime.startsWith(format.slice(0, -1)) : mime === format;
  }));
  return invalid ? `Formato não aceito: ${invalid.name}. Use os formatos indicados neste campo.` : null;
}

export function applyDroppedFiles(input: HTMLInputElement, files: File[]): string | null {
  if (input.disabled || input.matches(":disabled")) return null;
  const error = droppedFilesError(files, input.accept, input.multiple);
  if (error) return error;
  const transfer = new DataTransfer();
  files.forEach(file => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return null;
}
