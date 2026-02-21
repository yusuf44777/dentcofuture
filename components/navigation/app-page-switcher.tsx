"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { History, Home, MessageSquareText, UsersRound } from "lucide-react";
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
              buttonVariants({ variant: route.active ? "default" : "outline" }),
              "h-10 px-4 text-sm",
              !route.active && "bg-white/90"
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
          variant="secondary"
          className="h-10 px-4 text-sm"
          onClick={() => router.push(`/networking/waiting-room?id=${savedProfileId}`)}
        >
          <History className="h-4 w-4" />
          Kayıtlı Profilim
        </Button>
      ) : null}
    </div>
  );
}
