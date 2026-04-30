"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSettings, Provider } from "@/context/SettingsContext";
import { useChat, Message } from "@/context/ChatContext";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { extractTextFromFile, formatDocumentForPrompt, getFileCategory, FileCategory } from "@/lib/fileParser";
import { useArtifacts, Artifact, ArtifactType } from "@/context/ArtifactContext";
import { useMemory } from "@/context/MemoryContext";
import { MemoryVault } from "@/components/MemoryVault";
import { useAgent, Task, TaskPlan } from "@/context/AgentContext";
import { TaskBoard } from "@/components/TaskBoard";
import { universalFetch, searchWeb, openLink } from "@/lib/api";
import { searchGmail, getGmailMessage, refreshGmailToken } from "@/lib/gmail";

// ...

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);
  const { addOrUpdateArtifact } = useArtifacts();
  
  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleView = () => {
    const content = String(children).replace(/\n$/, '');
    const lang = match ? match[1] : 'html';
    addOrUpdateArtifact({
      id: `temp-${Math.random().toString(36).substr(2, 9)}`,
      type: (lang === 'svg' ? 'svg' : 'html') as any,
      title: 'Code Preview',
      content: content
    });
  };

  if (!inline && match) {
    const isViewable = ['html', 'svg', 'xml'].includes(match[1]);

    return (
      <div className="code-block-wrapper">
        <div className="code-block-header">
          <span className="code-language">{match[1]}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isViewable && (
              <button onClick={handleView} className="code-copy-btn" title="View Artifact">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:'14px',height:'14px'}}><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                View
              </button>
            )}
            <button onClick={handleCopy} className="code-copy-btn" title="Copy Code">
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        <pre className={className} {...props}>
          <code>{children}</code>
        </pre>
      </div>
    );
  }
  return <code className={className} {...props}>{children}</code>;
};

// ── ArtifactBox ─────────────────────────────────────────────────────────────

const ArtifactBox = ({ type, title, identifier, children }: any) => {
  const { artifacts, setActiveArtifact, setIsPanelOpen } = useArtifacts();
  const [copied, setCopied] = useState(false);
  
  // Find the actual artifact data from our context (parsed in the useEffect)
  const artifactData = artifacts.find(a => a.id === identifier);
  
  const content = artifactData ? artifactData.content : "";

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleView = () => {
    if (artifactData) {
      setActiveArtifact(artifactData);
      setIsPanelOpen(true);
    }
  };

  if (!artifactData) return null; // Or show a placeholder

  return (
    <div className={`artifact-chat-box ${artifactData.status === 'generating' ? 'generating' : ''}`}>
      <div className="artifact-chat-header">
        <div className="artifact-chat-info">
          <div className="artifact-chat-icon">
            {artifactData.status === 'generating' ? (
              <div className="generating-spinner">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            )}
          </div>
          <div className="artifact-chat-details">
            <span className="artifact-chat-title">{artifactData.title || title || 'Untitled Artifact'}</span>
            <span className="artifact-chat-type">
              {artifactData.status === 'generating' ? 'Generating Content...' : (artifactData.type || type)}
            </span>
          </div>
        </div>
        <div className="artifact-chat-actions">
          <button className="artifact-chat-btn" onClick={handleView}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            View
          </button>
          {artifactData.status !== 'generating' && (
            <>
              <button className="artifact-chat-btn" onClick={handleCopy}>
                {copied ? 'Copied!' : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy
                  </>
                )}
              </button>
              <ArtifactDownloadButton artifact={artifactData} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const parseCSV = (csv: string) => {
  if (!csv) return [["", "", ""], ["", "", ""], ["", "", ""]];
  const lines = csv.trim().split('\n');
  // Detect delimiter
  const delimiters = [',', ';', '\t'];
  let delimiter = ',';
  for (const d of delimiters) {
    if (lines[0].includes(d)) {
      delimiter = d;
      break;
    }
  }
  
  return lines.map(row => {
    // Basic CSV parsing
    const cells = row.split(delimiter);
    return cells.length > 0 ? cells : [""];
  });
};

const downloadArtifactFile = async (artifact: any) => {
  if (!artifact) return;

  if (artifact.type === 'excel') {
    try {
      const XLSX = await import('xlsx');
      const data = parseCSV(artifact.content);
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      
      // Use XLSX.write and a manual download for more control
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.title || 'spreadsheet'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    } catch (err) {
      console.error("Failed to generate XLSX, falling back to CSV:", err);
      // Fallback to CSV below
    }
  }

  const isExcel = artifact.type === 'excel';
  const ext = artifact.type === 'html' ? 'html' : artifact.type === 'svg' ? 'svg' : isExcel ? 'csv' : 'txt';
  const mimeType = isExcel ? 'text/csv' : 'text/plain';
  const blob = new Blob([artifact.content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${artifact.title || 'artifact'}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};

const extractTableToCSV = (html: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;

    const rows = Array.from(table.querySelectorAll('tr'));
    return rows.map(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      return cells.map(cell => {
        let text = cell.textContent?.trim().replace(/\n/g, ' ') || '';
        // If it contains a comma, wrap in quotes
        if (text.includes(',')) text = `"${text}"`;
        return text;
      }).join(',');
    }).filter(row => row.length > 0).join('\n');
  } catch (e) {
    console.error("Table extraction failed:", e);
    return null;
  }
};

const ArtifactDownloadButton = ({ artifact }: { artifact: any }) => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'completed'>('idle');

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus('downloading');
    
    // Slight delay for feedback
    setTimeout(async () => {
      await downloadArtifactFile(artifact);
      setStatus('completed');
      setTimeout(() => setStatus('idle'), 2000);
    }, 600);
  };

  return (
    <button 
      className="artifact-chat-btn" 
      onClick={handleDownload}
      disabled={status === 'downloading'}
    >
      {status === 'idle' ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download
        </>
      ) : status === 'downloading' ? (
        <>
          <span className="spinning" style={{width: '12px', height: '12px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block'}}></span>
          Saving...
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Saved!
        </>
      )}
    </button>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button 
      onClick={handleCopy}
      className="action-icon-btn"
      title="Copy message"
      style={copied ? { color: 'var(--accent-base)' } : {}}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '14px', height: '14px'}}><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      )}
    </button>
  );
};

const CustomModelSelect = ({ availableModels, selectedProviderId, selectedModelId, onSelect }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredModels = availableModels.filter((m: any) => 
    m.name?.toLowerCase().includes(search.toLowerCase()) || 
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.providerName.toLowerCase().includes(search.toLowerCase())
  );

  const groupedModels = filteredModels.reduce((acc: any, m: any) => {
    if (!acc[m.providerName]) acc[m.providerName] = [];
    acc[m.providerName].push(m);
    return acc;
  }, {});

  const selectedModelInfo = availableModels.find((m: any) => m.id === selectedModelId && m.providerId === selectedProviderId);

  return (
    <div className="model-dropdown-wrapper" ref={dropdownRef}>
      <button className="model-dropdown-button" onClick={() => setIsOpen(!isOpen)}>
        <span>{selectedModelInfo ? `${selectedModelInfo.name || selectedModelInfo.id}` : "Select a model..."}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px', marginLeft: '0.5rem'}}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      {isOpen && (
        <div className="model-dropdown-menu">
          <div className="model-dropdown-search-wrapper">
            <input 
              type="text" 
              className="model-dropdown-search" 
              placeholder="Search models..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="model-dropdown-list">
            {Object.keys(groupedModels).length === 0 ? (
              <div style={{padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem'}}>No models found</div>
            ) : (
              Object.keys(groupedModels).map((providerName) => (
                <div key={providerName}>
                  <div className="model-dropdown-group-title">{providerName}</div>
                  {groupedModels[providerName].map((m: any) => (
                    <div 
                      key={`${m.providerId}::${m.id}`} 
                      className={`model-dropdown-item ${selectedModelId === m.id && selectedProviderId === m.providerId ? 'selected' : ''}`}
                      onClick={() => {
                        onSelect(m.providerId, m.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                    >
                      <span className="model-dropdown-item-name">{m.name || m.id}</span>
                      {m.name && m.name !== m.id && <span className="model-dropdown-item-id">{m.id}</span>}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── DocChip ──────────────────────────────────────────────────────────────────
// Renders a coloured chip for non-image document attachments

const DOC_COLORS: Record<string, { bg: string; border: string; label: string; icon: React.ReactNode }> = {
  pdf: {
    bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', label: 'PDF',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px',color:'#ef4444'}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  },
  word: {
    bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', label: 'DOCX',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px',color:'#3b82f6'}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  },
  excel: {
    bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', label: 'XLSX',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px',color:'#22c55e'}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="13" width="8" height="6" rx="1"/><line x1="10" y1="13" x2="10" y2="19"/><line x1="14" y1="13" x2="14" y2="19"/></svg>
  },
  text: {
    bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.35)', label: 'TXT',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px',color:'#9ca3af'}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  },
};

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getDocKey(type: string, name: string): keyof typeof DOC_COLORS {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'word';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'excel';
  return 'text';
}

const DocChip = ({ name, type, fileSize, compact }: { name: string; type: string; fileSize?: number; compact?: boolean }) => {
  const key = getDocKey(type, name);
  const config = DOC_COLORS[key] || DOC_COLORS.text;
  const shortName = name.length > 24 ? name.slice(0, 21) + '…' : name;
  return (
    <div
      className="doc-chip"
      style={{ background: config.bg, borderColor: config.border }}
      title={name}
    >
      {config.icon}
      <div className="doc-chip-info">
        <span className="doc-chip-name">{compact ? shortName : name}</span>
        {!compact && fileSize && <span className="doc-chip-size">{formatBytes(fileSize)}</span>}
        <span className="doc-chip-label" style={{ color: Object.values(config.border.match(/\d+,\d+,\d+/) || [''])[0] ? undefined : '#9ca3af' }}>{config.label}</span>
      </div>
      {!compact && fileSize && <span className="doc-chip-size-inline">{formatBytes(fileSize)}</span>}
    </div>
  );
};

// ── SourcePanel ─────────────────────────────────────────────────────────────

const GmailPanel = ({ emails, onEmailClick }: { emails: any[]; onEmailClick: (messageId: string) => void }) => {
  const [isOpen, setIsOpen] = useState(true);
  
  if (!emails || emails.length === 0) return null;

  return (
    <div className="gmail-panel">
      <button className="gmail-toggle" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '4px', borderRadius: '6px', display: 'flex' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'14px', height:'14px', color: 'var(--accent-base)'}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </div>
          <span>Emails Found ({emails.length})</span>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      
      {isOpen && (
        <div className="gmail-list">
          {emails.map((email, i) => (
            <div 
              key={i} 
              className="gmail-item" 
              onClick={() => onEmailClick(email.id)}
            >
              <div className="gmail-item-header">
                <span className="gmail-item-subject">{email.subject}</span>
                <span className="gmail-item-date">
                  {email.date ? new Date(email.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unknown Date'}
                </span>
              </div>
              <div className="gmail-item-from">From: {email.from}</div>
              <p className="gmail-item-snippet">
                {email.snippet}...
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SourcePanel = ({ sources }: { sources: { title: string; url: string; content: string }[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="source-panel">
      <button className="source-toggle" onClick={() => setIsOpen(!isOpen)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'14px',height:'14px'}}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <span>Sources ({sources.length})</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'14px',height:'14px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {isOpen && (
        <div className="source-list">
          {sources.map((s, i) => (
            <div key={i} className="source-item" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <a 
                href={s.url} 
                onClick={(e) => { e.preventDefault(); openLink(s.url); }}
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', flex: 1, minWidth: 0 }}
              >
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${new URL(s.url).hostname}&sz=32`} 
                  alt="" 
                  style={{ width: '16px', height: '16px', borderRadius: '2px' }}
                />
                <div className="source-meta">
                  <span className="source-title">{s.title}</span>
                  <span className="source-url">{new URL(s.url).hostname}</span>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'12px',height:'12px', marginLeft:'auto'}}><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
              </a>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigator.clipboard.writeText(s.url);
                }}
                className="action-icon-btn"
                title="Copy URL"
                style={{ marginLeft: '0.5rem', opacity: 0.5 }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '12px', height: '12px'}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ArtifactPanel ─────────────────────────────────────────────────────────────



const ArtifactPanel = ({ width }: { width: number }) => {
  const { activeArtifact, isPanelOpen, setIsPanelOpen, addOrUpdateArtifact } = useArtifacts();
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'completed'>('idle');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // --- Helper Functions ---
  
  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop;
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const isCSV = (text: string) => {
    if (!text || text.length < 5) return false;
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    // Check if first few lines have the same number of delimiters
    const delimiters = [',', ';', '\t'];
    for (const d of delimiters) {
      const counts = lines.slice(0, 3).map(line => line.split(d).length);
      if (counts[0] > 1 && counts.every(c => c === counts[0])) return true;
    }
    return false;
  };

  const getHighlightedContent = () => {
    if (!activeArtifact) return "";
    const text = activeArtifact.content;
    if (!searchQuery) return text;

    try {
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      let currentPos = 0;
      
      return parts.map((part, i) => {
        const isMatch = part.toLowerCase() === searchQuery.toLowerCase();
        const startPos = currentPos;
        currentPos += part.length;

        if (isMatch) {
          const isActive = startPos === matchIndices[currentMatchIndex];
          return <mark key={i} className={isActive ? 'active-mark' : ''}>{part}</mark>;
        }
        return part;
      });
    } catch (e) {
      return text;
    }
  };

  const findMatches = (query: string, content: string) => {
    if (!query) return [];
    const indices = [];
    let index = content.toLowerCase().indexOf(query.toLowerCase());
    while (index !== -1) {
      indices.push(index);
      index = content.toLowerCase().indexOf(query.toLowerCase(), index + 1);
    }
    return indices;
  };

  const scrollToMatch = (index: number) => {
    if (index === -1 || !editorRef.current) return;
    const content = activeArtifact?.content || "";
    
    editorRef.current.setSelectionRange(index, index + searchQuery.length);
    const linesBefore = content.substring(0, index).split('\n').length;
    editorRef.current.scrollTop = (linesBefore - 5) * 24;
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const indices = findMatches(query, activeArtifact?.content || "");
    setMatchIndices(indices);
    setCurrentMatchIndex(indices.length > 0 ? 0 : -1);
    if (indices.length > 0) {
      scrollToMatch(indices[0]);
    }
  };

  const nextMatch = () => {
    if (matchIndices.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchIndices.length;
    setCurrentMatchIndex(nextIdx);
    scrollToMatch(matchIndices[nextIdx]);
  };

  const prevMatch = () => {
    if (matchIndices.length === 0) return;
    const nextIdx = (currentMatchIndex - 1 + matchIndices.length) % matchIndices.length;
    setCurrentMatchIndex(nextIdx);
    scrollToMatch(matchIndices[nextIdx]);
  };

  // --- Excel Logic ---
  
  const stringifyCSV = (data: string[][]) => {
    return data.map(row => row.join(',')).join('\n');
  };

  const handleExcelChange = (rowIndex: number, colIndex: number, value: string) => {
    const data = parseCSV(activeArtifact?.content || "");
    if (data[rowIndex]) {
      data[rowIndex][colIndex] = value;
      addOrUpdateArtifact({ ...activeArtifact!, content: stringifyCSV(data) });
    }
  };

  const addRow = () => {
    const data = parseCSV(activeArtifact?.content || "");
    const colCount = data[0]?.length || 3;
    const newRow = new Array(colCount).fill("");
    data.push(newRow);
    addOrUpdateArtifact({ ...activeArtifact!, content: stringifyCSV(data) });
  };

  const deleteRow = (index: number) => {
    const data = parseCSV(activeArtifact?.content || "");
    if (data.length > 1) {
      data.splice(index, 1);
      addOrUpdateArtifact({ ...activeArtifact!, content: stringifyCSV(data) });
    }
  };

  const addColumn = () => {
    const data = parseCSV(activeArtifact?.content || "");
    const newData = data.map(row => [...row, ""]);
    addOrUpdateArtifact({ ...activeArtifact!, content: stringifyCSV(newData) });
  };

  const deleteColumn = (index: number) => {
    const data = parseCSV(activeArtifact?.content || "");
    if (data[0] && data[0].length > 1) {
      const newData = data.map(row => {
        const newRow = [...row];
        newRow.splice(index, 1);
        return newRow;
      });
      addOrUpdateArtifact({ ...activeArtifact!, content: stringifyCSV(newData) });
    }
  };

  const clearExcel = () => {
    addOrUpdateArtifact({ ...activeArtifact!, content: ",,\n,,\n,," });
  };

  const handleExcelKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const data = parseCSV(activeArtifact?.content || "");
    const rowCount = data.length;
    const colCount = data[0].length;

    if (e.key === 'ArrowDown') {
      const nextRow = (rowIndex + 1) % rowCount;
      const el = document.getElementById(`cell-${nextRow}-${colIndex}`);
      el?.focus();
    } else if (e.key === 'ArrowUp') {
      const prevRow = (rowIndex - 1 + rowCount) % rowCount;
      const el = document.getElementById(`cell-${prevRow}-${colIndex}`);
      el?.focus();
    } else if (e.key === 'ArrowRight' && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) {
      const nextCol = (colIndex + 1) % colCount;
      const el = document.getElementById(`cell-${rowIndex}-${nextCol}`);
      el?.focus();
    } else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) {
      const prevCol = (colIndex - 1 + colCount) % colCount;
      const el = document.getElementById(`cell-${rowIndex}-${prevCol}`);
      el?.focus();
    } else if (e.key === 'Enter') {
      const nextRow = (rowIndex + 1) % rowCount;
      const el = document.getElementById(`cell-${nextRow}-${colIndex}`);
      el?.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = (colIndex + 1) % colCount;
      const targetRow = nextCol === 0 ? (rowIndex + 1) % rowCount : rowIndex;
      const el = document.getElementById(`cell-${targetRow}-${nextCol}`);
      el?.focus();
    }
  };

  const getIframeSrc = () => {
    if (!activeArtifact) return "";
    
    const navigationIntervention = `
      <meta http-equiv="Content-Security-Policy" content="form-action 'none';">
      <script>
        (function() {
          // Prevent navigation on <a> tags only
          window.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link) {
              const href = link.getAttribute('href');
              const isLocalHash = href && href.startsWith('#');
              const isVoid = href === 'javascript:void(0)' || !href;
              
              if (!isLocalHash && !isVoid) {
                e.preventDefault();
                e.stopPropagation();
                console.log('MIMI: Prevented potential external navigation');
              }
            }
          }, true);

          // Absolute block on form submissions
          window.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
          }, true);

          // Final safety: kill any navigation that started
          window.onbeforeunload = function(e) {
            window.stop();
            return "Navigation is disabled.";
          };

          // Override location changing methods
          const noop = () => console.log('MIMI: Programmatic navigation blocked');
          window.open = noop;
        })();
      </script>
    `;

    if (activeArtifact.type === 'svg') {
      return `
        <html>
          <head>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #ffffff; }
              svg { max-width: 100%; max-height: 100vh; height: auto; }
            </style>
          </head>
          <body>
            ${activeArtifact.content}
            ${navigationIntervention}
          </body>
        </html>
      `;
    }

    const content = activeArtifact.content;
    if (content.includes('<head>')) {
      return content.replace('<head>', `<head>${navigationIntervention}`);
    } else if (content.includes('<html>')) {
      return content.replace('<html>', `<html>${navigationIntervention}`);
    } else {
      return navigationIntervention + content;
    }
  };

  const downloadArtifact = () => {
    if (!activeArtifact) return;
    setDownloadStatus('downloading');
    
    setTimeout(async () => {
      await downloadArtifactFile(activeArtifact);
      setDownloadStatus('completed');
      setTimeout(() => setDownloadStatus('idle'), 2000);
    }, 600);
  };

  // --- Effects ---

  // Reset view mode when artifact changes
  useEffect(() => {
    if (activeArtifact) {
      const isSpreadsheet = activeArtifact.type === 'excel' || isCSV(activeArtifact.content);
      if (isSpreadsheet && activeArtifact.type === 'code') {
        // If it's code but looks like CSV, default to preview
        setViewMode('preview');
      } else {
        setViewMode(activeArtifact.type === 'code' ? 'code' : 'preview');
      }
    }
  }, [activeArtifact?.id, activeArtifact?.type]);

  // Update Blob URL when artifact content changes
  useEffect(() => {
    if (activeArtifact && (activeArtifact.type === 'html' || activeArtifact.type === 'svg')) {
      const content = getIframeSrc();
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setIframeUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setIframeUrl('');
    }
  }, [activeArtifact?.content, activeArtifact?.id, activeArtifact?.type]);

  // --- Early Return ---
  if (!activeArtifact || !isPanelOpen) return null;

  return (
    <div 
      className={`artifact-view ${isPanelOpen ? 'open' : ''}`} 
      style={{ width: `${width}px`, transition: isPanelOpen ? 'width 0.3s ease' : 'none' }}
    >
      <div className="artifact-header">
        <div className="logo-box" style={{width: '2rem', height: '2rem'}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '1.2rem', height: '1.2rem', stroke: 'white'}}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </div>
        <h3 className="artifact-title">{activeArtifact.title}</h3>

        <div className="artifact-mode-toggle">
          <button 
            className={`mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
            disabled={activeArtifact.type === 'code' && !isCSV(activeArtifact.content)}
          >
            Preview
          </button>
          <button 
            className={`mode-btn ${viewMode === 'code' ? 'active' : ''}`}
            onClick={() => setViewMode('code')}
          >
            Code
          </button>
        </div>

        <div className="artifact-actions">
          {viewMode === 'code' && (
            <button 
              className={`artifact-btn ${isSearchOpen ? 'active' : ''}`}
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              title="Search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
          )}
          {activeArtifact.type === 'html' && activeArtifact.content.includes('<table') && (
            <button 
              className="artifact-btn" 
              onClick={() => {
                const csv = extractTableToCSV(activeArtifact.content);
                if (csv) {
                  addOrUpdateArtifact({
                    id: `sheet-${Date.now()}`,
                    type: 'excel',
                    title: `${activeArtifact.title} (Sheet)`,
                    content: csv,
                    status: 'complete'
                  });
                }
              }}
              title="Open in Spreadsheet"
              style={{ color: 'var(--accent-base)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px'}}><path d="M3 3h18v18H3z"></path><path d="M21 9H3"></path><path d="M21 15H3"></path><path d="M12 3v18"></path></svg>
            </button>
          )}
          <button 
            className="artifact-btn" 
            onClick={downloadArtifact} 
            title={downloadStatus === 'idle' ? 'Download' : downloadStatus === 'downloading' ? 'Downloading...' : 'Downloaded!'}
            style={{ color: downloadStatus === 'completed' ? 'var(--accent-base)' : 'inherit' }}
          >
            {downloadStatus === 'idle' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            ) : downloadStatus === 'downloading' ? (
              <span className="spinning" style={{width: '14px', height: '14px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block'}}></span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '16px', height: '16px'}}><polyline points="20 6 9 17 4 12"></polyline></svg>
            )}
          </button>
          <button className="artifact-btn" onClick={() => setIsPanelOpen(false)} title="Close Preview">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      
      {isSearchOpen && viewMode === 'code' && (
        <div className="artifact-search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px', opacity: 0.5}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Find text..." 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <div className="artifact-search-nav">
              <div className="search-count">
                {matchIndices.length > 0 ? `${currentMatchIndex + 1} of ${matchIndices.length}` : '0 results'}
              </div>
              <div className="search-arrows">
                <button className="search-arrow-btn" onClick={prevMatch} disabled={matchIndices.length === 0}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '12px', height: '12px'}}><polyline points="18 15 12 9 6 15"></polyline></svg>
                </button>
                <button className="search-arrow-btn" onClick={nextMatch} disabled={matchIndices.length === 0}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '12px', height: '12px'}}><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
              </div>
            </div>
          )}
          <button className="search-close" onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      <div className="artifact-content-container">
        {viewMode === 'preview' && (activeArtifact.type === 'excel' || isCSV(activeArtifact.content)) ? (
          <div className="artifact-excel-container">
            <div className="artifact-excel-toolbar">
              <div className="excel-tool-group">
                <button className="excel-tool-btn" onClick={addRow} title="Add Row Below">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Row
                </button>
                <button className="excel-tool-btn danger" onClick={() => deleteRow(parseCSV(activeArtifact.content).length - 1)} title="Remove Last Row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Row
                </button>
              </div>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }} />
              <div className="excel-tool-group">
                <button className="excel-tool-btn" onClick={addColumn} title="Add Column Right">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Col
                </button>
                <button className="excel-tool-btn danger" onClick={() => deleteColumn(parseCSV(activeArtifact.content)[0].length - 1)} title="Remove Last Column">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Col
                </button>
              </div>
              <button className="excel-tool-btn" onClick={clearExcel} style={{ marginLeft: 'auto' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Clear All
              </button>
            </div>
            <div className="artifact-excel-grid-wrapper">
              <table className="artifact-excel-grid">
                <thead>
                  <tr>
                    <th className="row-index">#</th>
                    {parseCSV(activeArtifact.content)[0]?.map((_, i) => (
                      <th key={i}>{String.fromCharCode(65 + i)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseCSV(activeArtifact.content).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="row-label">{rowIndex + 1}</td>
                      {row.map((cell, colIndex) => (
                        <td key={colIndex}>
                          <input 
                            id={`cell-${rowIndex}-${colIndex}`}
                            className="excel-cell-input"
                            value={cell}
                            onChange={(e) => handleExcelChange(rowIndex, colIndex, e.target.value)}
                            onKeyDown={(e) => handleExcelKeyDown(e, rowIndex, colIndex)}
                            placeholder=""
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : viewMode === 'preview' && (activeArtifact.type === 'html' || activeArtifact.type === 'svg') && iframeUrl ? (
          <iframe 
            src={iframeUrl}
            className="artifact-iframe"
            sandbox="allow-scripts allow-forms"
            title={activeArtifact.title}
            style={{ background: '#ffffff' }}
          />
        ) : (
          <div className="artifact-editor-container">
            <div ref={overlayRef} className="artifact-highlight-overlay">
              {getHighlightedContent()}
            </div>
            <textarea
              ref={editorRef}
              className="artifact-editor"
              value={activeArtifact.content}
              onChange={(e) => addOrUpdateArtifact({ ...activeArtifact, content: e.target.value })}
              onScroll={syncScroll}
              readOnly={activeArtifact.status === 'generating'}
              spellCheck={false}
              placeholder="Start coding here..."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  // Contexts
  const { 
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
  } = useSettings();
  const { 
    activeArtifact, setActiveArtifact, 
    isPanelOpen, setIsPanelOpen, 
    artifacts, addOrUpdateArtifact 
  } = useArtifacts();
  const { 
    chats, activeChatId, setActiveChatId, 
    createNewChat, addMessage, updateMessage, deleteChat, deleteMessage, renameChat, 
    togglePinChat, updateChatModel, updateMessagePlan, deleteAllChats, importChats 
  } = useChat();
  const { queryMemories, addMemory, memories, isRecalling } = useMemory();
  const { 
    currentPlan, setPlan, updateTask, resetAgent, 
    isExecuting, isPlanning, setIsPlanning, setIsExecuting,
    activeChatId: agentChatId, activeMessageId: agentMsgId, setActiveContext
  } = useAgent();
  
  const lastProcessedContentRef = useRef<string>("");

  // Local State
  const [panelWidth, setPanelWidth] = useState(600); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchingGmail, setIsSearchingGmail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletePicoId, setDeletePicoId] = useState<string | null>(null);
  const [showPicoModal, setShowPicoModal] = useState(false);
  const [picoForm, setPicoForm] = useState({ name: "", systemPrompt: "", firstMessage: "" });
  const [settingsTab, setSettingsTab] = useState<'ai' | 'integrations' | 'memory' | 'advanced' | 'theme'>('ai');
  const [currentTheme, setCurrentTheme] = useState<'onyx' | 'ocean' | 'forest' | 'lavender'>('onyx');
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("mimi_theme");
    if (savedTheme) setCurrentTheme(savedTheme as any);
    setIsThemeLoaded(true);
  }, []);

  // Save theme to localStorage
  useEffect(() => {
    if (!isThemeLoaded) return;
    localStorage.setItem("mimi_theme", currentTheme);
  }, [currentTheme, isThemeLoaded]);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
  const [isFetchingEmail, setIsFetchingEmail] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);

  // Load layout state
  useEffect(() => {
    const savedWidth = localStorage.getItem("mimi_panel_width");
    const savedSidebar = localStorage.getItem("mimi_sidebar_open");
    if (savedWidth) setPanelWidth(Number(savedWidth));
    if (savedSidebar !== null) setIsSidebarOpen(savedSidebar === "true");
    setIsLayoutLoaded(true);
  }, []);

  // Save layout state
  useEffect(() => {
    if (!isLayoutLoaded) return;
    localStorage.setItem("mimi_panel_width", panelWidth.toString());
    localStorage.setItem("mimi_sidebar_open", isSidebarOpen.toString());
  }, [panelWidth, isSidebarOpen, isLayoutLoaded]);
  
  const handleNewChat = useCallback((picoIdOverride?: string | React.MouseEvent | React.KeyboardEvent) => {
    // Ensure we don't accidentally treat an event object as a picoId
    const actualPicoId = typeof picoIdOverride === 'string' ? picoIdOverride : selectedPicoId;
    const modelId = defaultModelId || selectedModelId;
    const providerId = defaultProviderId || selectedProviderId;
    createNewChat(providerId, modelId, actualPicoId);
  }, [defaultModelId, selectedModelId, defaultProviderId, selectedProviderId, selectedPicoId, createNewChat]);
  const [chatSearch, setChatSearch] = useState("");
  const [input, setInput] = useState("");
  const [typingChatIds, setTypingChatIds] = useState<Record<string, boolean>>({});
  const [isParsing, setIsParsing] = useState(false); // true while extracting doc text
  const [pendingAttachments, setPendingAttachments] = useState<{
    dataUrl?: string;
    name: string;
    type: string;
    extractedText?: string;
    fileSize?: number;
    category?: FileCategory;
  }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const migrationInputRef = useRef<HTMLInputElement>(null);
  
  // Available models format: { id, name, providerId, providerName }
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelError, setModelError] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, chatId: string } | null>(null);

  // Custom Modal States
  const [renameModal, setRenameModal] = useState<{chatId: string, title: string} | null>(null);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Helper to check if current chat is typing
  const isCurrentChatTyping = activeChatId ? !!typingChatIds[activeChatId] : false;

  // Derived state
  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat?.messages || [];

  // Sync Global Model Dropdown to Active Chat's Memory
  useEffect(() => {
    if (activeChat && activeChat.modelId && activeChat.providerId) {
      if (activeChat.modelId !== selectedModelId || activeChat.providerId !== selectedProviderId) {
        setSelectedModelId(activeChat.modelId);
        setSelectedProviderId(activeChat.providerId);
      }
    }
  }, [activeChat, selectedModelId, selectedProviderId, setSelectedModelId, setSelectedProviderId]);

  // Sort chats: Pinned first, then by updatedAt
  const sortedChats = [...chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  }).filter(chat => chat.title.toLowerCase().includes(chatSearch.toLowerCase()));

  // Auto-inject Pico First Message Greeting
  useEffect(() => {
    if (activeChat && activeChat.messages.length === 0 && activeChat.picoId) {
      const pico = picos.find(p => p.id === activeChat.picoId);
      if (pico && pico.firstMessage) {
        addMessage(activeChat.id, {
          id: Date.now().toString(),
          role: "assistant", // Pretend it comes from the AI
          content: pico.firstMessage
        });
      }
    }
  }, [activeChatId, chats, picos, addMessage, activeChat]);

  // Reset Agent Plan when switching chats (unless it's the active executing chat)
  useEffect(() => {
    if (activeChatId !== agentChatId) {
      resetAgent();
    }
  }, [activeChatId, resetAgent, agentChatId]);

  // AUTO-RESUME Logic: Only run once on mount/layout load
  const hasAttemptedResume = useRef(false);
  useEffect(() => {
    if (!isLayoutLoaded || hasAttemptedResume.current) return;
    
    // We only want to resume if the session was truly interrupted (executing but not active in memory)
    if (isExecuting && currentPlan && agentChatId && agentMsgId) {
      console.log("MIMI: Resuming interrupted agent workflow...");
      hasAttemptedResume.current = true;
      
      const chat = chats.find(c => c.id === agentChatId);
      const msg = chat?.messages.find(m => m.id === agentMsgId);
      
      if (chat && msg) {
        executeAgentPlan(currentPlan, agentChatId, msg);
      } else {
        console.warn("MIMI: Could not find context to resume agent.");
        resetAgent();
      }
    } else {
      // If we're not resuming now, we shouldn't try again later in this session
      hasAttemptedResume.current = true;
    }
  }, [isLayoutLoaded]); // Only depend on layout load

  const fetchModels = async () => {
    if (!providers || providers.length === 0) return;
    setIsFetchingModels(true);
    setModelError("");
    
    let allModels: any[] = [];
    let hadError = false;

    // Parallel fetching from all providers
    const fetchPromises = providers.map(async (provider) => {
      if (!provider.baseUrl) return;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;

        // Route request through internal proxy to bypass CORS
        const res = await universalFetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, {
          method: "GET",
          headers
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        const modelsList = data.data || data.models || [];
        
        // Tag models with provider info
        modelsList.forEach((m: any) => {
          allModels.push({
            id: m.id,
            name: m.name,
            providerId: provider.id,
            providerName: provider.name
          });
        });
      } catch (err: any) {
        console.warn(`Failed to fetch from ${provider.name}:`, err);
        hadError = true;
      }
    });

    await Promise.allSettled(fetchPromises);
    
    // Deduplicate models based on providerId and model id
    const uniqueModelsMap = new Map();
    allModels.forEach(m => {
      const key = `${m.providerId}::${m.id}`;
      if (!uniqueModelsMap.has(key)) {
        uniqueModelsMap.set(key, m);
      }
    });
    const uniqueModels = Array.from(uniqueModelsMap.values());
    
    setAvailableModels(uniqueModels);

    if (allModels.length > 0 && !selectedModelId) {
      setSelectedModelId(allModels[0].id);
      setSelectedProviderId(allModels[0].providerId);
    }

    if (hadError && allModels.length === 0) {
      setModelError("Failed to fetch models from any provider.");
    } else if (hadError) {
      setModelError("Partially fetched models. Some providers failed.");
    }
    
    setIsFetchingModels(false);
  };

  useEffect(() => {
    if (providers.length > 0) {
      fetchModels();
    }
  }, [providers]); // Fetch when providers change or on mount

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // If user is within 50px of bottom, keep auto-scroll enabled
    isAtBottomRef.current = scrollHeight - scrollTop <= clientHeight + 50;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (!chatContainerRef.current || !isAtBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom(isCurrentChatTyping ? "auto" : "smooth");
  }, [messages, isCurrentChatTyping]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // ── Artifact Detection ──
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.content) {
      const content = lastMsg.content;
      
      // Prevent redundant processing if content hasn't changed
      if (content === lastProcessedContentRef.current) return;
      lastProcessedContentRef.current = content;

      const completeIds = new Set<string>();

      // 1. Match COMPLETE artifacts
      const completeRegex = /<artifact\s+type="([^"]+)"\s+title="([^"]+)"\s+identifier="([^"]+)"[^>]*>([\s\S]*?)<\/artifact>/gi;
      let match;
      while ((match = completeRegex.exec(content)) !== null) {
        const [, type, title, id, artifactContent] = match;
        const trimmed = artifactContent.trim();
        completeIds.add(id);
        
        // Only update if it's new or content changed
        const existing = artifacts.find(a => a.id === id);
        if (!existing || existing.content !== trimmed || existing.status !== 'complete') {
          if (!existing) {
            setIsPanelOpen(true);
          }
          addOrUpdateArtifact({
            id,
            type: type as ArtifactType,
            title,
            content: trimmed,
            status: 'complete'
          });
        }
      }

      // 2. Match INCOMPLETE (generating) artifacts
      const openRegex = /<artifact\s+type="([^"]+)"\s+title="([^"]+)"\s+identifier="([^"]+)"[^>]*>([\s\S]*?)$/gi;
      while ((match = openRegex.exec(content)) !== null) {
        const [, type, title, id, artifactContent] = match;
        const trimmed = artifactContent.trim();
        if (!completeIds.has(id)) {
          const existing = artifacts.find(a => a.id === id);
          if (!existing || existing.content !== trimmed || existing.status !== 'generating') {
            if (!existing) {
              setIsPanelOpen(true);
            }
            addOrUpdateArtifact({
              id,
              type: type as ArtifactType,
              title,
              content: trimmed,
              status: 'generating'
            });
          }
        }
      }
    }
  }, [messages, addOrUpdateArtifact, artifacts]);

  const ensureValidGmailToken = async () => {
    if (!gmailRefreshToken || !gmailTokenExpiry) return null;
    
    // Refresh if expiring in less than 5 minutes
    if (Date.now() + 5 * 60 * 1000 > gmailTokenExpiry) {
      try {
        const { accessToken, expiryDate } = await refreshGmailToken(gmailRefreshToken);
        setGmailAccessToken(accessToken);
        setGmailTokenExpiry(expiryDate);
        return accessToken;
      } catch (err) {
        console.error("Token refresh failed:", err);
      }
    }
    return gmailAccessToken;
  };

  const fetchEmailBody = async (messageId: string) => {
    setIsFetchingEmail(true);
    try {
      const validToken = await ensureValidGmailToken();
      if (!validToken) throw new Error("Not authenticated");
      
      const data = await getGmailMessage(validToken, messageId);
      setSelectedEmail(data);
    } catch (err) {
      console.error("Failed to fetch email:", err);
    } finally {
      setIsFetchingEmail(false);
    }
  };

  // ── Gmail Auth Listener ──
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GMAIL_AUTH_SUCCESS' && event.data.tokens) {
        const { tokens } = event.data;
        setGmailAccessToken(tokens.access_token);
        if (tokens.refresh_token) setGmailRefreshToken(tokens.refresh_token);
        setGmailTokenExpiry(tokens.expiry_date);
        setShowSettings(false); // Close settings after successful auth
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setGmailAccessToken, setGmailRefreshToken, setGmailTokenExpiry]);

  // ── Auto-reset/sync Web Search on Chat Switch ──
  useEffect(() => {
    setWebSearchEnabled(defaultWebSearch);
  }, [activeChatId, defaultWebSearch]);

  // ── Auto-close Panel on Chat Switch ──
  useEffect(() => {
    setIsPanelOpen(false);
  }, [activeChatId, setIsPanelOpen]);

  // ── Resize Logic ──
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < window.innerWidth * 0.8) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const generateTitleForChat = async (chatId: string, userMessage: string, provider: Provider, modelId: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;

      const res = await universalFetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: "You are a helpful assistant that generates extremely concise 3-4 word titles for a chat. Read the user's prompt and output ONLY a short title. Do not use quotes, punctuation, or conversational text. Just the title." },
            { role: "user", content: userMessage }
          ],
          stream: false,
          max_tokens: 15
        })
      });

      if (!res.ok) return;
      
      const data = await res.json();
      let generatedTitle = data.choices[0]?.message?.content?.replace(/["']/g, "")?.trim();
      
      if (generatedTitle) {
        renameChat(chatId, generatedTitle);
      }
    } catch (e) {
      console.warn("Auto-titler failed:", e);
    }
  };

  const executeAgentPlan = async (initialPlan: TaskPlan, chatId: string, userMessage: Message) => {
    setPlan(initialPlan);
    setIsExecuting(true);
    setActiveContext(chatId, userMessage.id);
    
    const taskOutputs: string[] = [];
    let runningPlan = { ...initialPlan };

    for (const task of runningPlan.tasks) {
      if (task.tool === 'final_answer') continue;

      updateTask(task.id, { status: 'executing' });
      runningPlan = { ...runningPlan, tasks: runningPlan.tasks.map(t => t.id === task.id ? { ...t, status: 'executing' } : t) };
      updateMessagePlan(chatId, userMessage.id, runningPlan);
      
      let result = "";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        let structuredResult: any = null;

        switch (task.tool) {
          case 'gmail':
            const token = await ensureValidGmailToken();
            if (!token) {
              result = "Gmail not connected.";
              break;
            }
            try {
              const gMsgs = await searchGmail(token, task.description, 15);
              structuredResult = { type: 'gmail', query: task.description, emails: gMsgs };
              result = gMsgs.map((m: any) => `[Email] From: ${m.from}, Subject: ${m.subject}, Snippet: ${m.snippet}`).join("\n");
            } catch (err) {
              result = "Gmail search failed.";
            }
            break;
          case 'search':
            try {
              const sHits = await searchWeb(task.description, tavilyApiKey);
              structuredResult = { type: 'search', query: task.description, results: sHits };
              result = sHits.map((r: any) => `[Web] ${r.title}: ${r.content}`).join("\n");
            } catch (err: any) {
              result = `Search failed: ${err.message || "Unknown error"}`;
            }
            break;
          case 'memory':
            const memoriesFound = await queryMemories(task.description);
            structuredResult = { type: 'memory', query: task.description, memories: memoriesFound };
            result = memoriesFound.map(m => `[Memory] ${m.content}`).join("\n");
            break;
          case 'files':
            if (userMessage.attachments) {
              const fileData = userMessage.attachments.filter(a => a.extractedText);
              structuredResult = { type: 'files', files: fileData.map(f => ({ name: f.name, snippet: f.extractedText?.substring(0, 500) })) };
              result = fileData
                .map(a => `[File: ${a.name}] ${a.extractedText?.substring(0, 1000)}...`)
                .join("\n");
            } else {
              result = "No files attached to analyze.";
            }
            break;
          default:
            result = `Unknown tool: ${task.tool}`;
        }
        
        clearTimeout(timeoutId);
        taskOutputs.push(`TASK: ${task.description}\nRESULT: ${result || "No data found."}`);
        
        const finalTaskResult = structuredResult || result;
        updateTask(task.id, { status: 'completed', result: finalTaskResult });
        runningPlan = { ...runningPlan, tasks: runningPlan.tasks.map(t => t.id === task.id ? { ...t, status: 'completed', result: finalTaskResult } : t) };
        updateMessagePlan(chatId, userMessage.id, runningPlan);
        
      } catch (err: any) {
        console.error(`Task ${task.id} failed:`, err);
        const errorMsg = err.name === 'AbortError' ? "Task timed out after 30s." : (err.message || "Unknown error");
        updateTask(task.id, { status: 'failed', result: errorMsg });
        runningPlan = { ...runningPlan, tasks: runningPlan.tasks.map(t => t.id === task.id ? { ...t, status: 'failed', result: errorMsg } : t) };
        updateMessagePlan(chatId, userMessage.id, runningPlan);
        taskOutputs.push(`TASK: ${task.description}\nFAILED: ${errorMsg}`);
      }
    }

    // After all tasks are done, send the final synthesized prompt
    const finalTask = runningPlan.tasks.find(t => t.tool === 'final_answer');
    const isReviewMode = finalTask?.agentRole === 'reviewer';
    
    const finalContext = taskOutputs.join("\n\n---\n\n");
    setIsExecuting(false);
    
    // Sync final plan to history
    updateMessagePlan(chatId, userMessage.id, runningPlan);
    
    // Mark final answer task as executing
    if (finalTask) {
      updateTask(finalTask.id, { status: 'executing' });
      runningPlan = { ...runningPlan, tasks: runningPlan.tasks.map(t => t.id === finalTask.id ? { ...t, status: 'executing' } : t) };
      updateMessagePlan(chatId, userMessage.id, runningPlan);
    }

    // --- MULTI-AGENT COLLABORATION: Add Role Context ---
    let enhancedContext = finalContext;
    if (isReviewMode) {
      enhancedContext = `[SYSTEM: REVIEWER MODE ACTIVE]\nYou are acting as a specialist Reviewer. Below are the execution results. Your goal is to critically audit the findings, verify their correctness, and provide a high-quality, verified synthesis for the user.\n\n${finalContext}`;
    } else {
      const role = finalTask?.agentRole || 'analyst';
      enhancedContext = `[SYSTEM: ROLE: ${role.toUpperCase()}]\nSynthesize the following execution results based on your expertise as a ${role}.\n\n${finalContext}`;
    }

    await sendMessage(userMessage.content, false, undefined, enhancedContext);

    // Mark final answer task as complete
    if (finalTask) {
      updateTask(finalTask.id, { status: 'completed' });
      runningPlan = { ...runningPlan, tasks: runningPlan.tasks.map(t => t.id === finalTask.id ? { ...t, status: 'completed' } : t) };
      updateMessagePlan(chatId, userMessage.id, runningPlan);
    }
  };


  const sendMessage = async (overrideInput?: string, isRegenerating = false, overrideChatId?: string, agentContext?: string) => {
    const textToSend = overrideInput !== undefined ? overrideInput : input;
    if (isCurrentChatTyping || (!textToSend.trim() && pendingAttachments.length === 0 && !isRegenerating)) return;

    let targetChatId = overrideChatId || activeChatId;
    if (!targetChatId) {
      handleNewChat();
      return;
    }

    const activeProvider = providers.find(p => p.id === selectedProviderId);
    if (!activeProvider) return;

    const activeChat = chats.find(c => c.id === targetChatId);
    const messages = activeChat ? activeChat.messages : [];
    
    // --- AGENTIC PLANNING TRIGGER ---
    if (!agentContext && !isRegenerating) {
      const complexKeywords = [
        "search", "email", "gmail", "remember", "check", "find", "analyze", "summarize", "draft",
        "current", "latest", "price", "value", "rate", "today", "now", "news", "weather", "stock",
        "exchange", "who is", "what is", "whats", "how much"
      ];
      const isComplex = textToSend.split(/\s+/).length > 10 || complexKeywords.some(k => textToSend.toLowerCase().includes(k));
      
      if (isComplex) {
        // --- OPTIMISTIC UI: Add message with skeleton plan immediately ---
        const userId = Date.now().toString() + Math.random().toString();
        const skeletonPlan: TaskPlan = {
          goal: textToSend,
          tasks: [{ 
            id: 'planning-step', 
            tool: 'planning', 
            description: 'Architecting execution plan...', 
            status: 'executing' 
          }]
        };
        
        const userMessage: Message = { 
          id: userId, 
          role: "user", 
          content: textToSend, 
          attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
          agentPlan: skeletonPlan
        };
        
        addMessage(targetChatId, userMessage);
        setActiveContext(targetChatId, userMessage.id);
        
        if (overrideInput === undefined) {
          setInput("");
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
        setPendingAttachments([]);
        // ----------------------------------------------------------------

        if (!selectedModelId) {
          console.warn("No model selected, skipping planning.");
          throw new Error("Please select an AI model in settings first.");
        }

        setIsPlanning(true);

        try {
          const planRes = await fetch("/api/agent/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal: textToSend, provider: activeProvider, modelId: selectedModelId })
          });
          
          if (!planRes.ok) {
            const errorText = await planRes.text();
            console.warn("Planning API returned error:", errorText);
            throw new Error(`Planning failed: ${planRes.status}`);
          }
            const plan = await planRes.json();
            if (plan.tasks && plan.tasks.length > 1) {
              // Update the previously added message with the real plan
              updateMessagePlan(targetChatId, userId, plan);
              await executeAgentPlan(plan, targetChatId, userMessage);
              return;
            }
        } catch (err) {
          console.warn("Planning failed, falling back to direct mode:", err);
        } finally {
          setIsPlanning(false);
        }
      }
    }
    // --------------------------------

    const attachmentsToSend = [...pendingAttachments];
    setPendingAttachments([]); // Clear visually immediately

    const userId = Date.now().toString() + Math.random().toString();
    const userMessage: Message = { id: userId, role: "user", content: textToSend, attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined };
    
    // Check if this is the first message in the chat to trigger AI auto-title
    const isFirstMessage = !activeChatId || (activeChat && activeChat.messages.length === 0);

    if (!isRegenerating && !agentContext) {
      addMessage(targetChatId, userMessage);
      if (overrideInput === undefined) {
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    }
    
    setTypingChatIds(prev => ({ ...prev, [targetChatId!]: true }));

    if (isFirstMessage && !isRegenerating) {
      generateTitleForChat(targetChatId, textToSend, activeProvider, selectedModelId);
    }

    let searchData: any[] = [];
    if (webSearchEnabled && tavilyApiKey && !agentContext) {
      setIsSearching(true);
      try {
        const searchRes = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: textToSend, apiKey: tavilyApiKey })
        });
        if (searchRes.ok) {
          const { results } = await searchRes.json();
          searchData = results;
        }
      } catch (err) {
        console.warn("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }

    let gmailData: any[] = [];
    const gmailKeywords = ["email", "gmail", "inbox", "message", "mail"];
    const isGmailQuery = gmailKeywords.some(k => textToSend.toLowerCase().includes(k));

    if (isGmailQuery && gmailAccessToken && !agentContext) {
      setIsSearchingGmail(true);
      try {
        const validToken = await ensureValidGmailToken();
        const gmailRes = await fetch("/api/gmail/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            accessToken: validToken, 
            refreshToken: gmailRefreshToken,
            query: textToSend,
            maxResults: 15
          })
        });
        if (gmailRes.ok) {
          const { messages } = await gmailRes.json();
          gmailData = messages;
        }
      } catch (err) {
        console.warn("Gmail search failed:", err);
      } finally {
        setIsSearchingGmail(false);
      }
    }

    let formattedMessages = (isRegenerating ? messages : [...messages, userMessage]).map(({ role, content, attachments }) => {
      if (attachments && attachments.length > 0) {
        const images = attachments.filter(a => a.dataUrl && !a.extractedText);
        const docs = attachments.filter(a => a.extractedText);

        // Prepend extracted document text to message content
        let enrichedContent = content;
        if (docs.length > 0) {
          const docBlocks = docs
            .map(d => formatDocumentForPrompt(d.name, d.extractedText!))
            .join("\n\n");
          enrichedContent = `${docBlocks}\n\n${content}`;
        }

        if (images.length > 0) {
          // Multimodal: text + image_url parts
          const multimodalContent = [
            { type: "text", text: enrichedContent },
            ...images.map(att => ({
              type: "image_url",
              image_url: { url: att.dataUrl }
            }))
          ];
          return { role, content: multimodalContent as any };
        }

        return { role, content: enrichedContent };
      }
      return { role, content };
    });
    
    // --- CONTEXT WINDOW OPTIMIZATION ---
    // Keep only the most recent 8 messages to prevent "context length exceeded" errors.
    const MAX_CONTEXT_MESSAGES = 8;
    if (formattedMessages.length > MAX_CONTEXT_MESSAGES) {
      formattedMessages = formattedMessages.slice(-MAX_CONTEXT_MESSAGES);
    }
    // -----------------------------------

    const ARTIFACT_INSTRUCTIONS = `
Whenever you are creating a standalone piece of content like a website, a document template, a diagram (SVG), a spreadsheet, or a substantial code snippet, you MUST wrap it in an <artifact> tag.
Format:
<artifact type="html|svg|code|excel" title="Descriptive Title" identifier="unique-id">
... content here ...
</artifact>

- Use 'html' for web pages, 'svg' for vector graphics, 'code' for general snippets.
- Use 'excel' for data analysis, reports, or spreadsheets. The content MUST be valid CSV data.
- IMPORTANT: NEVER create an artifact unless the user EXPLICITLY asks for a deliverable like a website, template, code file, diagram, or spreadsheet. DO NOT offer unsolicited artifacts or generate "helpful" examples unless specifically prompted to do so. Keep the conversation in the chat unless structured content is required.
`;

    const BASE_SYSTEM_PROMPT = "You are MIMI, a professional AI data workstation and coding assistant. Be concise, helpful, and direct. Prioritize clean chat for simple interactions and only use artifacts for complex deliverables.";

    const activePicoId = activeChat ? activeChat.picoId : selectedPicoId;
    const activePico = picos.find(p => p.id === activePicoId);
    
    const SEARCH_INSTRUCTIONS = searchData.length > 0 
      ? `\n\nYou have access to real-time search results for the user's query. Use this information to provide a factual, up-to-date answer.\n\n<search_results>\n${searchData.slice(0, 5).map((r, i) => `[${i+1}] ${r.title}: ${r.content.substring(0, 600)}...`).join("\n\n")}\n</search_results>`
      : "";

    const GMAIL_INSTRUCTIONS = gmailData.length > 0
      ? `\n\n<gmail_results>\n${gmailData.slice(0, 15).map((e, i) => `[Email ${i+1}] From: ${e.from}, Subject: ${e.subject}\nSnippet: ${e.snippet.substring(0, 400)}...`).join("\n\n")}\n</gmail_results>`
      : "";

    // Memory Recall
    const recalledMemories = await queryMemories(textToSend);
    const MEMORY_INSTRUCTIONS = recalledMemories.length > 0
      ? `\n\n<recalled_context>\nYou remember these relevant facts/preferences from past conversations:\n${recalledMemories.map((m, i) => `[Fact ${i+1}] ${m.content}`).join("\n")}\n</recalled_context>\nUse this context to personalize your answer.`
      : "";

    // Agent Context
    const AGENT_INSTRUCTIONS = agentContext 
      ? `\n\n<agent_execution_results>\nYou have successfully executed a multi-step task plan to fulfill the user's goal. Below are the raw results from your tools. SYNTHESIZE this information into a clear, professional response for the user.\n\n${agentContext}\n</agent_execution_results>`
      : "";

    const systemContent = activePico && activePico.systemPrompt 
      ? `${activePico.systemPrompt}\n\n${ARTIFACT_INSTRUCTIONS}${SEARCH_INSTRUCTIONS}${GMAIL_INSTRUCTIONS}${MEMORY_INSTRUCTIONS}${AGENT_INSTRUCTIONS}`
      : `${BASE_SYSTEM_PROMPT}\n\n${ARTIFACT_INSTRUCTIONS}${SEARCH_INSTRUCTIONS}${GMAIL_INSTRUCTIONS}${MEMORY_INSTRUCTIONS}${AGENT_INSTRUCTIONS}`;

    formattedMessages = [
      { role: "system", content: systemContent },
      ...formattedMessages
    ];
    
    const abortController = new AbortController();
    abortControllersRef.current.set(targetChatId, abortController);

    const assistantId = Date.now().toString() + Math.random().toString();
    addMessage(targetChatId, { 
      id: assistantId, 
      role: "assistant", 
      content: "",
      searchResults: searchData.length > 0 ? searchData : undefined,
      gmailResults: gmailData.length > 0 ? gmailData : undefined
    });

    let accumulatedContent = "";

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeProvider.apiKey) headers["Authorization"] = `Bearer ${activeProvider.apiKey}`;

      if (!selectedModelId) throw new Error("No model selected. Please choose a model in the top bar.");

      const res = await universalFetch(`${activeProvider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: "POST",
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          model: selectedModelId,
          messages: formattedMessages,
          stream: true,
        })
      });

      if (!res.ok) {
        const errorDetail = await res.text().catch(() => "Unknown error");
        throw new Error(`AI Provider Error (${res.status}): ${errorDetail}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let done = false;

      while (!done) {
        if (abortController.signal.aborted) {
          await reader.cancel();
          break;
        }
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter(line => line.trim() !== "");
          
          for (const line of lines) {
            if (line.replace(/^data: /, "").trim() === "[DONE]") {
              done = true;
              break;
            }
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace(/^data: /, ""));
                const contentChunk = data.choices[0]?.delta?.content || "";
                accumulatedContent += contentChunk;
                
                updateMessage(targetChatId, assistantId, accumulatedContent);
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (err: any) {
      const errorStr = String(err).toLowerCase();
      if (err.name === 'AbortError' || errorStr.includes('cancel')) {
        return;
      }
      console.error("Stream failed:", err);
      updateMessage(targetChatId, assistantId, `Error: ${err.message || "Something went wrong."}`);
    } finally {
      setTypingChatIds(prev => ({ ...prev, [targetChatId!]: false }));
      abortControllersRef.current.delete(targetChatId);

      // Trigger Memory Distillation after message complete
      if (accumulatedContent.length > 20 || textToSend.length > 20) {
        distillMemories(targetChatId, userMessage, accumulatedContent);
      }
    }
  };

  const distillMemories = async (chatId: string, latestUserMessage?: Message, latestAssistantContent?: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    // Build the "Recent Knowledge" string
    let userText = latestUserMessage?.content || "";
    if (latestUserMessage?.attachments) {
      const attachmentContext = latestUserMessage.attachments
        .filter(a => a.extractedText)
        .map(a => `[File: ${a.name}]\n${a.extractedText}`)
        .join("\n\n");
      if (attachmentContext) userText = `${attachmentContext}\n\nUser Message: ${userText}`;
    }

    const recentHistory = latestUserMessage && latestAssistantContent
      ? `user: ${userText}\nassistant: ${latestAssistantContent}`
      : chat.messages.slice(-4).map(m => `${m.role}: ${m.content}`).join("\n");

    const activeProvider = providers.find(p => p.id === selectedProviderId);
    if (!activeProvider) return;

    try {
      const res = await fetch("/api/memory/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: recentHistory,
          provider: activeProvider,
          modelId: selectedModelId
        })
      });

        if (res.ok) {
          const { memories: extracted } = await res.json();
          for (const m of extracted) {
            // MemoryContext now handles deduplication automatically
            await addMemory(m.content, m.type, m.importance);
          }
        }
    } catch (err) {
      console.warn("Memory distillation failed:", err);
    }
  };

  const handleExportData = () => {
    const data = {
      version: "1.0",
      timestamp: Date.now(),
      settings: {
        providers,
        picos,
        selectedPicoId,
        selectedModelId,
        selectedProviderId,
        tavilyApiKey,
        defaultWebSearch,
        gmailAccessToken,
        gmailRefreshToken,
        gmailTokenExpiry
      },
      chats
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mimi_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.settings || !data.chats) throw new Error("Invalid backup format");

        // Update Settings
        if (data.settings.providers) setProviders(data.settings.providers);
        if (data.settings.picos) setPicos(data.settings.picos);
        if (data.settings.selectedPicoId) setSelectedPicoId(data.settings.selectedPicoId);
        if (data.settings.selectedModelId) setSelectedModelId(data.settings.selectedModelId);
        if (data.settings.selectedProviderId) setSelectedProviderId(data.settings.selectedProviderId);
        if (data.settings.tavilyApiKey) setTavilyApiKey(data.settings.tavilyApiKey);
        if (data.settings.defaultWebSearch !== undefined) setDefaultWebSearch(data.settings.defaultWebSearch);
        if (data.settings.gmailAccessToken) setGmailAccessToken(data.settings.gmailAccessToken);
        if (data.settings.gmailRefreshToken) setGmailRefreshToken(data.settings.gmailRefreshToken);
        if (data.settings.gmailTokenExpiry) setGmailTokenExpiry(data.settings.gmailTokenExpiry);

        // Update Chats
        importChats(data.chats);

        alert("Data imported successfully! Your settings and chats have been restored.");
        setShowSettings(false);
      } catch (err) {
        console.error("Import failed:", err);
        alert("Failed to import data. Please ensure the file is a valid MIMI backup.");
      }
    };
    reader.readAsText(file);
  };

  const stopMessage = () => {
    if (activeChatId) {
      const controller = abortControllersRef.current.get(activeChatId);
      if (controller) {
        controller.abort();
        abortControllersRef.current.delete(activeChatId);
      }
      
      // If the last message is an empty assistant message, remove it to clear the dots
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'assistant' && !lastMsg.content) {
          deleteMessage(activeChatId, lastMsg.id);
        }
      }

      // Also finalize any artifacts that were in 'generating' state
      artifacts.forEach(art => {
        if (art.status === 'generating') {
          addOrUpdateArtifact({ ...art, status: 'complete' });
        }
      });
      
      setTypingChatIds(prev => ({ ...prev, [activeChatId]: false }));
      resetAgent();
    }
  };

  const regenerateMessage = (assistantMsgId: string) => {
    if (!activeChat || isCurrentChatTyping) return;
    
    const msgIndex = activeChat.messages.findIndex(m => m.id === assistantMsgId);
    if (msgIndex === -1) return;
    
    const userMsg = activeChat.messages[msgIndex - 1];
    if (!userMsg || userMsg.role !== 'user') return;
    
    deleteMessage(activeChat.id, assistantMsgId);
    sendMessage(userMsg.content, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isCurrentChatTyping) sendMessage();
    }
  };

  const autoResizeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const addFilesToAttachments = (files: FileList | File[]) => {
    Array.from(files).forEach(async (file) => {
      const category = getFileCategory(file);
      if (category === "unknown") return; // ignore unsupported types

      if (category === "image") {
        // Images: store as dataUrl for multimodal API
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setPendingAttachments(prev => [
            ...prev,
            { dataUrl, name: file.name || "pasted_image", type: file.type, fileSize: file.size, category }
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        // Documents: extract text client-side
        setIsParsing(true);
        try {
          const extractedText = await extractTextFromFile(file);
          setPendingAttachments(prev => [
            ...prev,
            { name: file.name, type: file.type, extractedText, fileSize: file.size, category }
          ]);
        } catch (err) {
          console.warn("Failed to parse file:", err);
          const errMsg = err instanceof Error ? err.message : String(err);
          alert(`Could not read "${file.name}".\n\nDetails: ${errMsg}`);
        } finally {
          setIsParsing(false);
        }
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFilesToAttachments(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    
    if (imageFiles.length > 0) {
      e.preventDefault(); // Prevent default text-pasting if it's purely an image
      addFilesToAttachments(imageFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToAttachments(e.dataTransfer.files);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chatId });
  };

  useEffect(() => {
    if (chats.length === 0 && !activeChatId && (defaultModelId || selectedModelId)) {
      handleNewChat();
    }
  }, [chats, activeChatId, defaultModelId, selectedModelId, handleNewChat]);

  return (
    <div className={currentTheme !== 'onyx' ? `theme-${currentTheme}` : ''} style={{ display: 'contents' }}>
      <aside className={`sidebar ${isSidebarOpen ? '' : 'closed'}`}>
        <div className="sidebar-header" style={{ marginBottom: '1.5rem', gap: '0.5rem' }}>
          <div className="logo-box" style={{ animation: 'purr-pulse 6s infinite ease-in-out' }}>
            <img 
              src="/logo.png" 
              alt="MIMI" 
              style={{ 
                width: '85%', 
                height: '85%', 
                objectFit: 'contain', 
                imageRendering: 'pixelated', 
                filter: 'url(#remove-white)' // Surgical background removal
              }} 
            />
          </div>
          <h1 className="sidebar-title">MIMI</h1>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '20px', height: '20px'}}>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Chat
        </button>
        
        {/* Pico Selector Section (Hidden)
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'var(--bg-deep)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          ...
        </div>
        */}

        <div className="sidebar-search-wrapper" style={{ position: 'relative', marginBottom: '1.25rem' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--text-tertiary)' }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Search chats..."
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '2.25rem', paddingRight: chatSearch ? '2.25rem' : '0.75rem', paddingBottom: '0.5rem', paddingTop: '0.5rem', fontSize: '0.875rem', borderRadius: '0.75rem', background: 'var(--bg-deep)' }}
          />
          {chatSearch && (
            <button 
              onClick={() => setChatSearch("")}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-tertiary)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              title="Clear Search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '14px', height: '14px'}}>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <div className="history-section">
          <h2 className="history-title">Your Chats</h2>
          <div className="history-list">
            {sortedChats.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', marginTop: '1rem' }}>No chats found.</div>
            ) : (
              sortedChats.map(chat => (
                <div 
                  key={chat.id}
                  className={`history-item ${activeChatId === chat.id ? 'active' : ''}`}
                  onClick={() => setActiveChatId(chat.id)}
                  onContextMenu={(e) => handleContextMenu(e, chat.id)}
                >
                  <div className="history-item-content">
                    <span className="history-item-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {chat.title}
                      {typingChatIds[chat.id] && (
                        <span className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--accent-base)', flexShrink: 0 }}></span>
                      )}
                    </span>
                    {chat.pinned && (
                      <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="pin-indicator" style={{width: '12px', height: '12px'}}>
                        <path d="M16 11V5.5a4 4 0 00-8 0V11l-2 3v1h5.5v5h1v-5H18v-1l-2-3zm-6-5.5a2 2 0 014 0V11H10V5.5z"></path>
                      </svg>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <button className="settings-btn" style={{marginTop: 'auto', marginBottom: 0}} onClick={() => setShowSettings(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="settings-icon">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Settings
        </button>
      </aside>

      <main className="main-content" onDragOver={handleDragOver} onDrop={handleDrop}>
        <div className="top-bar">
          <button 
            className="sidebar-toggle-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Toggle Sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
          <div className="model-info" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Model:
            <CustomModelSelect 
              availableModels={availableModels}
              selectedProviderId={selectedProviderId}
              selectedModelId={selectedModelId}
              onSelect={(pId: string, mId: string) => {
                setSelectedProviderId(pId);
                setSelectedModelId(mId);
                if (activeChatId) {
                  updateChatModel(activeChatId, pId, mId);
                }
              }}
            />
          </div>
          <span style={{marginLeft: 'auto', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-tertiary)'}}>{activeChat?.title}</span>
        </div>

        <div className={`main-layout-container ${isResizing ? 'resizing' : ''}`}>
          <div className={`chat-view ${isPanelOpen ? 'panel-open' : ''}`}>
            <div 
              className="chat-area"
              ref={chatContainerRef}
              onScroll={handleScroll}
              data-typing={isCurrentChatTyping}
            >
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <div className="cat-sprite-container"></div>
                  </div>
                  <h2 className="empty-title">
                    Hi, I'm MIMI
                  </h2>
                  <p className="empty-subtitle">Your secure, local AI running beautifully on your terms.</p>
                  
                  <div className="suggestions-grid">
                     <button onClick={() => sendMessage("Write a 5-step plan to launch a successful app")} className="suggestion-btn">
                        "Write a 5-step plan to launch a successful app..."
                     </button>
                     <button onClick={() => sendMessage("Explain how local LLMs work under the hood")} className="suggestion-btn">
                        "Explain how local LLMs work under the hood..."
                     </button>
                  </div>
                </div>
              ) : (
                <div className="message-list">
                  {messages.map((msg, index) => {
                    const isLastUserMessage = msg.role === 'user' && !messages.slice(index + 1).some(m => m.role === 'user');
                    return (
                      <React.Fragment key={msg.id}>
                        <div className={`message-wrapper ${msg.role}`}>
                          <span className="message-label">{msg.role === 'user' ? 'You' : 'MIMI'}</span>
                          <div className="message-bubble">
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="message-attachments-display">
                                {msg.attachments.map((att, i) => (
                                  att.dataUrl
                                    ? <img key={i} src={att.dataUrl} alt={att.name} className="message-attachment-img" />
                                    : <DocChip key={i} name={att.name} type={att.type} fileSize={att.fileSize} />
                                ))}
                              </div>
                            )}

                            {msg.role === 'assistant' && msg.searchResults && (
                              <SourcePanel sources={msg.searchResults} />
                            )}

                            {msg.role === 'assistant' && msg.gmailResults && (
                              <GmailPanel emails={msg.gmailResults} onEmailClick={fetchEmailBody} />
                            )}
                            
                            {msg.role === 'assistant' && !msg.content ? (
                              <span style={{display:'flex', gap:'0.4rem', alignItems:'center', padding:'0.1rem 0'}}>
                                <span className="typing-dot"></span>
                                <span className="typing-dot"></span>
                                <span className="typing-dot"></span>
                              </span>
                            ) : (
                              <>
                                <div className="markdown-content">
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex, rehypeRaw]}
                                    components={{ 
                                      code: CodeBlock,
                                      artifact: ArtifactBox,
                                      invoke: () => null
                                    } as any}
                                  >
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              </>
                            )}
                          </div>
                          {msg.content && (
                            <div className="message-actions">
                              {msg.role === 'assistant' && (
                                <button 
                                  onClick={() => regenerateMessage(msg.id)}
                                  className="action-icon-btn"
                                  title="Regenerate response"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                </button>
                              )}
                              <CopyButton text={msg.content} />
                            </div>
                          )}
                        </div>
                        {(msg.agentPlan || (isLastUserMessage && currentPlan)) && (
                          <TaskBoard plan={(isLastUserMessage && currentPlan) || msg.agentPlan} />
                        )}
                      </React.Fragment>
                    );
                  })}
                  
                  
                  {isSearching && (
                    <div className="searching-indicator">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spinning" style={{width: '14px', height: '14px'}}>
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <span>Searching the web...</span>
                    </div>
                  )}

                  {isRecalling && (
                    <div className="searching-indicator" style={{ color: 'var(--accent-base)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spinning" style={{width: '14px', height: '14px'}}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      <span>Recalling memories...</span>
                    </div>
                  )}
                  
                  {isCurrentChatTyping && messages[messages.length - 1]?.role === 'user' && (
                    <div className="message-wrapper assistant typing-indicator">
                      <span className="message-label">MIMI</span>
                      <div className="message-bubble">
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="input-area-wrapper">
              {(pendingAttachments.length > 0 || isParsing) && (
                <div className="attachment-preview-tray">
                  {isParsing && (
                    <div className="doc-chip parsing">
                      <span style={{display:'flex',gap:'0.3rem',alignItems:'center'}}>
                        <span className="typing-dot" style={{width:'6px',height:'6px'}}></span>
                        <span className="typing-dot" style={{width:'6px',height:'6px'}}></span>
                        <span className="typing-dot" style={{width:'6px',height:'6px'}}></span>
                      </span>
                      <span>Parsing…</span>
                    </div>
                  )}
                  {pendingAttachments.map((att, i) => (
                    <div key={i} className={`attachment-preview-item ${att.category !== 'image' ? 'doc-preview-item' : ''}`}>
                      {att.dataUrl
                        ? <img src={att.dataUrl} alt={att.name} className="attachment-thumbnail" />
                        : <DocChip name={att.name} type={att.type} fileSize={att.fileSize} compact />
                      }
                      <button onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))} className="attachment-remove-btn" title="Remove attachment">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="input-container">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="attach-button" onClick={() => fileInputRef.current?.click()} title="Attach File">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: "1.25rem", height: "1.25rem"}}>
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                  </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md" multiple hidden />
                
                <textarea 
                  ref={textareaRef}
                  value={input}
                  onChange={autoResizeTextarea}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Message MIMI..." 
                  rows={1}
                  className="chat-input"
                />
                {isCurrentChatTyping ? (
                  <button 
                    onClick={stopMessage}
                    className="send-button"
                    style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)' }}
                    title="Stop Generating"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{width: "1rem", height: "1rem"}}>
                      <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
                    </svg>
                  </button>
                ) : (
                  <button 
                    onClick={() => sendMessage()}
                    disabled={!input.trim() && pendingAttachments.length === 0 || isPlanning || isExecuting}
                    className="send-button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: "1.25rem", height: "1.25rem"}}>
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                )}
              </div>
              <div className="disclaimer-text">
                AI can make mistakes. Verify important information.
              </div>
            </div>
          </div>

          {isPanelOpen && (
            <div 
              className={`resize-handle ${isResizing ? 'active' : ''}`} 
              onMouseDown={() => setIsResizing(true)}
            />
          )}

          <ArtifactPanel width={panelWidth} />

          {/* Overlay to prevent iframe from swallowing mouse events during resize */}
          {isResizing && <div className="resize-overlay" />}
        </div>
      </main>

      {/* Pico Modals */}
      {/* Pico Modals (Hidden)
      {showPicoModal && (
        ...
      )}
      */}

      {/* Settings & API Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowSettings(false)}></div>
          
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%', height: '80vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '2rem', height: '2rem', background: 'var(--accent-glow)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-base)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1.1rem', height: '1.1rem'}}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </div>
                <h2 className="modal-title" style={{ fontSize: '1.25rem' }}>MIMI Studio Settings</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width: '14px', height: '14px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Settings Sidebar */}
              <div style={{ width: '220px', background: 'var(--bg-deep)', borderRight: '1px solid var(--border-light)', padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button 
                  onClick={() => setSettingsTab('ai')}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none',
                    background: settingsTab === 'ai' ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: settingsTab === 'ai' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    cursor: 'pointer', textAlign: 'left', fontWeight: settingsTab === 'ai' ? 600 : 400, transition: 'all 0.2s'
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1rem', height: '1rem'}}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                  AI & Models
                </button>
                <button 
                  onClick={() => setSettingsTab('integrations')}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none',
                    background: settingsTab === 'integrations' ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: settingsTab === 'integrations' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    cursor: 'pointer', textAlign: 'left', fontWeight: settingsTab === 'integrations' ? 600 : 400, transition: 'all 0.2s'
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1rem', height: '1rem'}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  Integrations
                </button>
                <button 
                  onClick={() => setSettingsTab('memory')}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none',
                    background: settingsTab === 'memory' ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: settingsTab === 'memory' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    cursor: 'pointer', textAlign: 'left', fontWeight: settingsTab === 'memory' ? 600 : 400, transition: 'all 0.2s'
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1rem', height: '1rem'}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  Memory Vault
                </button>
                <button 
                  onClick={() => setSettingsTab('theme')}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none',
                    background: settingsTab === 'theme' ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: settingsTab === 'theme' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    cursor: 'pointer', textAlign: 'left', fontWeight: settingsTab === 'theme' ? 600 : 400, transition: 'all 0.2s'
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1rem', height: '1rem'}}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                  Theme
                </button>
                <button 
                  onClick={() => setSettingsTab('advanced')}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none',
                    background: settingsTab === 'advanced' ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: settingsTab === 'advanced' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    cursor: 'pointer', textAlign: 'left', fontWeight: settingsTab === 'advanced' ? 600 : 400, transition: 'all 0.2s'
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1rem', height: '1rem'}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  Advanced
                </button>
              </div>

              {/* Settings Content Area */}
              <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                
                {settingsTab === 'ai' && (
                  <div className="fade-in">
                    <div style={{ marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>AI Providers</h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '0.25rem 0 0 0' }}>Configure your LLM connection points</p>
                        </div>
                        <button 
                          className="add-provider-btn"
                          onClick={() => {
                            const newProvider: Provider = { id: Date.now().toString(), name: "", baseUrl: "", apiKey: "" };
                            setProviders([...providers, newProvider]);
                          }}
                          style={{ margin: 0, padding: '0.5rem 1rem', borderRadius: '0.5rem' }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Add Provider
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {providers.map((provider, index) => (
                          <div key={provider.id} className="provider-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '1rem' }}>
                            <div className="provider-header" style={{ marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: provider.baseUrl ? '#22c55e' : 'var(--text-tertiary)' }}></div>
                                <span style={{ fontWeight: 600 }}>{provider.name || `New Provider`}</span>
                              </div>
                              <button 
                                onClick={() => setProviders(providers.filter(p => p.id !== provider.id))}
                                style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px'}}><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                              </button>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                              <input 
                                type="text" value={provider.name} placeholder="Name" className="form-input"
                                onChange={(e) => {
                                  const next = [...providers]; next[index].name = e.target.value; setProviders(next);
                                }}
                              />
                              <input 
                                type="text" value={provider.baseUrl} placeholder="API URL" className="form-input"
                                onChange={(e) => {
                                  const next = [...providers]; next[index].baseUrl = e.target.value; setProviders(next);
                                }}
                              />
                              <input 
                                type="password" value={provider.apiKey} placeholder="API Key" className="form-input"
                                onChange={(e) => {
                                  const next = [...providers]; next[index].apiKey = e.target.value; setProviders(next);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="settings-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '2rem', paddingBottom: '2rem' }}>
                      <div className="model-header-row" style={{ marginBottom: '1rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Active Model</h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '0.25rem 0 0 0' }}>The default model for new conversations</p>
                        </div>
                        <button onClick={fetchModels} disabled={isFetchingModels} className="fetch-btn" style={{ padding: '0.5rem 1rem' }}>
                          {isFetchingModels ? "Refreching..." : "Sync Models"}
                        </button>
                      </div>
                      
                      {modelError && <div className="error-text" style={{ marginBottom: '1rem' }}>{modelError}</div>}
                      
                      <CustomModelSelect 
                        availableModels={availableModels}
                        selectedProviderId={selectedProviderId}
                        selectedModelId={selectedModelId}
                        onSelect={(pId: string, mId: string) => {
                          setSelectedProviderId(pId);
                          setSelectedModelId(mId);
                        }}
                      />
                    </div>

                    <div className="settings-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '2rem' }}>
                      <div className="model-header-row" style={{ marginBottom: '1rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Pinned Default Model</h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '0.25rem 0 0 0' }}>The model that will be used for every NEW chat, regardless of current selection.</p>
                        </div>
                      </div>
                      
                      <CustomModelSelect 
                        availableModels={availableModels}
                        selectedProviderId={defaultProviderId}
                        selectedModelId={defaultModelId}
                        onSelect={(pId: string, mId: string) => {
                          setDefaultProviderId(pId);
                          setDefaultModelId(mId);
                        }}
                      />
                      {defaultModelId && (
                        <div style={{ marginTop: '1.25rem' }}>
                          <button 
                            onClick={() => { setDefaultModelId(null); setDefaultProviderId(null); }}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                          >
                            Clear Pin (Follow last used)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {settingsTab === 'integrations' && (
                  <div className="fade-in">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>External Tools</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Web Search Card */}
                      <div className="provider-card" style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div style={{ width: '3rem', height: '3rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1.5rem', height: '1.5rem'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1rem' }}>Web Search (Tavily API)</h4>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Gives AI real-time internet access</p>
                          </div>
                        </div>

                        <input 
                          type="password" value={tavilyApiKey} className="form-input" placeholder="Tavily API Key (tvly-...)"
                          onChange={(e) => setTavilyApiKey(e.target.value)}
                          style={{ padding: '0.75rem', marginBottom: '1rem' }}
                        />
                        
                      </div>

                      {/* Gmail Card */}
                      <div className="provider-card" style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div style={{ width: '3rem', height: '3rem', background: gmailAccessToken ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: gmailAccessToken ? '#22c55e' : '#ef4444' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1.5rem', height: '1.5rem'}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1rem' }}>Gmail Integration</h4>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Allow AI to read and search your messages</p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-deep)', borderRadius: '0.75rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Status: {gmailAccessToken ? "Connected" : "Disconnected"}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{gmailAccessToken ? "Linked to your Google account" : "No account linked"}</span>
                          </div>
                          {gmailAccessToken ? (
                            <button 
                              onClick={() => { setGmailAccessToken(null); setGmailRefreshToken(null); setGmailTokenExpiry(null); }}
                              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Disconnect
                            </button>
                          ) : (
                            <button 
                              onClick={() => {
                                const width = 500, height = 600;
                                const left = (window.innerWidth - width) / 2;
                                const top = (window.innerHeight - height) / 2;
                                window.open('/api/gmail/auth', 'google-auth', `width=${width},height=${height},top=${top},left=${left}`);
                              }}
                              style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: 'var(--accent-base)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'memory' && (
                  <MemoryVault />
                )}

                {settingsTab === 'advanced' && (
                  <div className="fade-in">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Maintenance & Data</h3>
                    
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1.5rem', borderRadius: '1.25rem' }}>
                      <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1.1rem', height: '1.1rem'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Danger Zone
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        This will permanently delete all your conversation history from this browser. This action cannot be undone.
                      </p>
                      <button 
                        onClick={() => setShowDeleteAllConfirm(true)} 
                        className="submit-btn" 
                        style={{ width: 'auto', padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)' }}
                      >
                        Delete All Data
                      </button>
                    </div>

                    <div style={{ marginTop: '2rem', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: '1.5rem', borderRadius: '1.25rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1.1rem', height: '1.1rem'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Data Migration
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Move your providers, settings, and chat history between browsers (e.g. Edge to Chrome).
                      </p>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                          onClick={handleExportData}
                          className="submit-btn" 
                          style={{ width: 'auto', padding: '0.75rem 1.5rem', background: 'var(--bg-surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', boxShadow: 'none' }}
                        >
                          Export Backup
                        </button>
                        <button 
                          onClick={() => migrationInputRef.current?.click()}
                          className="submit-btn" 
                          style={{ width: 'auto', padding: '0.75rem 1.5rem', background: 'var(--accent-base)', color: 'white', border: 'none' }}
                        >
                          Import Backup
                        </button>
                        <input 
                          type="file" 
                          ref={migrationInputRef} 
                          style={{ display: 'none' }} 
                          accept=".json"
                          onChange={handleImportData}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {settingsTab === 'theme' && (
                  <div className="fade-in">
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Visual Appearance</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      {[
                        { id: 'onyx', name: 'Onyx Dark', color: '#e68a45', bg: '#120e0c' },
                        { id: 'ocean', name: 'Deep Ocean', color: '#3b82f6', bg: '#06090e' },
                        { id: 'forest', name: 'Silent Forest', color: '#10b981', bg: '#050a06' },
                        { id: 'lavender', name: 'Dark Lavender', color: '#8b5cf6', bg: '#0a060e' }
                      ].map(theme => (
                        <div 
                          key={theme.id}
                          onClick={() => setCurrentTheme(theme.id as any)}
                          style={{ 
                            padding: '1.25rem', borderRadius: '1.25rem', cursor: 'pointer',
                            background: theme.bg, border: `2px solid ${currentTheme === theme.id ? theme.color : 'var(--border-light)'}`,
                            transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: theme.color, border: '2px solid rgba(255,255,255,0.1)' }}></div>
                            <span style={{ fontWeight: 600, color: '#fff' }}>{theme.name}</span>
                          </div>
                          {currentTheme === theme.id && (
                            <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: theme.color }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{width: '1rem', height: '1rem'}}><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSettings(false)} className="submit-btn" style={{ minWidth: '120px' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Context Menus */}
      {contextMenu && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="context-menu-item"
            onClick={() => {
              const chat = chats.find(c => c.id === contextMenu.chatId);
              setRenameModal({ chatId: contextMenu.chatId, title: chat?.title || "" });
              setContextMenu(null);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '16px', height: '16px'}}><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            Rename
          </button>
          <button 
            className="context-menu-item"
            onClick={() => {
              togglePinChat(contextMenu.chatId);
              setContextMenu(null);
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{width: '16px', height: '16px'}}>
              <path d="M16 11V5.5a4 4 0 00-8 0V11l-2 3v1h5.5v5h1v-5H18v-1l-2-3zm-6-5.5a (2 2 0 014 0V11H10V5.5z"></path>
            </svg>
            Pin / Unpin
          </button>
          <button 
            className="context-menu-item danger"
            onClick={() => {
              setDeleteModalId(contextMenu.chatId);
              setContextMenu(null);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '16px', height: '16px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete
          </button>
        </div>
      )}

      {/* Custom Modals for Rename and Delete */}
      {renameModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setRenameModal(null)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Rename Chat</h2>
              <button onClick={() => setRenameModal(null)} className="modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width: '14px', height: '14px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="form-group">
              <input 
                type="text" 
                value={renameModal.title}
                onChange={(e) => setRenameModal({ ...renameModal, title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameModal.title.trim()) {
                    renameChat(renameModal.chatId, renameModal.title.trim());
                    setRenameModal(null);
                  }
                }}
                placeholder="Enter new chat name..."
                className="form-input"
                autoFocus
              />
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={() => setRenameModal(null)} className="submit-btn" style={{ background: 'var(--bg-surface-elevated)', boxShadow: 'none' }}>
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (renameModal.title.trim()) {
                    renameChat(renameModal.chatId, renameModal.title.trim());
                    setRenameModal(null);
                  }
                }} 
                className="submit-btn"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalId && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteModalId(null)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Delete Chat</h2>
              <button onClick={() => setDeleteModalId(null)} className="modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width: '14px', height: '14px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Are you sure you want to permanently delete this chat? This action cannot be undone.
            </p>
            <div className="modal-footer" style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setDeleteModalId(null)} className="submit-btn" style={{ background: 'var(--bg-surface-elevated)', boxShadow: 'none' }}>
                Cancel
              </button>
              <button 
                onClick={() => {
                  deleteChat(deleteModalId);
                  setDeleteModalId(null);
                }} 
                className="submit-btn"
                style={{ background: '#ef4444', boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteAllConfirm && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowDeleteAllConfirm(false)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Delete All Chats</h2>
              <button onClick={() => setShowDeleteAllConfirm(false)} className="modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width: '14px', height: '14px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Are you sure you want to delete ALL chats? This action cannot be undone.
            </p>
            <div className="modal-footer" style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowDeleteAllConfirm(false)} className="submit-btn" style={{ background: 'var(--bg-surface-elevated)', boxShadow: 'none' }}>
                Cancel
              </button>
              <button 
                onClick={() => {
                  deleteAllChats();
                  setShowDeleteAllConfirm(false);
                  setShowSettings(false);
                }} 
                className="submit-btn"
                style={{ background: '#ef4444', boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Pico Modal (Hidden)
      {deletePicoId && (
        ...
      )}
      */}
      {/* Email Detail Modal */}
      {(selectedEmail || isFetchingEmail) && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div className="modal-backdrop" onClick={() => setSelectedEmail(null)}></div>
          <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
            {isFetchingEmail ? (
              <div style={{ padding: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div className="typing-dot" style={{ width: '12px', height: '12px' }}></div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Fetching full email content...</span>
              </div>
            ) : selectedEmail && (
              <>
                <div className="modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                    <h2 className="modal-title" style={{ fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedEmail.subject}</h2>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--accent-glow)' }}>From: {selectedEmail.from}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(selectedEmail.date).toLocaleString()}</div>
                  </div>
                  <button onClick={() => setSelectedEmail(null)} className="modal-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width: '14px', height: '14px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', background: selectedEmail.isHtml ? '#ffffff' : 'transparent', color: selectedEmail.isHtml ? '#000000' : 'var(--text-primary)' }}>
                  {selectedEmail.isHtml ? (
                    <iframe 
                      srcDoc={selectedEmail.htmlBody}
                      style={{ width: '100%', height: '100%', border: 'none', background: '#ffffff', display: 'block' }}
                      sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts"
                      title="Email Content"
                    />
                  ) : (
                    <div style={{ padding: '1.5rem', fontSize: '0.9375rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {selectedEmail.textBody || selectedEmail.body || selectedEmail.snippet}
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    className="submit-btn" 
                    style={{ width: 'auto', padding: '0.5rem 1.5rem', background: 'var(--bg-surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                    onClick={() => setSelectedEmail(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Hidden SVG Filter for Logo Background Removal */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="remove-white">
          <feColorMatrix type="matrix" values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            -1.5 -1.5 -1.5 4.5 0
          " />
        </filter>
      </svg>
    </div>
  );
}
