"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import localforage from "localforage";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: {
    dataUrl?: string;       // images only
    name: string;
    type: string;
    extractedText?: string; // documents: PDF / Word / Excel / text
    fileSize?: number;      // bytes
  }[];
  searchResults?: {
    title: string;
    url: string;
    content: string;
  }[];
  gmailResults?: any[];
  agentPlan?: any; // TaskPlan (using any to avoid circular import if needed, but we'll try to import)
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  pinned: boolean;
  updatedAt: number;
  modelId?: string;
  providerId?: string;
  picoId?: string;
};

interface ChatContextType {
  chats: Chat[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  createNewChat: (providerId?: string | null, modelId?: string | null, picoId?: string | null) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, content: string) => void;
  deleteChat: (chatId: string) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  renameChat: (chatId: string, title: string) => void;
  togglePinChat: (chatId: string) => void;
  updateChatModel: (chatId: string, providerId: string, modelId: string) => void;
  updateMessagePlan: (chatId: string, messageId: string, plan: any) => void;
  deleteAllChats: () => void;
  importChats: (chats: Chat[]) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localforage (IndexedDB)
  useEffect(() => {
    const loadState = async () => {
      try {
        // Auto-migration from legacy synchronous localStorage
        const legacyChats = localStorage.getItem("mimi_chats");
        if (legacyChats) {
          console.log("Migrating legacy chats to IndexedDB...");
          await localforage.setItem("mimi_chats", JSON.parse(legacyChats));
          localStorage.removeItem("mimi_chats");
        }
        
        const legacyActiveStr = localStorage.getItem("mimi_activeChatId");
        if (legacyActiveStr) {
          await localforage.setItem("mimi_activeChatId", legacyActiveStr);
          localStorage.removeItem("mimi_activeChatId");
        }

        const storedChats = await localforage.getItem<Chat[]>("mimi_chats");
        const storedActiveChat = await localforage.getItem<string>("mimi_activeChatId");
        
        if (storedChats) {
          // SANITIZATION: Strip any accidental PointerEvents or non-serializable objects
          // that might have leaked in before the fix.
          const sanitized = storedChats.map(chat => ({
            ...chat,
            modelId: typeof chat.modelId === 'string' ? chat.modelId : undefined,
            providerId: typeof chat.providerId === 'string' ? chat.providerId : undefined,
            picoId: typeof chat.picoId === 'string' ? chat.picoId : undefined,
            messages: chat.messages.map(msg => ({
              ...msg,
              // Recursive sanitization if needed, but usually it's the top-level chat IDs
            }))
          }));
          setChats(sanitized);
        }
        if (storedActiveChat) setActiveChatId(storedActiveChat);
      } catch (e) {
        console.error("Failed to parse chats from localforage", e);
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
        await localforage.setItem("mimi_chats", chats);
        if (activeChatId) {
          await localforage.setItem("mimi_activeChatId", activeChatId);
        } else {
          await localforage.removeItem("mimi_activeChatId");
        }
      } catch (e) {
        console.error("Failed to save to localforage:", e);
      }
    };
    saveState();
  }, [chats, activeChatId, isLoaded]);

  const createNewChat = (providerId?: string | null, modelId?: string | null, picoId?: string | null) => {
    const newChat: Chat = {
      id: Date.now().toString() + Math.random().toString(),
      title: "New Chat",
      messages: [],
      pinned: false,
      updatedAt: Date.now(),
      providerId: providerId || undefined,
      modelId: modelId || undefined,
      picoId: picoId || undefined,
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const addMessage = (chatId: string, message: Message) => {
    setChats((prev) => prev.map((chat) => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: [...chat.messages, message],
          updatedAt: Date.now()
        };
      }
      return chat;
    }));
  };

  const updateMessage = (chatId: string, messageId: string, content: string) => {
    setChats((prev) => prev.map((chat) => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: chat.messages.map((msg) => 
            msg.id === messageId ? { ...msg, content } : msg
          ),
          updatedAt: Date.now()
        };
      }
      return chat;
    }));
  };

  const deleteChat = (chatId: string) => {
    setChats((prev) => {
      const filtered = prev.filter((chat) => chat.id !== chatId);
      if (activeChatId === chatId) {
        // Find next chat or set null
        setActiveChatId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const deleteMessage = (chatId: string, messageId: string) => {
    setChats((prev) => prev.map((chat) => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: chat.messages.filter((m) => m.id !== messageId),
          updatedAt: Date.now()
        };
      }
      return chat;
    }));
  };

  const renameChat = (chatId: string, title: string) => {
    setChats((prev) => prev.map((chat) => 
      chat.id === chatId ? { ...chat, title, updatedAt: Date.now() } : chat
    ));
  };

  const togglePinChat = (chatId: string) => {
    setChats((prev) => prev.map((chat) => 
      chat.id === chatId ? { ...chat, pinned: !chat.pinned, updatedAt: Date.now() } : chat
    ));
  };

  const updateChatModel = (chatId: string, providerId: string, modelId: string) => {
    setChats((prev) => prev.map((chat) => 
      chat.id === chatId ? { ...chat, providerId, modelId, updatedAt: Date.now() } : chat
    ));
  };

  const updateMessagePlan = (chatId: string, messageId: string, plan: any) => {
    setChats((prev) => prev.map((chat) => {
      if (chat.id === chatId) {
        return {
          ...chat,
          messages: chat.messages.map((msg) => 
            msg.id === messageId ? { ...msg, agentPlan: plan } : msg
          ),
          updatedAt: Date.now()
        };
      }
      return chat;
    }));
  };

  const deleteAllChats = () => {
    setChats([]);
    setActiveChatId(null);
  };

  const importChats = (newChats: Chat[]) => {
    setChats(newChats);
    if (newChats.length > 0) {
      setActiveChatId(newChats[0].id);
    }
  };

  const contextValue = React.useMemo(() => ({
    chats, activeChatId, setActiveChatId,
    createNewChat, addMessage, updateMessage, updateMessagePlan, deleteChat, deleteMessage, renameChat, 
    togglePinChat, updateChatModel, deleteAllChats, importChats 
  }), [chats, activeChatId]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
}
