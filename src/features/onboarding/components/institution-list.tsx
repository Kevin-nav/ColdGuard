import { Pressable, StyleSheet, Text, View } from "react-native";
import { type LinkableInstitution } from "../services/institution-link";
import { type ColorPalette } from "../../../theme/tokens";

type InstitutionListProps = {
  colors: ColorPalette;
  institutions: LinkableInstitution[];
  selectedInstitutionId: string | null;
  onSelectInstitution: (institutionId: string) => void;
};

export function InstitutionList(props: InstitutionListProps) {
  return (
    <View style={styles.list}>
      {props.institutions.map((institution) => {
        const isSelected = props.selectedInstitutionId === institution.id;
        const location = [institution.district, institution.region].filter(Boolean).join(", ");

        return (
          <Pressable
            key={institution.id}
            accessibilityRole="button"
            onPress={() => props.onSelectInstitution(institution.id)}
            style={[
              styles.item,
              {
                backgroundColor: isSelected ? props.colors.primaryMuted : props.colors.surfaceMuted,
                borderColor: isSelected ? props.colors.primary : props.colors.border,
              },
            ]}
          >
            <Text style={[styles.name, { color: props.colors.textPrimary }]}>{institution.name}</Text>
            {isSelected ? (
              <Text style={[styles.selected, { color: props.colors.primary }]}>Selected institution</Text>
            ) : null}
            <Text style={[styles.meta, { color: props.colors.textSecondary }]}>
              {location || "Tap to select this facility"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  selected: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
