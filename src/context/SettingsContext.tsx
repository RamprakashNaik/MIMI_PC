"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface Pico {
  id: string;
  name: string;
  systemPrompt: string;
  firstMessage?: string;
  createdAt: number;
}

interface SettingsContextType {
  providers: Provider[];
  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>;
  picos: Pico[];
  setPicos: React.Dispatch<React.SetStateAction<Pico[]>>;
  selectedPicoId: string | null;
  setSelectedPicoId: (id: string | null) => void;
  selectedModelId: string | null;
  setSelectedModelId: (modelId: string | null) => void;
  selectedProviderId: string | null;
  setSelectedProviderId: (providerId: string | null) => void;
  tavilyApiKey: string;
  setTavilyApiKey: (key: string) => void;
  defaultModelId: string | null;
  setDefaultModelId: (id: string | null) => void;
  defaultProviderId: string | null;
  setDefaultProviderId: (id: string | null) => void;
  defaultWebSearch: boolean;
  setDefaultWebSearch: (enabled: boolean) => void;
  gmailAccessToken: string | null;
  setGmailAccessToken: (token: string | null) => void;
  gmailRefreshToken: string | null;
  setGmailRefreshToken: (token: string | null) => void;
  gmailTokenExpiry: number | null;
  setGmailTokenExpiry: (expiry: number | null) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [picos, setPicos] = useState<Pico[]>([]);
  const [selectedPicoId, setSelectedPicoId] = useState<string | null>(null);
  
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null);
  const [tavilyApiKey, setTavilyApiKey] = useState<string>("");
  const [defaultWebSearch, setDefaultWebSearch] = useState<boolean>(true);
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const [gmailRefreshToken, setGmailRefreshToken] = useState<string | null>(null);
  const [gmailTokenExpiry, setGmailTokenExpiry] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from LocalStorage on mount
  useEffect(() => {
    const storedProviders = localStorage.getItem("mimi_providers");
    const storedPicos = localStorage.getItem("mimi_picos");
    const storedPicoId = localStorage.getItem("mimi_selectedPicoId");
    const storedModel = localStorage.getItem("mimi_selectedModelId");
    const storedProvider = localStorage.getItem("mimi_selectedProviderId");
    const storedDefaultModel = localStorage.getItem("mimi_defaultModelId");
    const storedDefaultProvider = localStorage.getItem("mimi_defaultProviderId");
    const storedTavily = localStorage.getItem("mimi_tavily_key");
    const storedDefaultSearch = localStorage.getItem("mimi_default_websearch");
    const storedGmailAccess = localStorage.getItem("mimi_gmail_access_token");
    const storedGmailRefresh = localStorage.getItem("mimi_gmail_refresh_token");
    const storedGmailExpiry = localStorage.getItem("mimi_gmail_token_expiry");
    
    if (storedProviders) {
      try { setProviders(JSON.parse(storedProviders)); } catch (e) {}
    } else {
      // Auto-Migration from Legacy Single API logic
      const legacyApiKey = localStorage.getItem("mimi_apiKey");
      const legacyBaseUrl = localStorage.getItem("mimi_baseUrl");
      
      if (legacyBaseUrl) {
        const legacyProvider: Provider = {
          id: 'legacy-provider-1',
          name: 'Default Provider',
          baseUrl: legacyBaseUrl,
          apiKey: legacyApiKey || ''
        };
        setProviders([legacyProvider]);
        
        const legacyModel = localStorage.getItem("mimi_selectedModel");
        if (legacyModel) {
            setSelectedModelId(legacyModel);
            setSelectedProviderId('legacy-provider-1');
        }
      } else {
        // Absolute fresh install fallback
        setProviders([{
          id: Date.now().toString(),
          name: "Local Ollama",
          baseUrl: "http://localhost:11434/v1",
          apiKey: ""
        }]);
      }
    }

    if (storedPicos) try { setPicos(JSON.parse(storedPicos)); } catch(e) {}
    if (storedPicoId) setSelectedPicoId(storedPicoId);
    if (storedModel) setSelectedModelId(storedModel);
    if (storedProvider) setSelectedProviderId(storedProvider);
    if (storedDefaultModel) setDefaultModelId(storedDefaultModel);
    if (storedDefaultProvider) setDefaultProviderId(storedDefaultProvider);
    if (storedTavily) setTavilyApiKey(storedTavily);
    if (storedDefaultSearch !== null) setDefaultWebSearch(storedDefaultSearch === "true");
    if (storedGmailAccess) setGmailAccessToken(storedGmailAccess);
    if (storedGmailRefresh) setGmailRefreshToken(storedGmailRefresh);
    if (storedGmailExpiry) setGmailTokenExpiry(Number(storedGmailExpiry));
    setIsLoaded(true);
  }, []);

  // Sync to LocalStorage
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("mimi_providers", JSON.stringify(providers));
    localStorage.setItem("mimi_picos", JSON.stringify(picos));
    
    if (selectedPicoId) localStorage.setItem("mimi_selectedPicoId", selectedPicoId);
    else localStorage.removeItem("mimi_selectedPicoId");

    localStorage.setItem("mimi_selectedModelId", selectedModelId || "");
    localStorage.setItem("mimi_selectedProviderId", selectedProviderId || "");
    localStorage.setItem("mimi_defaultModelId", defaultModelId || "");
    localStorage.setItem("mimi_defaultProviderId", defaultProviderId || "");
    localStorage.setItem("mimi_tavily_key", tavilyApiKey);
    localStorage.setItem("mimi_default_websearch", defaultWebSearch.toString());
    
    if (gmailAccessToken) localStorage.setItem("mimi_gmail_access_token", gmailAccessToken);
    else localStorage.removeItem("mimi_gmail_access_token");

    if (gmailRefreshToken) localStorage.setItem("mimi_gmail_refresh_token", gmailRefreshToken);
    else localStorage.removeItem("mimi_gmail_refresh_token");

    if (gmailTokenExpiry) localStorage.setItem("mimi_gmail_token_expiry", gmailTokenExpiry.toString());
    else localStorage.removeItem("mimi_gmail_token_expiry");
  }, [providers, picos, selectedPicoId, selectedModelId, selectedProviderId, tavilyApiKey, defaultWebSearch, gmailAccessToken, gmailRefreshToken, gmailTokenExpiry, isLoaded]);

  const contextValue = React.useMemo(() => ({
    providers, setProviders,
    picos, setPicos,
    selectedPicoId, setSelectedPicoId,
    selectedModelId, setSelectedModelId,
    selectedProviderId, setSelectedProviderId,
    tavilyApiKey, setTavilyApiKey,
    defaultModelId, setDefaultModelId,
    defaultProviderId, setDefaultProviderId,
    defaultWebSearch, setDefaultWebSearch,
    gmailAccessToken, setGmailAccessToken,
    gmailRefreshToken, setGmailRefreshToken,
    gmailTokenExpiry, setGmailTokenExpiry
  }), [providers, picos, selectedPicoId, selectedModelId, selectedProviderId, tavilyApiKey, defaultModelId, defaultProviderId, defaultWebSearch, gmailAccessToken, gmailRefreshToken, gmailTokenExpiry]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
