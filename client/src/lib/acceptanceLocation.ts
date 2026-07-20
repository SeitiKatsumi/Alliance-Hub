export type AcceptanceLocationStatus = "capturada" | "negada" | "indisponivel" | "erro";

export type AcceptanceLocation = {
  status: AcceptanceLocationStatus;
  captured_at: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  message?: string;
};

export type CapturedAcceptanceLocation = AcceptanceLocation & {
  status: "capturada";
  latitude: number;
  longitude: number;
};

export const ACCEPTANCE_LOCATION_NOTICE =
  "Para registrar o aceite, permita o acesso à localização do dispositivo. As coordenadas, a precisão e o horário serão vinculados ao comprovante.";

export function isCapturedAcceptanceLocation(
  location: AcceptanceLocation
): location is CapturedAcceptanceLocation {
  return location.status === "capturada"
    && Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && Number(location.latitude) >= -90
    && Number(location.latitude) <= 90
    && Number(location.longitude) >= -180
    && Number(location.longitude) <= 180;
}

export async function captureAcceptanceLocation(): Promise<AcceptanceLocation> {
  const captured_at = new Date().toISOString();
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { status: "indisponivel", captured_at, message: "Geolocalizacao indisponivel neste navegador." };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        status: "capturada",
        captured_at: new Date().toISOString(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        const status: AcceptanceLocationStatus = error.code === error.PERMISSION_DENIED ? "negada" : "erro";
        resolve({
          status,
          captured_at: new Date().toISOString(),
          message: error.message || (status === "negada" ? "Permissao de localizacao negada." : "Nao foi possivel capturar a localizacao."),
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export async function captureRequiredAcceptanceLocation(): Promise<CapturedAcceptanceLocation> {
  const location = await captureAcceptanceLocation();
  if (isCapturedAcceptanceLocation(location)) return location;

  if (location.status === "negada") {
    throw new Error("A localização é obrigatória para registrar o aceite. Autorize o acesso nas configurações do navegador e tente novamente.");
  }
  if (location.status === "indisponivel") {
    throw new Error("Este dispositivo ou navegador não disponibilizou a localização. Ative o serviço de localização e tente novamente.");
  }
  throw new Error("Não foi possível obter sua localização. Verifique a permissão e o sinal de localização antes de tentar novamente.");
}
