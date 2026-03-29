import { ReactNode, useMemo } from "react";
import { ScrollView, type ScrollViewProps, View } from "react-native";
import { createSharedStyles } from "../../../theme/shared-styles";
import { useTheme } from "../../../theme/theme-provider";

type DashboardPageProps = {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
} & Pick<ScrollViewProps, "contentContainerStyle" | "refreshControl">;

export function DashboardPage(props: DashboardPageProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);

  if (props.scroll) {
    return (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, props.contentContainerStyle]}
        refreshControl={props.refreshControl}
        testID={props.testID}
      >
        {props.children}
      </ScrollView>
    );
  }

  return (
    <View style={styles.page} testID={props.testID}>
      {props.children}
    </View>
  );
}
