import { presentDeviceError } from "./error-presenter";

test("maps known transport codes to plain english and keeps the developer code", () => {
  expect(presentDeviceError(new Error("ENROLLMENT_BOOTSTRAP_INVALID"), "fallback")).toEqual({
    developerCode: "ENROLLMENT_BOOTSTRAP_INVALID",
    userMessage:
      "This pairing code no longer matches the device. Generate a new enrollment code on the device and try again.",
  });
});

test("maps enrollment-not-ready into a device-menu instruction", () => {
  expect(presentDeviceError(new Error("ENROLLMENT_NOT_READY"), "fallback")).toEqual({
    developerCode: "ENROLLMENT_NOT_READY",
    userMessage: "The device is not in enrollment mode. Use the device button and menu to start a new enrollment first.",
  });
});

test("keeps an unknown raw message available as the developer code", () => {
  expect(presentDeviceError(new Error("Service 6B8F7B61-8B30-4A70-BD9A-44B4C1D7C110 for device ? not found"), "fallback")).toEqual({
    developerCode: "Service 6B8F7B61-8B30-4A70-BD9A-44B4C1D7C110 for device ? not found",
    userMessage: "Service 6B8F7B61-8B30-4A70-BD9A-44B4C1D7C110 for device ? not found",
  });
});
