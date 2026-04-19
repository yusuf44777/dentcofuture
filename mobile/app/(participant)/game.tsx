import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, RefreshCw, Send, Swords, Trophy } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchGameScores, submitGameScore } from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { ensureLocalStoragePolyfill } from "../../src/lib/local-storage-polyfill";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";
import { BOARD_COLS, BOARD_ROWS, type Difficulty } from "../../../dentco_tetris/src/constants/config";
import { COLOR_HEX } from "../../../dentco_tetris/src/constants/colors";
import { PlaqueBlastEngine, type GameSnapshot } from "../../../dentco_tetris/src/game/engine";
import {
  canPlaceBlock,
  computeGhostAnchor,
  type HandBlock
} from "../../../dentco_tetris/src/game/board";

const RANK_COLORS = ["#C9A96E", "#A8A9AD", "#B87333"];

export default function ParticipantGameScreen() {
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { me } = useMobileMe();

  const engineRef = useRef<PlaqueBlastEngine | null>(null);
  if (!engineRef.current) {
    ensureLocalStoragePolyfill();
    engineRef.current = new PlaqueBlastEngine();
  }

  const engine = engineRef.current;
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => engine.getSnapshot());
  const [hasSubmittedCurrentRun, setHasSubmittedCurrentRun] = useState(false);

  const scoresQuery = useQuery({
    queryKey: ["mobile-game-scores"],
    queryFn: fetchGameScores,
    enabled: Boolean(me && me.role === "participant"),
    refetchInterval: 20_000
  });

  const submitMutation = useMutation({
    mutationFn: ({ score, wave }: { score: number; wave: number }) => submitGameScore(score, wave),
    onSuccess: async () => {
      setHasSubmittedCurrentRun(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-game-scores"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-leaderboard"] })
      ]);
    }
  });

  useEffect(() => {
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, Math.min(50, now - last));
      last = now;
      engine.update(delta);
      setSnapshot(engine.getSnapshot());
    }, 40);

    return () => {
      clearInterval(interval);
    };
  }, [engine]);

  if (me?.role === "participant" && !me.attendee) {
    return <Redirect href={"/(participant)/more" as never} />;
  }

  const boardMaxWidth = Math.min(width - spacing.md * 2 - 24, 360);
  const cellSize = Math.max(22, Math.floor(boardMaxWidth / BOARD_COLS));
  const boardWidth = cellSize * BOARD_COLS;
  const boardHeight = cellSize * BOARD_ROWS;

  const canSubmitCurrentRun =
    snapshot.phase === "gameOver" &&
    snapshot.score > 0 &&
    !hasSubmittedCurrentRun &&
    !submitMutation.isPending;

  const selectedBlock = snapshot.selectedIndex !== null
    ? snapshot.hand[snapshot.selectedIndex] ?? null
    : null;

  const canPlaceAtCell = (row: number, col: number) => {
    if (snapshot.phase !== "playing" || !selectedBlock || selectedBlock.placed) {
      return false;
    }

    const anchor = computeGhostAnchor(selectedBlock.shape, row, col);
    return canPlaceBlock(snapshot.board, selectedBlock.shape, anchor.row, anchor.col);
  };

  return (
    <ScreenShell
      title="PLAQUE BLAST"
      subtitle="Yerleşik Block Blast modunda oyna, skoru gönder ve etkinlik puanını yükselt."
    >
      <View style={styles.gameCard}>
        <View style={styles.gameHeader}>
          <MetricPill label="Skor" value={snapshot.score} />
          <MetricPill label="Seviye" value={snapshot.level} />
          <MetricPill label="Tahta" value={`${BOARD_ROWS}x${BOARD_COLS}`} />
        </View>

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{snapshot.statusText}</Text>
          <Pressable
            disabled={snapshot.phase !== "playing" && snapshot.phase !== "paused"}
            style={({ pressed }) => [
              styles.pauseButton,
              pressed ? styles.pressed : null,
              snapshot.phase !== "playing" && snapshot.phase !== "paused" ? styles.disabled : null
            ]}
            onPress={() => {
              engine.togglePause();
              setSnapshot(engine.getSnapshot());
            }}
          >
            {snapshot.phase === "paused" ? <Play color="#FFFFFF" size={14} /> : <Pause color="#FFFFFF" size={14} />}
          </Pressable>
        </View>

        <View style={styles.boardWrap}>
          <View style={[styles.board, { width: boardWidth, height: boardHeight }]}>
            {snapshot.board.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.boardRow}>
                {row.map((cell, colIndex) => (
                  <Pressable
                    key={`cell-${rowIndex}-${colIndex}`}
                    disabled={snapshot.phase !== "playing"}
                    onPress={() => {
                      engine.placeBlock(rowIndex, colIndex);
                      setSnapshot(engine.getSnapshot());
                    }}
                    style={[
                      styles.boardCell,
                      {
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: cell ? COLOR_HEX[cell.color] : "rgba(255,255,255,0.03)",
                        borderColor: canPlaceAtCell(rowIndex, colIndex)
                          ? "rgba(16,185,129,0.7)"
                          : "rgba(255,255,255,0.08)"
                      }
                    ]}
                  />
                ))}
              </View>
            ))}

            {snapshot.phase === "idle" ? (
              <View style={styles.overlay}>
                <Text style={styles.overlayTitle}>Hazırsan Başla</Text>
                <Text style={styles.overlayText}>Kartlardan bir blok seç, tahtaya yerleştir ve hatları temizle.</Text>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    setHasSubmittedCurrentRun(false);
                    engine.start("normal" as Difficulty);
                    setSnapshot(engine.getSnapshot());
                  }}
                >
                  <Play color="#FFFFFF" size={15} />
                  <Text style={styles.primaryButtonText}>Oyunu Başlat</Text>
                </Pressable>
              </View>
            ) : null}

            {snapshot.phase === "paused" ? (
              <View style={styles.overlay}>
                <Text style={styles.overlayTitle}>Duraklatıldı</Text>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
                  onPress={() => {
                    engine.togglePause();
                    setSnapshot(engine.getSnapshot());
                  }}
                >
                  <Play color="#FFFFFF" size={15} />
                  <Text style={styles.primaryButtonText}>Devam Et</Text>
                </Pressable>
              </View>
            ) : null}

            {snapshot.phase === "gameOver" ? (
              <View style={styles.overlay}>
                <Text style={styles.overlayTitle}>Oyun Bitti</Text>
                <Text style={styles.overlayText}>Skorun: {snapshot.score}</Text>
                <View style={styles.gameOverActions}>
                  <Pressable
                    style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
                    onPress={() => {
                      setHasSubmittedCurrentRun(false);
                      engine.restart();
                      setSnapshot(engine.getSnapshot());
                    }}
                  >
                    <RefreshCw color="#FFFFFF" size={15} />
                    <Text style={styles.primaryButtonText}>Tekrar Oyna</Text>
                  </Pressable>
                  <Pressable
                    disabled={!canSubmitCurrentRun}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed ? styles.pressed : null,
                      !canSubmitCurrentRun ? styles.disabled : null
                    ]}
                    onPress={() => {
                      submitMutation.mutate({
                        score: snapshot.score,
                        wave: snapshot.level
                      });
                    }}
                  >
                    {submitMutation.isPending
                      ? <ActivityIndicator color="#FFFFFF" size="small" />
                      : <Send color="#FFFFFF" size={15} />}
                    <Text style={styles.primaryButtonText}>
                      {hasSubmittedCurrentRun ? "Skor Gönderildi" : "Skoru Gönder"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.handHeader}>
          <Swords color={colors.copper} size={15} />
          <Text style={styles.handHeaderText}>Elindeki Bloklar</Text>
        </View>

        <View style={styles.handRow}>
          {snapshot.hand.map((block, index) => (
            <HandBlockCard
              key={block.id}
              block={block}
              selected={snapshot.selectedIndex === index}
              disabled={snapshot.phase !== "playing" || block.placed}
              onPress={() => {
                engine.selectBlock(index);
                setSnapshot(engine.getSnapshot());
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Trophy color={colors.accent} size={16} />
          <Text style={styles.cardTitle}>Liderlik Tablosu</Text>
        </View>
        {scoresQuery.isLoading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        {scoresQuery.data?.personalBest ? (
          <View style={styles.personalBest}>
            <Text style={styles.personalBestTitle}>Kişisel En İyi</Text>
            <Text style={styles.personalBestText}>
              Skor {scoresQuery.data.personalBest.score} · Dalga {scoresQuery.data.personalBest.wave}
            </Text>
          </View>
        ) : (
          <Text style={styles.helpText}>Henüz skor gönderilmedi.</Text>
        )}

        {(scoresQuery.data?.leaderboard ?? []).slice(0, 10).map((entry, index) => (
          <View key={entry.id} style={styles.rankRow}>
            <View style={styles.rankLeft}>
              <Text
                style={[
                  styles.rankNumber,
                  index < 3 ? { color: RANK_COLORS[index] } : { color: colors.inkMuted }
                ]}
              >
                {index + 1}
              </Text>
              <Text style={styles.rankName}>{entry.attendee?.name ?? "Katılımcı"}</Text>
            </View>
            <View style={[styles.rankBadge, index === 0 ? styles.rankBadgeGold : null]}>
              <Text style={[styles.rankScore, index === 0 ? styles.rankScoreGold : null]}>{entry.score}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function HandBlockCard({
  block,
  selected,
  disabled,
  onPress
}: {
  block: HandBlock;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const shapeRows = Math.max(...block.shape.map(([r]) => r), 0) + 1;
  const shapeCols = Math.max(...block.shape.map(([, c]) => c), 0) + 1;
  const shapeSet = new Set(block.shape.map(([r, c]) => `${r}:${c}`));

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.handCard,
        selected ? styles.handCardSelected : null,
        block.placed ? styles.handCardPlaced : null,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null
      ]}
    >
      <View style={styles.handGridWrap}>
        {Array.from({ length: shapeRows }).map((_, row) => (
          <View key={`shape-row-${row}`} style={styles.handGridRow}>
            {Array.from({ length: shapeCols }).map((__, col) => {
              const active = shapeSet.has(`${row}:${col}`);
              return (
                <View
                  key={`shape-cell-${row}-${col}`}
                  style={[
                    styles.handGridCell,
                    active
                      ? { backgroundColor: COLOR_HEX[block.color] }
                      : styles.handGridCellEmpty
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <Text style={styles.handCardLabel}>{block.color}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gameCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(139,92,246,0.15)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  gameHeader: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  metricPill: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 8
  },
  metricLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  metricValue: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2
  },
  statusBar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8
  },
  statusText: {
    color: colors.inkMuted,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginRight: spacing.xs
  },
  pauseButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  boardWrap: {
    alignItems: "center"
  },
  board: {
    backgroundColor: colors.backgroundDeep,
    borderColor: "rgba(139,92,246,0.28)",
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative"
  },
  boardRow: {
    flexDirection: "row"
  },
  boardCell: {
    borderWidth: 1
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(4,3,16,0.9)",
    justifyContent: "center",
    padding: spacing.md
  },
  overlayTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "800"
  },
  overlayText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    textAlign: "center"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.copper,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  gameOverActions: {
    flexDirection: "row",
    gap: spacing.xs
  },
  handHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.md
  },
  handHeaderText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  handRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  handCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10
  },
  handCardSelected: {
    borderColor: colors.accent,
    borderWidth: 2
  },
  handCardPlaced: {
    opacity: 0.5
  },
  handGridWrap: {
    gap: 2
  },
  handGridRow: {
    flexDirection: "row",
    gap: 2
  },
  handGridCell: {
    borderRadius: 3,
    height: 12,
    width: 12
  },
  handGridCellEmpty: {
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  handCardLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 6,
    textTransform: "uppercase"
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(139,92,246,0.15)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 17,
    fontWeight: "700"
  },
  helpText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  },
  personalBest: {
    backgroundColor: "rgba(139,92,246,0.1)",
    borderColor: "rgba(139,92,246,0.25)",
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.sm
  },
  personalBestTitle: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  personalBestText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3
  },
  rankRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9
  },
  rankLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  rankNumber: {
    fontFamily: typography.display,
    fontSize: 13,
    fontWeight: "800",
    width: 20
  },
  rankName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  rankBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  rankBadgeGold: {
    backgroundColor: "rgba(201,169,110,0.15)",
    borderColor: "rgba(201,169,110,0.3)",
    borderWidth: 1
  },
  rankScore: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  rankScoreGold: {
    color: colors.copper
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.82
  }
});
