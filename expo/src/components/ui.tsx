import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export function Card({ style, children }: { style?: object; children: React.ReactNode }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
  label,
  tone = "neutral",
  style,
}: {
  label: string;
  tone?: "neutral" | "high" | "medium" | "low" | "indigo";
  style?: object;
}) {
  const palette: Record<
    string,
    { background: string; border: string; color: string }
  > = {
    neutral: { background: "rgba(255,255,255,0.04)", border: theme.border, color: theme.textMuted },
    high: { background: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.35)", color: "#fca5a5" },
    medium: { background: "rgba(250,204,21,0.10)", border: "rgba(250,204,21,0.35)", color: theme.warn },
    low: { background: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.35)", color: theme.success },
    indigo: { background: theme.indigoSurface, border: "rgba(165,180,252,0.35)", color: theme.indigo },
  };
  const p = palette[tone] ?? palette.neutral;
  return (
    <View style={[styles.chip, { backgroundColor: p.background, borderColor: p.border }, style]}>
      <Text style={[styles.chipText, { color: p.color }]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.primaryBtnText}>{loading ? "Working…" : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    padding: 14,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  toneNeutral: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: theme.border },
  toneHigh: { backgroundColor: "rgba(248,113,113,0.10)", borderColor: "rgba(248,113,113,0.35)" },
  toneMed: { backgroundColor: "rgba(250,204,21,0.10)", borderColor: "rgba(250,204,21,0.35)" },
  toneLow: { backgroundColor: "rgba(74,222,128,0.10)", borderColor: "rgba(74,222,128,0.35)" },
  toneIndigo: { backgroundColor: theme.indigoSurface, borderColor: "rgba(165,180,252,0.35)" },
  chipText: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  primaryBtn: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: theme.primaryText, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
