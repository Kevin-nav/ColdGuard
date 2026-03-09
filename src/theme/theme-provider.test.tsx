import { render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Text } from "react-native";
import { ThemeProvider, useTheme } from "./theme-provider";
import { lightColors } from "./tokens";

function ThemeProbe() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <Text testID="text-primary">{colors.textPrimary}</Text>
      <Text testID="is-dark">{String(isDark)}</Text>
    </>
  );
}

test("uses the light palette even when the device scheme is dark", () => {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

  render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );

  expect(screen.getByTestId("text-primary").props.children).toBe(lightColors.textPrimary);
  expect(screen.getByTestId("is-dark").props.children).toBe("false");
});
