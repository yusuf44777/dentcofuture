import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, PlayCircle, Plus, ToggleLeft, ToggleRight, Trophy } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import {
  createStaffPrize,
  drawStaffRaffle,
  fetchStaffRaffleOverview,
  updateStaffPrize
} from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

type StaffRafflePrize = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  is_active: boolean;
  remaining?: number;
  draw_count?: number;
  is_completed?: boolean;
};

type StaffRaffleDraw = {
  id: string;
  prize_title: string;
  draw_number: number;
  winner_name: string;
  drawn_at: string;
};

export default function StaffRaffleScreen() {
  const queryClient = useQueryClient();
  const { me, query } = useMobileMe();
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [lastWinner, setLastWinner] = useState<string>("");

  const overviewQuery = useQuery({
    queryKey: ["mobile-staff-raffle-overview"],
    queryFn: fetchStaffRaffleOverview,
    enabled: Boolean(me?.role === "staff"),
    refetchInterval: 12_000
  });

  const createPrizeMutation = useMutation({
    mutationFn: () =>
      createStaffPrize({
        title: title.trim(),
        description: description.trim() || undefined,
        quantity: Number(quantity)
      }),
    onSuccess: async () => {
      setTitle("");
      setQuantity("1");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["mobile-staff-raffle-overview"] });
    }
  });

  const drawMutation = useMutation({
    mutationFn: (prizeId: string) => drawStaffRaffle(prizeId),
    onSuccess: async (result) => {
      const winner = result.winner as { winner_name?: string; prize_title?: string } | undefined;
      setLastWinner(
        winner?.winner_name && winner?.prize_title
          ? `${winner.prize_title}: ${winner.winner_name}`
          : "Çekiliş tamamlandı"
      );
      await queryClient.invalidateQueries({ queryKey: ["mobile-staff-raffle-overview"] });
    }
  });

  const togglePrizeMutation = useMutation({
    mutationFn: ({ prizeId, isActive }: { prizeId: string; isActive: boolean }) =>
      updateStaffPrize({
        prizeId,
        isActive
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-staff-raffle-overview"] });
    }
  });

  if (query.isLoading || !me) {
    return (
      <ScreenShell title="Çekiliş Operasyonu" subtitle="Yetki durumu hazırlanıyor.">
        <ActivityIndicator color={colors.accent} size="large" />
      </ScreenShell>
    );
  }

  if (me.role !== "staff") {
    return <Redirect href={"/(participant)" as never} />;
  }

  const prizes = (overviewQuery.data?.prizes ?? []) as StaffRafflePrize[];
  const recentDraws = (overviewQuery.data?.recent_draws ?? []) as StaffRaffleDraw[];

  return (
    <ScreenShell
      title="Çekiliş Operasyonu"
      subtitle="Ödül havuzu yönet, çekiliş başlat ve kazananları canlı takip et."
    >
      <View style={styles.metricRow}>
        <Metric label="Katılımcı" value={String(overviewQuery.data?.stats.participants_total ?? 0)} />
        <Metric label="Aktif Ödül" value={String(overviewQuery.data?.stats.active_prizes ?? 0)} />
        <Metric label="Toplam Çekiliş" value={String(overviewQuery.data?.stats.total_draws ?? 0)} />
      </View>

      {lastWinner ? (
        <View style={styles.successBanner}>
          <Trophy color="#FFFFFF" size={15} />
          <Text style={styles.successText}>{lastWinner}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Plus color={colors.accent} size={16} />
          <Text style={styles.cardTitle}>Yeni Ödül</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Ödül başlığı"
          placeholderTextColor={colors.inkMuted}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Adet"
          placeholderTextColor={colors.inkMuted}
          keyboardType="number-pad"
          value={quantity}
          onChangeText={(value) => setQuantity(value.replace(/[^0-9]/g, "").slice(0, 3))}
        />
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          placeholder="Açıklama"
          placeholderTextColor={colors.inkMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
        <Pressable
          disabled={createPrizeMutation.isPending || title.trim().length < 2 || Number(quantity) < 1}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.pressed : null,
            createPrizeMutation.isPending || title.trim().length < 2 || Number(quantity) < 1
              ? styles.disabled
              : null
          ]}
          onPress={() => {
            createPrizeMutation.mutate();
          }}
        >
          {createPrizeMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Gift color="#FFFFFF" size={14} />
              <Text style={styles.primaryButtonText}>Ödül Ekle</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ödül Havuzu</Text>
        {prizes.map((prize) => (
          <View key={prize.id} style={styles.prizeRow}>
            <View style={styles.prizeInfo}>
              <Text style={styles.prizeTitle}>{prize.title}</Text>
              <Text style={styles.prizeMeta}>
                Kalan {prize.remaining ?? 0}/{prize.quantity} • Çekiliş {prize.draw_count ?? 0}
              </Text>
            </View>
            <View style={styles.prizeActions}>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  drawMutation.mutate(prize.id);
                }}
              >
                <PlayCircle color={colors.accent} size={16} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                onPress={() => {
                  togglePrizeMutation.mutate({
                    prizeId: prize.id,
                    isActive: !prize.is_active
                  });
                }}
              >
                {prize.is_active ? (
                  <ToggleRight color={colors.positive} size={18} />
                ) : (
                  <ToggleLeft color={colors.inkMuted} size={18} />
                )}
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Son Çekilişler</Text>
        {recentDraws.slice(0, 12).map((draw) => (
          <View key={draw.id} style={styles.drawRow}>
            <Text style={styles.drawTitle}>{draw.prize_title}</Text>
            <Text style={styles.drawMeta}>
              #{draw.draw_number} • {draw.winner_name}
            </Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flex: 1,
    padding: spacing.md
  },
  metricValue: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: "700"
  },
  metricLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  successBanner: {
    alignItems: "center",
    backgroundColor: colors.positive,
    borderRadius: radii.md,
    flexDirection: "row",
    marginBottom: spacing.sm,
    padding: spacing.sm
  },
  successText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: spacing.xs
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.sm
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: spacing.xs
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  descriptionInput: {
    minHeight: 76,
    textAlignVertical: "top"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 42
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: spacing.xs
  },
  prizeRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm
  },
  prizeInfo: {
    flex: 1
  },
  prizeTitle: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  prizeMeta: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2
  },
  prizeActions: {
    flexDirection: "row",
    gap: spacing.xs
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  drawRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: spacing.sm
  },
  drawTitle: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  drawMeta: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2
  },
  disabled: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.82
  }
});
