import assert from "node:assert/strict";
import test from "node:test";
import { captureRequiredAcceptanceLocation } from "./acceptanceLocation";

test("envia ao backend uma localização válida com status capturada", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => success({
          coords: {
            latitude: -19.9191,
            longitude: -43.9386,
            accuracy: 12,
          },
        } as GeolocationPosition),
      },
    },
  });

  try {
    const location = await captureRequiredAcceptanceLocation();
    assert.equal(location.status, "capturada");
    assert.equal(location.latitude, -19.9191);
    assert.equal(location.longitude, -43.9386);
    assert.equal(location.accuracy, 12);
    assert.match(location.captured_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
