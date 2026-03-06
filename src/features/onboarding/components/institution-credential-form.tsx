import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { type ColorPalette } from "../../../theme/tokens";

type InstitutionCredentialFormProps = {
  colors: ColorPalette;
  isSaving: boolean;
  passcode: string;
  staffId: string;
  validationMessage: string | null;
  onChangePasscode: (value: string) => void;
  onChangeStaffId: (value: string) => void;
  onSubmit: () => void;
};

export function InstitutionCredentialForm(props: InstitutionCredentialFormProps) {
  return (
    <View style={styles.container}>
      <TextInput
        autoCapitalize="characters"
        onChangeText={props.onChangeStaffId}
        placeholder="Staff ID"
        placeholderTextColor={props.colors.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: props.colors.surfaceMuted,
            borderColor: props.colors.border,
            color: props.colors.textPrimary,
          },
        ]}
        value={props.staffId}
      />

      <TextInput
        keyboardType="number-pad"
        onChangeText={props.onChangePasscode}
        placeholder="Passcode"
        placeholderTextColor={props.colors.textSecondary}
        secureTextEntry
        style={[
          styles.input,
          {
            backgroundColor: props.colors.surfaceMuted,
            borderColor: props.colors.border,
            color: props.colors.textPrimary,
          },
        ]}
        value={props.passcode}
      />

      {props.validationMessage ? (
        <Text style={[styles.validation, { color: props.colors.danger }]}>{props.validationMessage}</Text>
      ) : null}

      <Pressable
        disabled={props.isSaving}
        onPress={props.onSubmit}
        style={[
          styles.submit,
          {
            backgroundColor: props.colors.primary,
            opacity: props.isSaving ? 0.55 : 1,
          },
        ]}
      >
        <Text style={[styles.submitText, { color: props.colors.textOnPrimary }]}>
          Link with credentials
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submit: {
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 13,
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700",
  },
  validation: {
    fontSize: 13,
    lineHeight: 18,
  },
});
