import React, { useState } from "react";
import {
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
import { api, AnalyzeResponse } from "../api/client";
import { theme } from "../theme";
import { Card, Chip, PrimaryButton } from "../components/ui";

interface Paper {
  id: string;
  name: string;
  text: string;
}

export default function PyqScreen() {
  const [syllabus, setSyllabus] = useState("");
  const [paperText, setPaperText] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [openModules, setOpenModules] = useState<Record<number, boolean>>({ 0: true });

  const addPaper = () => {
    const text = paperText.trim();
    if (!text) return;
    setPapers((p) => [...p, { id: String(Date.now()), name: `Paper ${p.length + 1}`, text }]);
    setPaperText("");
  };

  const generate = async () => {
    if (!syllabus.trim()) return setError("Please enter the syllabus.");
    if (papers.length === 0) return setError("Please add at least one paper (paste its text).");
    setError(null);
    setBusy(true);
    try {
      const res = await api.analyze(syllabus.trim(), papers.map((p) => ({ name: p.name, text: p.text })));
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed. Please try again.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const modules = Array.isArray(result.modules) ? result.modules : [];
    const priorities = Array.isArray(result.priorityOrder) ? result.priorityOrder : [];
    const focus = Array.isArray(result.focusAreas) ? result.focusAreas : [];
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Pressable onPress={() => setResult(null)}><Text style={styles.back}>← New analysis</Text></Pressable>
          <Text style={styles.headerTitle}>{result.subject || "Analysis Results"}</Text>
          <Text style={styles.headerSub}>Question bank · AI-generated</Text>
        </View>
        <FlatList
          data={modules}
          keyExtractor={(_, i) => String(i)}
          ListHeaderComponent={
            <View>
              {!!result.summary && (
                <Card style={styles.summaryCard}>
                  <Text style={styles.summaryText}>{result.summary}</Text>
                </Card>
              )}
              {typeof result.estimatedHours === "number" && (
                <Chip label={`~${result.estimatedHours} study hours`} tone="indigo" style={{ alignSelf: "flex-start", marginBottom: 12 }} />
              )}
              {focus.length > 0 && (
                <View style={styles.chipRow}>
                  {focus.map((f, i) => <Chip key={i} label={f} tone="medium" />)}
                </View>
              )}
              {priorities.length > 0 && (
                <Card style={{ marginTop: 12 }}>
                  <Text style={styles.sectionTitle}>Do this first</Text>
                  {priorities.map((p, i) => (
                    <View key={i} style={styles.priorityRow}>
                      <Text style={styles.priorityNum}>{i + 1}</Text>
                      <Text style={styles.priorityText}>{p}</Text>
                    </View>
                  ))}
                </Card>
              )}
              <Text style={styles.sectionTitleOuter}>Modules</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const open = !!openModules[index];
            return (
              <Card style={styles.moduleCard}>
                <Pressable onPress={() => setOpenModules((s) => ({ ...s, [index]: !open }))} style={styles.moduleHeader}>
                  <Text style={styles.moduleIndex}>M{index + 1}</Text>
                  <Text style={styles.moduleTitle} numberOfLines={2}>{item.topicName}</Text>
                  <Chip label={item.priority || "Medium"} tone={item.priority === "High" ? "high" : item.priority === "Low" ? "low" : "medium"} />
                </Pressable>
                {open && (
                  <View style={styles.moduleBody}>
                    {!!item.description && <Text style={styles.moduleDesc}>{item.description}</Text>}
                    {Array.isArray(item.questions) && item.questions.length > 0 ? (
                      item.questions.map((q, qi) => (
                        <View key={qi} style={styles.questionCard}>
                          <Text style={styles.questionText}>{q.text}</Text>
                          <View style={styles.chipRow}>
                            {typeof q.marks === "number" && <Chip label={`${q.marks}M`} />}
                            {!!q.difficulty && <Chip label={q.difficulty} tone={q.difficulty === "Hard" ? "high" : q.difficulty === "Easy" ? "low" : "medium"} />}
                            {!!q.yearAppeared && <Chip label={`'${String(q.yearAppeared).slice(-2)}`} />}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.muted}>No specific questions extracted for this module.</Text>
                    )}
                  </View>
                )}
              </Card>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
        <Text style={styles.disclaimer}>PYQ Analyses are for reference only and do not guarantee future exam questions.</Text>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PYQ Analysis</Text>
        <Text style={styles.headerSub}>Upload past papers + syllabus → question bank &amp; plan</Text>
      </View>

      <FlatList
        data={[]}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={
          <View>
            <Card>
              <Text style={styles.sectionTitle}>Syllabus</Text>
              <TextInput
                style={styles.textArea}
                value={syllabus}
                onChangeText={setSyllabus}
                placeholder="Paste syllabus chapters / topics…"
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </Card>

            <Card style={styles.papersCard}>
              <Text style={styles.sectionTitle}>Question papers</Text>
              <TextInput
                style={styles.textAreaSmall}
                value={paperText}
                onChangeText={setPaperText}
                placeholder="Paste one paper's text here…"
                placeholderTextColor={theme.textMuted}
                multiline
              />
              <PrimaryButton label="Add paper" onPress={addPaper} disabled={!paperText.trim()} />
              {papers.length > 0 && (
                <View style={styles.paperList}>
                  {papers.map((p) => (
                    <View key={p.id} style={styles.paperRow}>
                      <Text style={styles.paperName} numberOfLines={1}>{p.name}</Text>
                      <Pressable onPress={() => setPapers((all) => all.filter((x) => x.id !== p.id))}>
                        <Text style={styles.remove}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {error && <Text style={styles.error}>{error}</Text>}
            <PrimaryButton label="Generate Question Bank" onPress={generate} disabled={busy} loading={busy} />
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
      <Text style={styles.disclaimer}>PYQ Analyses are for reference only and do not guarantee future exam questions.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: { paddingTop: 64, paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
  back: { color: theme.indigo, fontSize: 14, fontWeight: "600", marginBottom: 6 },
  headerTitle: { color: theme.text, fontSize: 20, fontWeight: "700" },
  headerSub: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  listContent: { padding: 16, paddingBottom: 24 },
  summaryCard: { marginBottom: 12 },
  summaryText: { color: theme.text, fontSize: 14, lineHeight: 21 },
  sectionTitle: { color: theme.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  sectionTitleOuter: { color: theme.textMuted, fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  textArea: { minHeight: 120, color: theme.text, fontSize: 14, textAlignVertical: "top", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border },
  textAreaSmall: { minHeight: 80, color: theme.text, fontSize: 14, textAlignVertical: "top", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 10 },
  papersCard: { marginTop: 12 },
  paperList: { marginTop: 12 },
  paperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  paperName: { color: theme.text, fontSize: 13, flex: 1 },
  remove: { color: theme.danger, fontSize: 16 },
  error: { color: theme.danger, fontSize: 13, marginTop: 10, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  priorityRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  priorityNum: { color: theme.indigo, fontWeight: "800", fontSize: 13, width: 22 },
  priorityText: { color: theme.text, fontSize: 14, flex: 1 },
  moduleCard: { marginBottom: 10 },
  moduleHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  moduleIndex: { color: theme.indigo, fontWeight: "800", fontSize: 13 },
  moduleTitle: { color: theme.text, fontSize: 15, fontWeight: "600", flex: 1 },
  moduleBody: { borderTopWidth: 1, borderTopColor: theme.borderSoft, marginTop: 12, paddingTop: 12 },
  moduleDesc: { color: theme.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  questionCard: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.borderSoft },
  questionText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  muted: { color: theme.textMuted, fontSize: 13 },
  disclaimer: { textAlign: "center", color: theme.textMuted, fontSize: 11, paddingVertical: 10 },
});
