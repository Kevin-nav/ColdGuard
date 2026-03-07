import { ReactNode, useMemo } from "react";
import { type PressableProps, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";
import { AnimatedPressable } from "../../../components/animated-pressable";

type BaseProps = {
  children: ReactNode;
  testID?: string;
};

type StaticCardProps = BaseProps & {
  interactive?: false;
};

type InteractiveCardProps = BaseProps & {
  interactive: true;
  onPress: NonNullable<PressableProps["onPress"]>;
};

type PanelCardProps = StaticCardProps | InteractiveCardProps;

export function PanelCard(props: PanelCardProps) {
  const { colors } = useTheme();
  const shared = useMemo(() => createSharedStyles(colors), [colors]);

  if (props.interactive) {
    return (
      <AnimatedPressable
        onPress={props.onPress}
        style={shared.card}
        testID={props.testID}
      >
        {props.children}
      </AnimatedPressable>
    );
  }

  return (
    <View style={shared.card} testID={props.testID}>
      {props.children}
    </View>
  );
}
