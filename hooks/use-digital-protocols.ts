"use client";

import { useCallback, useEffect, useState } from "react";
import type { DigitalProtocolLink } from "@/lib/types";
import { DIGITAL_PROTOCOL_LINKS } from "@/lib/mock-data";

const STORAGE_KEY = "prodi_digital_protocols";

function loadFromStorage(): DigitalProtocolLink[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DigitalProtocolLink[];
  } catch {
    return [];
  }
}

function buildInitial(): DigitalProtocolLink[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((item) => item.id));
  return [...DIGITAL_PROTOCOL_LINKS.filter((item) => !ids.has(item.id)), ...stored];
}

export function useDigitalProtocols() {
  const [links, setLinks] = useState<DigitalProtocolLink[]>(buildInitial);

  useEffect(() => {
    const custom = links.filter((link) => !DIGITAL_PROTOCOL_LINKS.find((mock) => mock.id === link.id));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch {
      // ignore
    }
  }, [links]);

  const getForPatient = useCallback(
    (patientId: string) => links.filter((link) => link.patientId === patientId),
    [links],
  );

  const generateLink = useCallback(
    (payload: Omit<DigitalProtocolLink, "id" | "createdAt" | "updatedAt" | "qrCode" | "url">) => {
      const now = new Date().toISOString();
      const id = `dpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newLink: DigitalProtocolLink = {
        ...payload,
        id,
        url: `https://operation-prodi.app/protokoll/${id}`,
        qrCode: `QR-${id}`,
        createdAt: now,
        updatedAt: now,
      };
      setLinks((prev) => [...prev, newLink]);
      return newLink;
    },
    [],
  );

  const updateStatus = useCallback((id: string, status: DigitalProtocolLink["status"]) => {
    setLinks((prev) =>
      prev.map((link) =>
        link.id === id ? { ...link, status, updatedAt: new Date().toISOString() } : link,
      ),
    );
  }, []);

  return { links, getForPatient, generateLink, updateStatus };
}
