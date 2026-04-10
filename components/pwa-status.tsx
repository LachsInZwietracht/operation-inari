"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PwaStatus() {
  // Default to "online" during SSR so server & client markup stay in sync.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    function handleStatus() {
      setOnline(navigator.onLine);
    }

    // Sync initial status on the client after mount.
    handleStatus();

    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  return (
    <Badge
      variant={online ? "secondary" : "destructive"}
      className="flex items-center gap-1 text-xs"
    >
      {online ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {online ? "PWA online" : "Offline verfügbar"}
    </Badge>
  );
}
