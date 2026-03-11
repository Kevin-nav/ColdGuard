import { getValidatedIframeUrl } from "./ColdGuardWifiBridgeView.web";

test("accepts http and https iframe urls", () => {
  expect(getValidatedIframeUrl("https://coldguard.org/device/setup")).toEqual({
    errorMessage: null,
    validatedUrl: "https://coldguard.org/device/setup",
  });
  expect(getValidatedIframeUrl("http://localhost:8080/bridge")).toEqual({
    errorMessage: null,
    validatedUrl: "http://localhost:8080/bridge",
  });
});

test("rejects non-http iframe urls", () => {
  expect(getValidatedIframeUrl("javascript:alert(1)")).toEqual({
    errorMessage: "Unsupported iframe URL protocol: javascript:",
    validatedUrl: null,
  });
});

test("rejects malformed iframe urls", () => {
  expect(getValidatedIframeUrl("not a url")).toEqual({
    errorMessage: "Invalid iframe URL provided.",
    validatedUrl: null,
  });
});
