import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { supabase } from "../utils/supabase";
import { ScreenShell } from "../src/components/screen-shell";
import { colors, radii, spacing, typography } from "../src/theme/tokens";

type TodoItem = {
  id: number;
  name: string;
};

export default function SupabaseTestScreen() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTodos = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("todos")
          .select("id, name")
          .order("id", { ascending: true });

        if (queryError) {
          setError(queryError.message);
          return;
        }

        setTodos((data ?? []) as TodoItem[]);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Görev listesi alınamadı.");
      } finally {
        setLoading(false);
      }
    };

    void loadTodos();
  }, []);

  return (
    <ScreenShell
      title="Supabase Testi"
      subtitle="todos tablosu üzerinden bağlantı doğrulama ekranı."
    >
      <View style={styles.card}>
        {loading ? <ActivityIndicator color={colors.accent} size="large" /> : null}
        {error ? <Text style={styles.errorText}>Hata: {error}</Text> : null}
        {!loading && !error && todos.length === 0 ? (
          <Text style={styles.emptyText}>Kayıt bulunamadı.</Text>
        ) : null}
        <FlatList
          data={todos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowId}>#{item.id}</Text>
              <Text style={styles.rowName}>{item.name}</Text>
            </View>
          )}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    minHeight: 220,
    padding: spacing.md
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  emptyText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  row: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingVertical: spacing.xs
  },
  rowId: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginRight: spacing.sm
  },
  rowName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13
  }
});
