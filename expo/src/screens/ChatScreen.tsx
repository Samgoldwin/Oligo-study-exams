import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { api, ChatMessageLite, ChatResponse } from "../api/client";
import { theme } from "../theme";
import { Card, Chip } from "../components/ui";

export default function ChatScreen() {
  const [messages, setMessages] = useState<Array<ChatMessageLite & { meta?: ChatResponse }>>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const user: ChatMessageLite = { role: "user", content: text };
    const next = [...messages, user];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const res = await api.chat(text, next.filter((m) => m.role === "user").map((m) => ({ role: m.role, content: m.content })));
      setMessages((m) => [...m, { role: "assistant", content: res.answer, meta: res }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the backend.");
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item }: { item: ChatMessageLite & { meta?: ChatResponse } }) => {
    if (item.role === "user") {
      return (
        <View style={styles.userRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.content}</Text>
          </View>
        </View>
      );
    }
    const meta = item.meta;
    return (
      <View style={styles.assistantRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>S</Text>
        </View>
        <View style={styles.assistantBody}>
          <Text style={styles.assistantText}>{item.content}</Text>

          {meta && meta.related_resources.length > 0 && (
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>VTUSync resources</Text>
              {meta.related_resources.map((r) => (
                <View key={r.id} style={styles.resourceRow}>
                  <Chip label={r.type} tone="indigo" />
                  <Text style={styles.resourceTitle} numberOfLines={2}>{r.title}</Text>
                </View>
              ))}
            </Card>
          )}

          {meta && meta.videos.length > 0 && (
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>External · YouTube</Text>
              {meta.videos.map((v) => (
                <Pressable key={v.videoId} onPress={() => undefined}>
                  <View style={styles.videoRow}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{v.title}</Text>
                    <Text style={styles.videoMeta}>{v.channel}{v.duration ? ` · ${v.duration}` : ""}</Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          )}

          {meta && meta.grounded && (
            <Text style={styles.grounded}>Grounded: {meta.grounded}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SyncAI</Text>
        <Text style={styles.headerSub}>VTUSync Academic Assistant</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>How can I help you today?</Text>
            <Text style={styles.emptySub}>Ask about any VTU subject.</Text>
          </View>
        }
      />

      {busy && (
        <View style={styles.typing}>
          <ActivityIndicator size="small" color={theme.textMuted} />
          <Text style={styles.typingText}>Thinking…</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask any VTU question…"
          placeholderTextColor={theme.textMuted}
          multiline
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <Pressable onPress={send} disabled={busy || !draft.trim()} style={({ pressed }) => [styles.sendBtn, (busy || !draft.trim()) && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>SyncAI can make mistakes. Please verify important information.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: { paddingTop: 64, paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerTitle: { color: theme.text, fontSize: 20, fontWeight: "700" },
  headerSub: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 24 },
  empty: { paddingTop: 80, alignItems: "center" },
  emptyTitle: { color: theme.text, fontSize: 22, fontWeight: "600" },
  emptySub: { color: theme.textMuted, fontSize: 14, marginTop: 6 },
  userRow: { alignItems: "flex-end", marginBottom: 10 },
  userBubble: { backgroundColor: "#1c1c1f", borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "82%" },
  userText: { color: theme.text, fontSize: 15, lineHeight: 21 },
  assistantRow: { flexDirection: "row", marginBottom: 14 },
  avatar: { width: 30, height: 30, borderRadius: 9, backgroundColor: theme.indigoDeep, alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 2 },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  assistantBody: { flex: 1 },
  assistantText: { color: theme.text, fontSize: 15, lineHeight: 22 },
  sectionCard: { marginTop: 10, padding: 12 },
  sectionTitle: { color: theme.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  resourceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  resourceTitle: { color: theme.text, fontSize: 13, flex: 1 },
  videoRow: { marginBottom: 8 },
  videoTitle: { color: theme.indigo, fontSize: 13, fontWeight: "600" },
  videoMeta: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  grounded: { color: theme.textMuted, fontSize: 11, marginTop: 8 },
  typing: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  typingText: { color: theme.textMuted, fontSize: 13 },
  error: { color: theme.danger, fontSize: 13, paddingHorizontal: 20, paddingBottom: 6 },
  composer: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  input: {
    flex: 1,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14,
    color: theme.text,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: { backgroundColor: theme.primary, width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sendText: { color: theme.primaryText, fontSize: 22, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  disclaimer: { textAlign: "center", color: theme.textMuted, fontSize: 11, paddingVertical: 10 },
});
