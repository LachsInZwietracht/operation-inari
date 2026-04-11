"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EgkCardData } from "@/lib/types";
import { EGK_CARDS } from "@/lib/mock-data";

type NavigatorWithSerial = Navigator & { serial?: Serial };

export type EgkScannerStatus = "disconnected" | "connecting" | "ready" | "reading" | "error";

function pickMockCard() {
  const index = Math.floor(Math.random() * EGK_CARDS.length);
  return { ...EGK_CARDS[index] };
}

export function useEgkScanner() {
  const [status, setStatus] = useState<EgkScannerStatus>("disconnected");
  const [lastCard, setLastCard] = useState<EgkCardData | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const serialPortRef = useRef<SerialPort | null>(null);
  const companionEndpoint = process.env.NEXT_PUBLIC_EGK_COMPANION_URL ?? "/api/egk";

  const isSupported = useMemo(() =>
    typeof window !== "undefined" && typeof navigator !== "undefined" && "serial" in navigator,
  [],);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setLastError(null);
    try {
      if (isSupported) {
        const port = await (navigator as NavigatorWithSerial)?.serial?.requestPort();
        if (!port) throw new Error("Kein Kartenleser ausgewählt");
        serialPortRef.current = port;
        if (!port.readable) {
          await port.open({ baudRate: 9600 });
        }
      }
      setStatus("ready");
    } catch (error) {
      console.error("eGK connect error", error);
      setStatus("error");
      setLastError(error instanceof Error ? error.message : "Konnte Kartenleser nicht verbinden");
    } finally {
      setIsConnecting(false);
    }
  }, [isSupported]);

  const disconnect = useCallback(async () => {
    try {
      await serialPortRef.current?.close();
    } catch {
      // ignore close errors
    } finally {
      serialPortRef.current = null;
      setStatus("disconnected");
    }
  }, []);

  const scanCard = useCallback(async () => {
    if (status !== "ready") {
      throw new Error("Kartenleser ist nicht bereit");
    }
    setIsReading(true);
    setLastError(null);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const card = pickMockCard();
    setLastCard(card);
    setIsReading(false);
    return card;
  }, [status]);

  const simulateCard = useCallback(() => {
    const card = pickMockCard();
    setLastCard(card);
    return card;
  }, []);

  const fetchFromCompanion = useCallback(async () => {
    setIsReading(true);
    setLastError(null);
    try {
      const response = await fetch(companionEndpoint);
      if (!response.ok) {
        throw new Error("Companion-Connector antwortet nicht");
      }
      const payload = (await response.json()) as { card: EgkCardData };
      setLastCard(payload.card);
      setStatus("ready");
      return payload.card;
    } catch (error) {
      setStatus("error");
      setLastError(error instanceof Error ? error.message : "Abruf fehlgeschlagen");
      throw error;
    } finally {
      setIsReading(false);
    }
  }, [companionEndpoint]);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  return {
    status,
    isSupported,
    isReading,
    isConnecting,
    lastCard,
    lastError,
    connect,
    disconnect,
    scanCard,
    simulateCard,
    fetchFromCompanion,
  };
}
