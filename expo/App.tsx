import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { theme } from "./src/theme";
import ChatScreen from "./src/screens/ChatScreen";
import PyqScreen from "./src/screens/PyqScreen";

type Tab = "chat" | "pyq";

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.body}>
        {tab === "chat" ? <ChatScreen /> : <PyqScreen />}
      </View>
      <View style={styles.tabBar}>
        <TabButton label="AI Chat" active={tab === "chat"} onPress={() => setTab("chat")} />
        <TabButton label="PYQ Analysis" active={tab === "pyq"} onPress={() => setTab("pyq")} />
      </View>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  body: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
    paddingBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 10,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: theme.indigoSurface },
  tabText: { color: theme.textMuted, fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: theme.indigo },
});
