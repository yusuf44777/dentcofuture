"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { History, Home, Images, MessageSquareText, UsersRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NETWORKING_PROFILE_STORAGE_KEY = "dentco_networking_profile_id";

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type AppPageSwitcherProps = {
  className?: string;
  showSavedProfileButton?: boolean;
};

export function AppPageSwitcher({
  className,
  showSavedProfileButton = true
}: AppPageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [savedProfileId, setSavedProfileId] = useState("");

  useEffect(() => {
    const value = localStorage.getItem(NETWORKING_PROFILE_STORAGE_KEY)?.trim() ?? "";
    if (isValidUuid(value)) {
      setSavedProfileId(value);
    }
  }, []);

  const routes = useMemo(
    () => [
      {
        href: "/",
        label: "Ana Sayfa",
        icon: Home,
        active: pathname === "/"
      },
      {
        href: "/submit",
        label: "Soru Akışı",
        icon: MessageSquareText,
        active: pathname === "/submit" || pathname === "/oyla"
      },
      {
        href: "/networking",
        label: "Networking",
        icon: UsersRound,
        active: pathname.startsWith("/networking")
      },
      {
        href: "/galeri",
        label: "Galeri",
        icon: Images,
        active: pathname === "/galeri"
      }
    ],
    [pathname]
  );

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2.5", className)}>
      {routes.map((route) => {
        const Icon = route.icon;
        return (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              route.active
                ? "inline-flex h-10 items-center gap-2 rounded-full bg-[#7B6EFF] px-4 text-sm font-semibold text-white transition-all"
                : "inline-flex h-10 items-center gap-2 rounded-full border border-[rgba(123,110,255,0.2)] bg-[rgba(12,16,48,0.6)] px-4 text-sm font-medium text-[rgba(180,170,255,0.6)] transition-all hover:border-[rgba(123,110,255,0.4)] hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {route.label}
          </Link>
        );
      })}

      {showSavedProfileButton && savedProfileId ? (
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-full border border-[rgba(123,110,255,0.2)] px-4 text-sm text-[rgba(180,170,255,0.6)] hover:border-[rgba(123,110,255,0.4)] hover:text-white"
          onClick={() => router.push(`/networking/waiting-room?id=${savedProfileId}`)}
        >
          <History className="h-4 w-4" />
          Kayıtlı Profilim
        </Button>
      ) : null}
    </div>
  );
}
