"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import { create, insert, search, remove, type Orama } from '@orama/orama';

export interface Memory {
  id: string;
  content: string;
  type: 'preference' | 'fact' | 'project' | 'pattern';
  timestamp: number;
  importance: number; // 1-10
  metadata?: Record<string, any>;
}

interface MemoryContextType {
  memories: Memory[];
  addMemory: (content: string, type: Memory['type'], importance?: number) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  updateMemory: (id: string, updates: Partial<Memory>) => Promise<void>;
  queryMemories: (query: string, limit?: number) => Promise<Memory[]>;
  deleteAllMemories: () => Promise<void>;
  importMemories: (memories: Memory[]) => Promise<void>;
  isRecalling: boolean;
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export const MemoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isRecalling, setIsRecalling] = useState(false);
  const dbRef = useRef<Orama<any> | null>(null);
  const memoriesRef = useRef<Memory[]>([]);

  // Keep ref in sync for safe access in rapid-fire async calls
  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  // Initialize Orama and load from localforage
  useEffect(() => {
    const init = async () => {
      // Create Orama instance
      const db = await create({
        schema: {
          content: 'string',
          type: 'string',
          metadata: 'string', // serialized metadata
        },
      });
      dbRef.current = db;

      // Load from persistence
      const savedMemories = await localforage.getItem<Memory[]>('mimi_memories') || [];
      setMemories(savedMemories);

      // Index initial memories
      for (const m of savedMemories) {
        await insert(db, {
          id: m.id,
          content: m.content,
          type: m.type,
          metadata: JSON.stringify(m.metadata || {}),
        });
      }
    };
    init();
  }, []);

  const addMemory = async (content: string, type: Memory['type'], importance: number = 5) => {
    const normalizedNew = content.toLowerCase().trim();
    
    // Use ref to check against the absolute latest state (prevents batch duplicates)
    const existingIndex = memoriesRef.current.findIndex(m => {
      const normalizedExisting = m.content.toLowerCase().trim();
      return normalizedExisting.includes(normalizedNew) || normalizedNew.includes(normalizedExisting);
    });

    if (existingIndex !== -1) {
      // If it exists, just update its timestamp and potentially importance to bring it to top
      const existing = memories[existingIndex];
      await updateMemory(existing.id, { 
        timestamp: Date.now(), 
        importance: Math.max(existing.importance, importance) 
      });
      return;
    }

    const newMemory: Memory = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      type,
      importance,
      timestamp: Date.now(),
    };

    const updated = [...memories, newMemory];
    setMemories(updated);
    await localforage.setItem('mimi_memories', updated);

    if (dbRef.current) {
      await insert(dbRef.current, {
        id: newMemory.id,
        content: newMemory.content,
        type: newMemory.type,
        metadata: JSON.stringify({}),
      });
    }
  };

  const deleteMemory = async (id: string) => {
    const updated = memories.filter(m => m.id !== id);
    setMemories(updated);
    await localforage.setItem('mimi_memories', updated);

    if (dbRef.current) {
      await remove(dbRef.current, id);
    }
  };

  const updateMemory = async (id: string, updates: Partial<Memory>) => {
    const updatedMemories = memories.map(m => m.id === id ? { ...m, ...updates, timestamp: Date.now() } : m);
    setMemories(updatedMemories);
    await localforage.setItem('mimi_memories', updatedMemories);

    if (dbRef.current) {
      // Orama update is essentially remove + insert
      await remove(dbRef.current, id);
      const updated = updatedMemories.find(m => m.id === id);
      if (updated) {
        await insert(dbRef.current, {
          id: updated.id,
          content: updated.content,
          type: updated.type,
          metadata: JSON.stringify(updated.metadata || {}),
        });
      }
    }
  };

  const queryMemories = async (query: string, limit: number = 5): Promise<Memory[]> => {
    if (!dbRef.current || !query.trim()) return [];
    
    setIsRecalling(true);
    try {
      const results = await search(dbRef.current, {
        term: query,
        limit,
        boost: {
          content: 2,
        }
      });

      // Map results back to full Memory objects
      return results.hits.map(hit => {
        const found = memories.find(m => m.id === (hit.document as any).id);
        return found!;
      }).filter(Boolean);
    } finally {
      setIsRecalling(false);
    }
  };

  const deleteAllMemories = async () => {
    setMemories([]);
    await localforage.setItem('mimi_memories', []);
    
    if (dbRef.current) {
      const db = await create({
        schema: {
          content: 'string',
          type: 'string',
          metadata: 'string',
        },
      });
      dbRef.current = db;
    }
  };
  
  const importMemories = async (newMemories: Memory[]) => {
    if (!Array.isArray(newMemories)) return;
    
    const currentMemories = memoriesRef.current;
    const added: Memory[] = [];
    
    for (const nm of newMemories) {
      // Basic validation
      if (!nm.content || !nm.type) continue;
      
      const isDup = currentMemories.some(cm => 
        cm.content.toLowerCase().trim() === nm.content.toLowerCase().trim()
      );
      
      if (!isDup) {
        added.push({
          ...nm,
          id: nm.id || Math.random().toString(36).substr(2, 9),
          timestamp: nm.timestamp || Date.now(),
          importance: nm.importance || 5
        });
      }
    }

    if (added.length === 0) return;

    const updated = [...currentMemories, ...added];
    setMemories(updated);
    await localforage.setItem('mimi_memories', updated);

    if (dbRef.current) {
      for (const m of added) {
        await insert(dbRef.current, {
          id: m.id,
          content: m.content,
          type: m.type,
          metadata: JSON.stringify(m.metadata || {}),
        });
      }
    }
  };

  return (
    <MemoryContext.Provider value={{ memories, addMemory, deleteMemory, updateMemory, queryMemories, deleteAllMemories, importMemories, isRecalling }}>
      {children}
    </MemoryContext.Provider>
  );
};

export const useMemory = () => {
  const context = useContext(MemoryContext);
  if (context === undefined) {
    throw new Error('useMemory must be used within a MemoryProvider');
  }
  return context;
};
