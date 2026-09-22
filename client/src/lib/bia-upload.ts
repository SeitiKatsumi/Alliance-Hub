export async function uploadBiaFiles(files: File[]): Promise<string[]> {
  if (!files.length) return [];
  const body = new FormData();
  files.forEach(file => body.append("files",file));
  const response = await fetch("/api/upload",{method:"POST",body,credentials:"include"});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Erro no upload");
  if (!Array.isArray(result.fileIds) || result.fileIds.length !== files.length) throw new Error("Upload incompleto. Confira os arquivos antes de continuar.");
  return result.fileIds;
}
