"use client";

import React, { useState } from 'react';
import { useAgent, Task, TaskPlan } from '@/context/AgentContext';
import { openLink } from '@/lib/api';

export const TaskBoard: React.FC<{ plan?: TaskPlan | null }> = ({ plan }) => {
  const { currentPlan: activePlan } = useAgent();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  
  const displayPlan = plan !== undefined ? plan : activePlan;

  if (!displayPlan) return null;

  const getComplexityColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return '#fbbf24';
      default: return '#22c55e';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'executing':
        return (
          <div className="spinning" style={{ width: '16px', height: '16px', border: '2px solid var(--accent-base)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
        );
      case 'completed':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" style={{ width: '16px', height: '16px' }}>
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      case 'failed':
        return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</span>;
      default:
        return <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--border-light)' }}></div>;
    }
  };

  const renderTaskDetails = (task: Task) => {
    if (!task.result) return <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0.5rem 0' }}>No detailed data available.</p>;

    const res = task.result;

    if (typeof res === 'string') {
       return <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{res}</div>;
    }

    switch (res.type) {
      case 'search':
        return (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <strong>Query:</strong> {res.query}
            </div>
            {res.results?.map((hit: any, i: number) => (
              <div key={i} style={{ background: 'var(--bg-deep)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                <a 
                  href={hit.url} 
                  onClick={(e) => { e.preventDefault(); openLink(hit.url); }}
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ fontSize: '0.8rem', color: 'var(--accent-glow)', textDecoration: 'none', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}
                >
                  {hit.title}
                </a>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{hit.content}</p>
              </div>
            ))}
          </div>
        );
      case 'gmail':
        return (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <strong>Filters applied:</strong> "{res.query}"
            </div>
            {res.emails?.map((email: any, i: number) => (
              <div key={i} style={{ background: 'var(--bg-deep)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{email.from}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{new Date(email.date).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>{email.subject}</div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{email.snippet}</p>
              </div>
            ))}
            {(!res.emails || res.emails.length === 0) && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>No matching emails found.</p>}
          </div>
        );
      case 'memory':
        return (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}><strong>Search query:</strong> {res.query}</div>
             {res.memories?.map((m: any, i: number) => (
               <div key={i} style={{ background: 'var(--bg-deep)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                 {m.content}
               </div>
             ))}
          </div>
        );
      case 'files':
        return (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             {res.files?.map((f: any, i: number) => (
               <div key={i} style={{ background: 'var(--bg-deep)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                 <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>{f.name}</div>
                 <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{f.snippet}..."</p>
               </div>
             ))}
          </div>
        );
      default:
        return <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '0.75rem', borderRadius: '0.5rem', marginTop: '0.5rem' }}>{JSON.stringify(res)}</div>;
    }
  };

  return (
    <div className="fade-in" style={{ 
      background: 'var(--bg-surface-elevated)', 
      border: '1px solid var(--border-light)', 
      borderRadius: '1.25rem', 
      padding: '1.5rem', 
      marginBottom: '1.5rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      maxWidth: '650px',
      width: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ width: '2.5rem', height: '2.5rem', background: 'var(--accent-gradient)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px var(--accent-glow)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: '1.5rem', height: '1.5rem' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Execution Plan</h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Autonomous Agent Mode Active</p>
        </div>
        <button 
          onClick={() => setShowTrace(!showTrace)}
          style={{ 
            padding: '4px 10px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
            background: showTrace ? 'var(--accent-base)' : 'var(--bg-surface-elevated)',
            color: showTrace ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px'
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '10px', height: '10px' }}><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          Trace
        </button>
      </div>

      {displayPlan.strategy && (
        <div style={{ 
          background: 'var(--bg-deep)', 
          border: '1px solid var(--border-light)', 
          borderRadius: '1rem', 
          padding: '1rem', 
          marginBottom: '1.25rem',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {displayPlan.strategy.agents?.map((agent, idx) => (
                <span key={idx} style={{ 
                  fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', 
                  color: 'var(--text-secondary)', background: 'var(--bg-surface-elevated)', 
                  padding: '2px 8px', borderRadius: '100px', border: '1px solid var(--border-light)',
                  letterSpacing: '0.02em'
                }}>
                  {agent}
                </span>
              ))}
            </div>
            <div style={{ 
              fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', 
              color: getComplexityColor(displayPlan.strategy.complexity),
              background: `${getComplexityColor(displayPlan.strategy.complexity)}15`,
              padding: '2px 10px', borderRadius: '100px',
              border: `1px solid ${getComplexityColor(displayPlan.strategy.complexity)}40`
            }}>
              {displayPlan.strategy.complexity || 'LOW'} Complexity
            </div>
          </div>
          <div style={{ 
            fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic'
          }}>
            <span style={{ fontWeight: 800, color: 'var(--accent-base)', marginRight: '0.5rem', fontStyle: 'normal' }}>STRATEGY:</span>
            {displayPlan.strategy.reason}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {displayPlan.tasks.map((task, i) => {
          const isExpanded = expandedTaskId === task.id;
          const isFinished = task.status === 'completed' || task.status === 'failed';

          return (
            <div key={task.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div 
                onClick={() => isFinished && setExpandedTaskId(isExpanded ? null : task.id)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '1rem', 
                  padding: '0.85rem 1rem',
                  borderRadius: '0.85rem',
                  background: isExpanded ? 'var(--bg-deep)' : 'transparent',
                  cursor: isFinished ? 'pointer' : 'default',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: task.status === 'pending' ? 0.4 : 1,
                  border: isExpanded ? '1px solid var(--border-light)' : '1px solid transparent'
                }}
                className={isFinished ? 'task-row-hover' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px' }}>
                  {getStatusIcon(task.status)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: task.status === 'executing' ? 700 : 500, 
                    color: task.status === 'executing' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    lineHeight: 1.4
                  }}>
                    {task.description}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {task.auditScore !== undefined && (
                    <div style={{ 
                      fontSize: '0.65rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '3px',
                      color: task.auditScore >= 8 ? '#22c55e' : '#ef4444',
                      background: `${task.auditScore >= 8 ? '#22c55e' : '#ef4444'}15`,
                      padding: '3px 8px', borderRadius: '100px',
                      border: `1px solid ${task.auditScore >= 8 ? '#22c55e' : '#ef4444'}30`
                    }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '10px', height: '10px' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      {task.auditScore}/10
                    </div>
                  )}
                  {task.agentRole && (
                    <div style={{ 
                      fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', 
                      color: task.agentRole === 'reviewer' ? '#fbbf24' : 'var(--accent-base)', 
                      background: `${task.agentRole === 'reviewer' ? '#fbbf24' : 'var(--accent-base)'}15`, 
                      padding: '2px 6px', borderRadius: '4px',
                      letterSpacing: '0.05em',
                      border: `1px solid ${task.agentRole === 'reviewer' ? '#fbbf24' : 'var(--accent-glow)'}30`
                    }}>
                      {task.agentRole}
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', 
                    color: 'var(--text-tertiary)', background: 'var(--bg-surface)', 
                    padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-light)',
                    letterSpacing: '0.05em'
                  }}>
                    {task.tool}
                  </div>
                  {isFinished && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ 
                      width: '12px', height: '12px', color: 'var(--text-tertiary)',
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.3s'
                    }}>
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ 
                  padding: '0 1rem 1rem 3rem',
                  animation: 'slideDown 0.3s ease-out'
                }}>
                  {renderTaskDetails(task)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showTrace && displayPlan.logs && (
        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1rem', 
          background: '#0a0a0a', 
          borderRadius: '0.75rem', 
          border: '1px solid var(--border-light)',
          fontFamily: 'JetBrains Mono, monospace',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: '0.75rem', fontWeight: 800, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
            <span>System Execution Trace</span>
            <span>Live Output</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {displayPlan.logs.map((log, idx) => (
              <div key={idx} style={{ fontSize: '0.75rem', color: '#d1d1d1', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--accent-base)', marginRight: '8px' }}>›</span>
                {log}
              </div>
            ))}
            {displayPlan.logs.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: '#444' }}>No trace logs available yet.</div>
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .task-row-hover:hover {
          background: rgba(255, 255, 255, 0.03) !important;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
