"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DigitalProtocolLink } from "@/lib/types";
import {
  deleteDigitalProtocolLinkClient,
  fetchDigitalProtocolLinksClient,
  persistDigitalProtocolLink,
} from "@/lib/data/patient-digital-protocol-links-client";
import { isLocalMigrationCandidate, isUuid, matchesRecordIdentity } from "@/lib/data/local-records";
import { useAuth } from "@/hooks/use-auth";
import { generateQrDataUrl } from "@/lib/qr";

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

function sortEntries(items: DigitalProtocolLink[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function getLocalOnlyEntries(items: DigitalProtocolLink[]) {
  return items.filter(isLocalMigrationCandidate);
}

function buildInitial(initialEntries: DigitalProtocolLink[] = []): DigitalProtocolLink[] {
  const localOnly = getLocalOnlyEntries(loadFromStorage());
  const merged = [...initialEntries];

  for (const local of localOnly) {
    const existsRemote = initialEntries.some((remoteEntry) =>
      matchesRecordIdentity(remoteEntry, local),
    );
    if (!existsRemote) {
      merged.push(local);
    }
  }

  return sortEntries(merged);
}

interface UseDigitalProtocolsOptions {
  initialLinks?: DigitalProtocolLink[];
}

export function useDigitalProtocols(options: UseDigitalProtocolsOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const initialLinksRef = useRef(options.initialLinks);
  const [links, setLinks] = useState<DigitalProtocolLink[]>(() =>
    buildInitial(options.initialLinks),
  );
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const migrationDone = useRef(false);
  const entriesRef = useRef(links);

  useEffect(() => {
    entriesRef.current = links;
  }, [links]);

  useEffect(() => {
    const custom = getLocalOnlyEntries(links);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch {
      // ignore
    }
  }, [links]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    const initialRemoteEntries = initialLinksRef.current;
    setIsLoadingRemote(!initialRemoteEntries);

    async function syncEntries() {
      try {
        const remoteEntries = initialRemoteEntries ?? await fetchDigitalProtocolLinksClient();
        initialLinksRef.current = undefined;
        if (cancelled) return;

        const localOnly = getLocalOnlyEntries(entriesRef.current);
        const merged = [...remoteEntries];

        for (const local of localOnly) {
          const existsRemote = remoteEntries.some((remoteEntry) =>
            matchesRecordIdentity(remoteEntry, local),
          );
          if (!existsRemote) {
            merged.push(local);
          }
        }

        setLinks(sortEntries(merged));

        if (!migrationDone.current) {
          migrationDone.current = true;
          const pendingMigration = localOnly.filter(
            (localEntry) => !remoteEntries.some((remoteEntry) =>
              matchesRecordIdentity(remoteEntry, localEntry),
            ),
          );

          for (const entry of pendingMigration) {
            void persistDigitalProtocolLink(entry)
              .then((persisted) => {
                setLinks((prev) =>
                  sortEntries(prev.map((item) => (item.id === entry.id ? persisted : item))),
                );
              })
              .catch((err) => {
                console.error(`Failed to migrate digital protocol link ${entry.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync digital protocol links from Supabase:", error);
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    }

    void syncEntries();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const getForPatient = useCallback(
    (patientId: string) => sortEntries(links.filter((link) => link.patientId === patientId)),
    [links],
  );

  const generateLink = useCallback(
    async (payload: Omit<DigitalProtocolLink, "id" | "createdAt" | "updatedAt" | "qrCode" | "url">) => {
      const now = new Date().toISOString();
      const tempId = `dpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const tempUrl = `${origin}/protokoll/${tempId}`;
      let qrCode: string;
      try {
        qrCode = await generateQrDataUrl(tempUrl);
      } catch {
        qrCode = "";
      }
      const newLink: DigitalProtocolLink = {
        ...payload,
        id: tempId,
        url: tempUrl,
        qrCode,
        createdAt: now,
        updatedAt: now,
      };
      setLinks((prev) => sortEntries([newLink, ...prev]));

      if (isAuthenticated) {
        void persistDigitalProtocolLink(newLink)
          .then(async (persisted) => {
            setLinks((prev) =>
              sortEntries(
                prev.map((item) =>
                  item.id === tempId ? { ...persisted, url: `${origin}/protokoll/${persisted.id}` } : item,
                ),
              ),
            );
            // Re-generate QR with the real UUID-based URL
            const realUrl = `${origin}/protokoll/${persisted.id}`;
            let realQr: string;
            try {
              realQr = await generateQrDataUrl(realUrl);
            } catch {
              realQr = persisted.qrCode;
            }
            const latestKnown =
              entriesRef.current.find((item) => item.id === persisted.id || item.id === tempId) ?? persisted;
            const updated = {
              ...persisted,
              status: latestKnown.status,
              url: realUrl,
              qrCode: realQr,
            };
            setLinks((prev) =>
              sortEntries(prev.map((item) => (item.id === tempId || item.id === persisted.id ? updated : item))),
            );
          })
          .catch((err) => {
            console.error("Failed to persist digital protocol link:", err);
          });
      }

      return newLink;
    },
    [isAuthenticated],
  );

  const updateStatus = useCallback(
    (id: string, status: DigitalProtocolLink["status"]) => {
      const currentLink = entriesRef.current.find((link) => link.id === id) ?? null;
      const nextLink = currentLink
        ? { ...currentLink, status, updatedAt: new Date().toISOString() }
        : null;

      setLinks((prev) =>
        sortEntries(
          prev.map((link) => (link.id === id && nextLink ? nextLink : link)),
        ),
      );

      if (isAuthenticated && nextLink) {
        const linkToPersist = nextLink
        const persistPromise = isUuid(linkToPersist.id)
          ? persistDigitalProtocolLink(linkToPersist)
          : fetchDigitalProtocolLinksClient().then((remoteEntries) => {
              const matchedRemote = remoteEntries.find(
                (entry) =>
                  entry.patientId === linkToPersist.patientId &&
                  entry.method === linkToPersist.method &&
                  entry.status !== "expired",
              );
              return persistDigitalProtocolLink({
                ...(matchedRemote ?? linkToPersist),
                status,
              });
            });

        void persistPromise.then((persisted) => {
            setLinks((prev) =>
              sortEntries(
                prev
                  .filter((item) => item.id !== id)
                  .concat(persisted),
              ),
            );
          })
          .catch((err) => {
            console.error("Failed to update digital protocol link:", err);
          });
      }
    },
    [isAuthenticated],
  );

  const deleteLink = useCallback(
    (id: string) => {
      setLinks((prev) => prev.filter((link) => link.id !== id));
      if (isAuthenticated && isUuid(id)) {
        void deleteDigitalProtocolLinkClient(id).catch((err) => {
          console.error("Failed to delete digital protocol link in Supabase:", err);
        });
      }
    },
    [isAuthenticated],
  );

  return { links, getForPatient, generateLink, updateStatus, deleteLink, isLoadingRemote };
}
