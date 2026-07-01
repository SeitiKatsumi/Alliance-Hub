export type AcceptanceLocationStatus = "capturada" | "negada" | "indisponivel" | "erro";

export type AcceptanceLocation = {
  status: AcceptanceLocationStatus;
  captured_at: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  message?: string;
};

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
