const unavailable = "Serviço Pinbank DEV indisponível";

export async function readPinbankResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";
  if (!/^application\/(?:json|[\w.-]+\+json)(?:\s*;|$)/i.test(contentType)) throw new Error(unavailable);
  let data;
  try { data = await response.json(); }
  catch { throw new Error(unavailable); }
  if (!data || typeof data !== "object") throw new Error(unavailable);
  if (!response.ok) {
    throw new Error(typeof data.error === "string" && data.error ? data.error : unavailable);
  }
  return data;
}

export function validatePinbankStatus(data: any) {
  if (data.environment !== "dev"
    || !["enabled", "storageReady", "newOperationsEnabled", "credentialsPresent"].every(key => typeof data[key] === "boolean")
    || !Array.isArray(data.methods) || !data.methods.every((method: any) => method && typeof method.id === "string" && typeof method.label === "string" && typeof method.enabled === "boolean")
    || !Array.isArray(data.pending) || !data.pending.every((item: unknown) => typeof item === "string")) {
    throw new Error(unavailable);
  }
  return data;
}
