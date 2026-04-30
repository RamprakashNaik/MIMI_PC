"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import localforage from "localforage";

export type ArtifactType = "html" | "svg" | "code" | "markdown" | "excel";

export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  status?: 'generating' | 'complete';
};

interface ArtifactContextType {
  activeArtifact: Artifact | null;
  setActiveArtifact: (artifact: Artifact | null) => void;
  isPanelOpen: boolean;
  setIsPanelOpen: (isOpen: boolean) => void;
  artifacts: Artifact[];
  addOrUpdateArtifact: (artifact: Artifact) => void;
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined);

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localforage
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedArtifacts = await localforage.getItem<Artifact[]>("mimi_artifacts");
        const savedActive = await localforage.getItem<Artifact>("mimi_active_artifact");
        const savedPanelOpen = await localforage.getItem<boolean>("mimi_panel_open");

        if (savedArtifacts) setArtifacts(savedArtifacts);
        if (savedActive) setActiveArtifact(savedActive);
        if (savedPanelOpen !== null) setIsPanelOpen(savedPanelOpen);
      } catch (e) {
        console.error("Failed to load Artifact state:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadState();
  }, []);

  // Save to localforage
  useEffect(() => {
    if (!isLoaded) return;
    const saveState = async () => {
      try {
        await localforage.setItem("mimi_artifacts", artifacts);
        await localforage.setItem("mimi_active_artifact", activeArtifact);
        await localforage.setItem("mimi_panel_open", isPanelOpen);
      } catch (e) {
        console.error("Failed to save Artifact state:", e);
      }
    };
    saveState();
  }, [artifacts, activeArtifact, isPanelOpen, isLoaded]);

  const addOrUpdateArtifact = useCallback((artifact: Artifact) => {
    setArtifacts((prev) => {
      const exists = prev.findIndex((a) => a.id === artifact.id);
      if (exists !== -1) {
        if (prev[exists].content === artifact.content && prev[exists].title === artifact.title && prev[exists].status === artifact.status) {
          return prev;
        }
        const updated = [...prev];
        updated[exists] = artifact;
        return updated;
      }
      return [...prev, artifact];
    });
    
    setActiveArtifact(artifact);
  }, []);

  const contextValue = React.useMemo(() => ({
    activeArtifact, setActiveArtifact,
    isPanelOpen, setIsPanelOpen,
    artifacts, addOrUpdateArtifact
  }), [activeArtifact, isPanelOpen, artifacts, addOrUpdateArtifact]);

  return (
    <ArtifactContext.Provider value={contextValue}>
      {children}
    </ArtifactContext.Provider>
  );
}


export function useArtifacts() {
  const context = useContext(ArtifactContext);
  if (!context) throw new Error("useArtifacts must be used within ArtifactProvider");
  return context;
}
