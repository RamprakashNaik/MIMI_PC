"use client";

import React, { useState } from 'react';
import { useMemory, Memory } from '@/context/MemoryContext';

export const MemoryVault: React.FC = () => {
  const { memories, deleteMemory, addMemory, updateMemory, deleteAllMemories, importMemories } = useMemory();
  const [isAdding, setIsAdding] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success'>('idle');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = JSON.stringify(memories, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mimi_memories_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    setExportStatus('success');
    setTimeout(() => setExportStatus('idle'), 2000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await importMemories(data);
      } catch (err) {
        console.error("Import failed:", err);
        alert("Failed to import memories. Please check the file format.");
      }
    };
    reader.readAsText(file);
  };
  
  const [form, setForm] = useState({
    content: '',
    type: 'fact' as Memory['type'],
    importance: 5
  });

  const getTypeColor = (type: Memory['type']) => {
    switch (type) {
      case 'preference': return '#6366f1';
      case 'fact': return '#22c55e';
      case 'project': return '#f59e0b';
      case 'pattern': return '#ec4899';
      default: return 'var(--text-tertiary)';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;

    if (editingId) {
      await updateMemory(editingId, form);
      setEditingId(null);
    } else {
      await addMemory(form.content, form.type, form.importance);
      setIsAdding(false);
    }
    setForm({ content: '', type: 'fact', importance: 5 });
  };

  const startEdit = (m: Memory) => {
    setForm({ content: m.content, type: m.type, importance: m.importance });
    setEditingId(m.id);
    setIsAdding(false);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Memory Vault</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '0.25rem 0 0 0' }}>Manage what MIMI knows about you</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".json" 
            style={{ display: 'none' }} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="excel-tool-btn"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)' }}
            title="Import memories from JSON"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Import
          </button>
          <button 
            onClick={handleExport}
            className="excel-tool-btn"
            style={{ 
              background: exportStatus === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)', 
              border: exportStatus === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-light)',
              color: exportStatus === 'success' ? '#4ade80' : 'var(--text-dim)'
            }}
            title="Export memories to JSON"
            disabled={memories.length === 0}
          >
            {exportStatus === 'success' ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{width: '14px', height: '14px'}}><polyline points="20 6 9 17 4 12"></polyline></svg>
                Done
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px', transform: 'rotate(180deg)'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Export
              </>
            )}
          </button>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-light)', margin: '0 0.25rem' }} />
          {memories.length > 0 && (
            <button 
              onClick={() => setShowDeleteAllConfirm(true)}
              style={{ 
                padding: '0.5rem 1rem', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', borderRadius: '0.5rem', 
                fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(244, 63, 94, 0.2)', cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          )}
          <button 
            onClick={() => { setIsAdding(!isAdding); setEditingId(null); setForm({ content: '', type: 'fact', importance: 5 }); }}
            style={{ 
              padding: '0.5rem 1rem', background: 'var(--accent-base)', color: 'white', borderRadius: '0.5rem', 
              fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' 
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '14px', height: '14px'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Memory
          </button>
        </div>
      </div>

      {showDeleteAllConfirm && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(244, 63, 94, 0.3)', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Clear all memories?</h4>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              This will permanently delete all facts and preferences MIMI has learned about you. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => setShowDeleteAllConfirm(false)} style={{ padding: '0.6rem 1.2rem', borderRadius: '0.75rem', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button 
                onClick={async () => {
                  await deleteAllMemories();
                  setShowDeleteAllConfirm(false);
                }} 
                style={{ padding: '0.6rem 1.2rem', borderRadius: '0.75rem', background: '#e11d48', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-surface-elevated)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--accent-glow)', marginBottom: '1.5rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Memory Content</label>
            <textarea 
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="e.g. I prefer dark mode, I work at Google, My favorite tech is React..."
              style={{ width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--border-light)', borderRadius: '0.5rem', padding: '0.75rem', color: 'white', fontSize: '0.875rem', outline: 'none', resize: 'vertical', minHeight: '80px' }}
              autoFocus
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Type</label>
              <select 
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                style={{ width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--border-light)', borderRadius: '0.5rem', padding: '0.5rem', color: 'white', outline: 'none' }}
              >
                <option value="fact">Fact</option>
                <option value="preference">Preference</option>
                <option value="project">Project</option>
                <option value="pattern">Pattern</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Importance (1-10)</label>
              <input 
                type="range" min="1" max="10" 
                value={form.importance}
                onChange={(e) => setForm({ ...form, importance: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent-base)' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Cancel</button>
            <button type="submit" style={{ padding: '0.5rem 1.5rem', background: 'var(--accent-gradient)', color: 'white', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
              {editingId ? 'Save Changes' : 'Add Memory'}
            </button>
          </div>
        </form>
      )}

      {memories.length === 0 && !isAdding ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-deep)', borderRadius: '1.25rem', border: '1px dashed var(--border-light)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🧠</div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No memories stored yet. Talk to MIMI or add one manually!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {memories.sort((a, b) => b.timestamp - a.timestamp).map((memory) => (
            <div key={memory.id} className="provider-card" style={{ 
              background: editingId === memory.id ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)', 
              padding: '1.25rem', borderRadius: '1.25rem', border: editingId === memory.id ? '1px solid var(--accent-base)' : '1px solid var(--border-light)', 
              display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', transition: 'all 0.2s' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: getTypeColor(memory.type), background: `${getTypeColor(memory.type)}15`, padding: '2px 8px', borderRadius: '4px' }}>
                  {memory.type}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => startEdit(memory)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
                    title="Edit memory"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button 
                    onClick={() => deleteMemory(memory.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
                    title="Forget this"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
              
              <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: '1.5', color: 'var(--text-primary)', fontWeight: 500 }}>
                {memory.content}
              </p>

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                  {new Date(memory.timestamp).toLocaleDateString()}
                </span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: i < (memory.importance / 3.3) ? 'var(--accent-base)' : 'var(--border-light)' }}></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
