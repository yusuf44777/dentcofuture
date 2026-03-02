import { Redirect, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { ScreenShell } from "../src/components/screen-shell";
import { ProfileEditor } from "../src/components/profile-editor";
import { createNetworkingProfile } from "../src/lib/networking";
import { useNetworkingSessionStore } from "../src/store/networking-session";

export default function OnboardingScreen() {
  const router = useRouter();
  const hydrated = useNetworkingSessionStore((state) => state.hydrated);
  const profileId = useNetworkingSessionStore((state) => state.profileId);
  const setProfileId = useNetworkingSessionStore((state) => state.setProfileId);

  const createMutation = useMutation({
    mutationFn: createNetworkingProfile,
    onSuccess: async (response) => {
      await setProfileId(response.id);
      router.replace("/discovery");
    }
  });

  if (hydrated && profileId) {
    return <Redirect href="/discovery" />;
  }

  return (
    <ScreenShell
      title="Diş hekimleri için mobil networking"
      subtitle="Profilini kur, klinik hedeflerini belirt ve kahve molasında kimi görmen gerektiğini anında bul."
    >
      <ProfileEditor
        busy={createMutation.isPending}
        errorMessage={createMutation.error instanceof Error ? createMutation.error.message : undefined}
        helperText="En az ad soyad, uzmanlık ve kariyer yönü yeterli; diğer alanlar eşleşme puanını yükseltir."
        submitLabel="Profili Oluştur"
        onSubmit={(values) => {
          createMutation.mutate(values);
        }}
      />
    </ScreenShell>
  );
}
