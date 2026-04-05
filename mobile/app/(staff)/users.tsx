import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ToggleLeft, ToggleRight, UserPlus } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import {
  createStaffParticipant,
  fetchStaffParticipants,
  updateStaffParticipant
} from "../../src/lib/mobile-api";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

type StaffParticipant = {
  id: string;
  full_name: string;
  participant_code: string | null;
  external_ref: string | null;
  is_active: boolean;
  created_at: string;
};

export default function StaffUsersScreen() {
  const queryClient = useQueryClient();
  const { me, query } = useMobileMe();
  const [searchDraft, setSearchDraft] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [fullName, setFullName] = useState("");
  const [participantCode, setParticipantCode] = useState("");
  const [externalRef, setExternalRef] = useState("");

  const participantsQuery = useQuery({
    queryKey: ["mobile-staff-participants", searchValue],
    queryFn: () => fetchStaffParticipants({ q: searchValue || undefined, limit: 150 }),
    enabled: Boolean(me?.role === "staff"),
    refetchInterval: 20_000
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createStaffParticipant({
        fullName: fullName.trim(),
        participantCode: participantCode.trim() || undefined,
        externalRef: externalRef.trim() || undefined
      }),
    onSuccess: async () => {
      setFullName("");
      setParticipantCode("");
      setExternalRef("");
      await queryClient.invalidateQueries({ queryKey: ["mobile-staff-participants"] });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ participantId, isActive }: { participantId: string; isActive: boolean }) =>
      updateStaffParticipant({
        participantId,
        isActive
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-staff-participants"] });
    }
  });

  if (query.isLoading || !me) {
    return (
      <ScreenShell title="Participants" subtitle="Yetkiler hazırlanıyor.">
        <ActivityIndicator color={colors.accent} size="large" />
      </ScreenShell>
    );
  }

  if (me.role !== "staff") {
    return <Redirect href={"/(participant)" as never} />;
  }

  const participants = (participantsQuery.data?.participants ?? []) as StaffParticipant[];

  return (
    <ScreenShell
      title="Participants"
      subtitle="Katılımcı listesini yönet, aktiflik durumunu güncelle."
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <UserPlus color={colors.accent} size={16} />
          <Text style={styles.cardTitle}>Yeni Katılımcı</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Ad Soyad"
          placeholderTextColor="#8D9895"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="Participant code"
          placeholderTextColor="#8D9895"
          value={participantCode}
          onChangeText={setParticipantCode}
        />
        <TextInput
          style={styles.input}
          placeholder="External ref"
          placeholderTextColor="#8D9895"
          value={externalRef}
          onChangeText={setExternalRef}
        />
        <Pressable
          disabled={createMutation.isPending || fullName.trim().length < 2}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.pressed : null,
            createMutation.isPending || fullName.trim().length < 2 ? styles.disabled : null
          ]}
          onPress={() => {
            createMutation.mutate();
          }}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Plus color="#FFFFFF" size={14} />
              <Text style={styles.primaryButtonText}>Katılımcı Ekle</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            placeholder="Ad, kod veya ref ile ara"
            placeholderTextColor="#8D9895"
            value={searchDraft}
            onChangeText={setSearchDraft}
          />
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
            onPress={() => {
              setSearchValue(searchDraft.trim());
            }}
          >
            <Search color={colors.accent} size={16} />
          </Pressable>
        </View>
        {participantsQuery.isLoading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        {participants.map((participant) => (
          <View key={participant.id} style={styles.participantRow}>
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>{participant.full_name}</Text>
              <Text style={styles.participantMeta}>
                {participant.participant_code ?? "Kodsuz"} • {participant.external_ref ?? "Ref yok"}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
              onPress={() => {
                toggleMutation.mutate({
                  participantId: participant.id,
                  isActive: !participant.is_active
                });
              }}
            >
              {participant.is_active ? (
                <ToggleRight color={colors.positive} size={18} />
              ) : (
                <ToggleLeft color={colors.inkMuted} size={18} />
              )}
            </Pressable>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
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
  searchRow: {
    alignItems: "center",
    flexDirection: "row"
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: spacing.xs
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  participantRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm
  },
  participantInfo: {
    flex: 1,
    marginRight: spacing.sm
  },
  participantName: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  participantMeta: {
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
