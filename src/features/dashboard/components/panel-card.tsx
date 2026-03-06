import { ReactNode, useMemo } from "react";
import { Pressable, type PressableProps, StyleSheet, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";

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
      <Pressable
        onPress={props.onPress}
        style={({ pressed }) => [shared.card, pressed ? styles.pressed : null]}
        testID={props.testID}
      >
        {props.children}
      </Pressable>
    );
  }

  return (
    <View style={shared.card} testID={props.testID}>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82,
  },
});
