import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenShell } from "../../src/components/screen-shell";
import { requestOtp, verifyOtp } from "../../src/lib/mobile-api";
import { useAuthSessionStore } from "../../src/store/auth-session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

type Step = "email" | "otp";

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthSessionStore((state) => state.setSession);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await requestOtp(normalizedEmail);
      setStep("otp");
      setMessage("Doğrulama kodu e-posta adresinize gönderildi.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "OTP gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const confirmOtp = async () => {
    if (otp.trim().length < 4) {
      setError("Geçerli OTP kodunu girin.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const verified = await verifyOtp(email.trim().toLowerCase(), otp.trim());
      await setSession({
        accessToken: verified.accessToken,
        refreshToken: verified.refreshToken,
        expiresAt: verified.expiresAt,
        email: verified.user?.email
      });
      router.replace("/");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "OTP doğrulanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell
      title="Güvenli Giriş"
      subtitle="Communitive Dentistry Super App için Supabase Email OTP ile oturum açın."
    >
      <View style={styles.card}>
        <Text style={styles.label}>E-posta</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="ornek@eposta.com"
          placeholderTextColor="#8D9895"
          style={styles.input}
          value={email}
        />

        {step === "otp" ? (
          <>
            <Text style={[styles.label, styles.otpLabel]}>OTP Kodu</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              keyboardType="number-pad"
              onChangeText={(value) => {
                setOtp(value.replace(/[^0-9]/g, "").slice(0, 8));
              }}
              placeholder="123456"
              placeholderTextColor="#8D9895"
              style={styles.input}
              value={otp}
            />
          </>
        ) : null}

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          disabled={busy}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, busy ? styles.disabled : null]}
          onPress={() => {
            void (step === "email" ? sendOtp() : confirmOtp());
          }}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{step === "email" ? "Kodu Gönder" : "Doğrula ve Devam Et"}</Text>}
        </Pressable>

        {step === "otp" ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
            onPress={() => {
              setStep("email");
              setOtp("");
              setError("");
            }}
          >
            <Text style={styles.secondaryButtonText}>E-postayı Değiştir</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg
  },
  label: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  otpLabel: {
    marginTop: spacing.md
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 15,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  messageText: {
    color: colors.positive,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: 8
  },
  secondaryButtonText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  disabled: {
    opacity: 0.7
  },
  pressed: {
    opacity: 0.82
  }
});
