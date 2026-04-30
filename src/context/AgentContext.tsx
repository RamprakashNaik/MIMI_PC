"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import localforage from 'localforage';

export type TaskRole = 'researcher' | 'coder' | 'analyst' | 'reviewer' | 'planning';

export interface Task {
  id: string;
  tool: 'gmail' | 'search' | 'memory' | 'files' | 'final_answer' | 'planning' | 'handoff';
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  agentRole?: TaskRole;
  auditScore?: number;
  auditStatus?: string;
}

export interface TaskPlan {
  goal: string;
  strategy?: {
    agents: string[];
    reason: string;
    complexity: 'low' | 'medium' | 'high';
  };
  tasks: Task[];
  logs?: string[];
}

interface AgentContextType {
  currentPlan: TaskPlan | null;
  isPlanning: boolean;
  isExecuting: boolean;
  activeChatId: string | null;
  activeMessageId: string | null;
  setPlan: (plan: TaskPlan | null) => void;
  setIsPlanning: (val: boolean) => void;
  setIsExecuting: (val: boolean) => void;
  setActiveContext: (chatId: string | null, messageId: string | null) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  addLog: (log: string) => void;
  resetAgent: () => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPlan, setCurrentPlan] = useState<TaskPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localforage on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedPlan = await localforage.getItem<TaskPlan>('mimi_agent_plan');
        const savedPlanning = await localforage.getItem<boolean>('mimi_agent_is_planning');
        const savedExecuting = await localforage.getItem<boolean>('mimi_agent_is_executing');
        const savedChatId = await localforage.getItem<string>('mimi_agent_chat_id');
        const savedMsgId = await localforage.getItem<string>('mimi_agent_msg_id');

        if (savedPlan) setCurrentPlan(savedPlan);
        if (savedPlanning !== null) setIsPlanning(savedPlanning);
        if (savedExecuting !== null) setIsExecuting(savedExecuting);
        if (savedChatId) setActiveChatId(savedChatId);
        if (savedMsgId) setActiveMessageId(savedMsgId);
      } catch (e) {
        console.error("Failed to load Agent state:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadState();
  }, []);

  // Save to localforage on changes
  useEffect(() => {
    if (!isLoaded) return;
    const saveState = async () => {
      try {
        await localforage.setItem('mimi_agent_plan', currentPlan);
        await localforage.setItem('mimi_agent_is_planning', isPlanning);
        await localforage.setItem('mimi_agent_is_executing', isExecuting);
        await localforage.setItem('mimi_agent_chat_id', activeChatId);
        await localforage.setItem('mimi_agent_msg_id', activeMessageId);
      } catch (e) {
        console.error("Failed to save Agent state:", e);
      }
    };
    saveState();
  }, [currentPlan, isPlanning, isExecuting, activeChatId, activeMessageId, isLoaded]);

  const setPlan = useCallback((plan: TaskPlan | null) => {
    setCurrentPlan(plan);
  }, []);

  const setActiveContext = useCallback((chatId: string | null, messageId: string | null) => {
    setActiveChatId(chatId);
    setActiveMessageId(messageId);
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setCurrentPlan(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      };
    });
  }, []);

  const addLog = useCallback((log: string) => {
    setCurrentPlan(prev => {
      if (!prev) return null;
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const newLog = `[${timestamp}] ${log}`;
      return {
        ...prev,
        logs: [...(prev.logs || []), newLog]
      };
    });
  }, []);

  const resetAgent = useCallback(() => {
    setCurrentPlan(null);
    setIsPlanning(false);
    setIsExecuting(false);
    setActiveChatId(null);
    setActiveMessageId(null);
  }, []);

  return (
    <AgentContext.Provider value={{
      currentPlan,
      isPlanning,
      isExecuting,
      activeChatId,
      activeMessageId,
      setPlan,
      setIsPlanning,
      setIsExecuting,
      setActiveContext,
      updateTask,
      addLog,
      resetAgent
    }}>
      {children}
    </AgentContext.Provider>
  );
};



export const useAgent = () => {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};
