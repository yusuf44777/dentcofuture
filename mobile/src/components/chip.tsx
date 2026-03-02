import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed ? styles.pressed : null
      ]}
    >
      <Text style={[styles.label, selected ? styles.selectedLabel : styles.unselectedLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 1,
    marginBottom: spacing.sm,
    marginRight: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  unselected: {
    backgroundColor: colors.surface,
    borderColor: colors.line
  },
  pressed: {
    opacity: 0.82
  },
  label: {
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  selectedLabel: {
    color: "#FFFFFF"
  },
  unselectedLabel: {
    color: colors.ink
  }
});
