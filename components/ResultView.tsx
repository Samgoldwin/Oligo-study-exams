import React, { useState } from 'react';
import { StudyPlan } from '../types';
import { BarChart3, Bookmark, ArrowRight, Download, List, Layers, MapPin, ArrowUpDown } from 'lucide-react';
import { jsPDF } from "jspdf";

interface ResultViewProps {
  plan: StudyPlan;
  onReset: () => void;
}

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const className = `badge badge-priority-${priority.toLowerCase()}`;
  return <span className={className}>{priority} Priority</span>;
};

const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const className = `badge badge-diff-${difficulty.toLowerCase()}`;
  return <span className={className}>{difficulty}</span>;
}

export const ResultView: React.FC<ResultViewProps> = ({ plan, onReset }) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'topics'>('questions');
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'topic' | 'marks'>('topic');

  const activeModule = plan.modules[activeModuleIndex];

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title with Subject Name
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text(`${plan.subject || 'Exam'} - Question Bank & Plan`, 15, y);
    y += 10;

    // Summary
    doc.setFontSize(12);
    doc.setTextColor(60);
    const summaryLines = doc.splitTextToSize(plan.summary, pageWidth - 30);
    doc.text(summaryLines, 15, y);
    y += (summaryLines.length * 7) + 10;

    // Separator
    doc.setDrawColor(200);
    doc.line(15, y, pageWidth - 15, y);
    y += 10;

    // MODULE-WISE SECTION (Replacing the flat list and previous split sections)
    plan.modules.forEach((mod) => {
        if (y > 250) { doc.addPage(); y = 20; }
        
        // Module Header
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(`${mod.topicName}`, 15, y);
        
        const priorityWidth = doc.getTextWidth(mod.topicName);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(mod.priority === 'High' ? 185 : mod.priority === 'Medium' ? 133 : 21, mod.priority === 'High' ? 28 : mod.priority === 'Medium' ? 77 : 128, mod.priority === 'High' ? 28 : mod.priority === 'Medium' ? 14 : 61); // Simple color mapping
        doc.text(`[${mod.priority} Priority]`, 15 + priorityWidth + 5, y);
        y += 7;
        
        // Description
        doc.setFontSize(10);
        doc.setTextColor(80);
        const desc = doc.splitTextToSize(mod.description, pageWidth - 30);
        doc.text(desc, 15, y);
        y += (desc.length * 5) + 5;

        // Questions for this module
        if (mod.questions.length > 0) {
          doc.setFontSize(10);
          doc.setTextColor(0);
          
          mod.questions.forEach((q, qIdx) => {
               if (y > 270) { doc.addPage(); y = 20; }
               
               let meta = `[${q.difficulty}]`;
               if (q.marks) meta += ` (${q.marks}M)`;
               if (q.reference) meta += ` {Ref: ${q.reference}}`;
               if (q.yearAppeared) meta += ` {Year: ${q.yearAppeared}}`;
  
               const qLine = `${qIdx + 1}. ${q.text}  ${meta}`;
               const lines = doc.splitTextToSize(qLine, pageWidth - 40);
               doc.text(lines, 20, y);
               y += (lines.length * 5) + 3;
          });
        } else {
           doc.setFontSize(10);
           doc.setTextColor(150);
           doc.text("(No specific questions extracted for this module)", 20, y);
           y += 8;
        }
        y += 8;
    });

    // Create a safe filename
    const safeSubject = (plan.subject || 'QuestionBank').replace(/[^a-z0-9]/gi, '_');
    doc.save(`${safeSubject}_QuestionBank.pdf`);
  };

  const sortedQuestions = React.useMemo(() => {
    if (sortBy === 'marks') {
      return [...plan.extractedQuestions].sort((a, b) => (b.marks || 0) - (a.marks || 0));
    }
    return [];
  }, [plan.extractedQuestions, sortBy]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div className="flex flex-col md-flex-row justify-between items-center gap-4">
         <div>
            <h2>Analysis Results</h2>
            {plan.subject && <span className="text-muted text-sm font-medium">Subject: {plan.subject}</span>}
         </div>
         <div className="flex gap-4">
            <button onClick={downloadPDF} className="btn btn-dark">
               <Download size={16} style={{ marginRight: '0.5rem' }} />
               Download PDF
            </button>
            <button onClick={onReset} className="btn btn-secondary">
               New Analysis
            </button>
         </div>
      </div>

      {/* Summary Box */}
      <div className="card">
        <div className="flex gap-4">
          <div style={{ padding: '0.75rem', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-lg)', height: 'fit-content' }}>
            <BarChart3 size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>Executive Summary</h3>
            <p className="text-muted">{plan.summary}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="tab-list">
          <button
            onClick={() => setActiveTab('questions')}
            className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
          >
            <List size={16} />
            All Questions
          </button>
          <button
            onClick={() => setActiveTab('topics')}
            className={`tab-btn ${activeTab === 'topics' ? 'active' : ''}`}
          >
            <Layers size={16} />
            Topics to Complete
          </button>
        </div>

        {/* Tab Content: All Questions */}
        {activeTab === 'questions' && (
          <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
            
            <div className="flex justify-end mb-6 pb-2 border-b border-gray-200">
               <button 
                 onClick={() => setSortBy(prev => prev === 'topic' ? 'marks' : 'topic')}
                 className="btn btn-secondary"
                 style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
               >
                 <ArrowUpDown size={14} />
                 {sortBy === 'topic' ? 'Sort by Marks (High to Low)' : 'Group by Topic'}
               </button>
            </div>

            {sortBy === 'topic' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  {plan.modules.map((module, mIdx) => (
                    <div key={mIdx}>
                      <div className="flex items-center gap-4" style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                        <h3>{module.topicName}</h3>
                        <PriorityBadge priority={module.priority} />
                        <span className="text-xs text-muted" style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>
                          {module.questions.length} Questions
                        </span>
                      </div>
                      
                      {module.questions.length > 0 ? (
                        <div>
                          {module.questions.map((q, qIdx) => (
                            <div key={qIdx} className="question-item">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex gap-4" style={{ width: '100%' }}>
                                  <span className="text-muted text-sm" style={{ fontFamily: 'monospace', marginTop: '2px' }}>Q{qIdx + 1}</span>
                                  <div>
                                    <p className="font-medium">{q.text}</p>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                      {q.reference && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <MapPin size={12} />
                                          {q.reference}
                                        </span>
                                      )}
                                      {q.yearAppeared && (
                                        <span>Year: {q.yearAppeared}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', minWidth: '100px', flexShrink: 0 }}>
                                    {q.marks && (
                                      <span style={{ fontSize: '0.75rem', background: 'var(--color-bg)', padding: '0.125rem 0.5rem', borderRadius: '4px' }}>
                                        {q.marks} Marks
                                      </span>
                                    )}
                                    <DifficultyBadge difficulty={q.difficulty} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted text-sm" style={{ fontStyle: 'italic' }}>No specific questions found for this topic.</div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              // Sorted by Marks View (Flat List)
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {sortedQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="question-item">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex gap-4" style={{ width: '100%' }}>
                          <span className="text-muted text-sm" style={{ fontFamily: 'monospace', marginTop: '2px' }}>{qIdx + 1}.</span>
                          <div>
                            <p className="font-medium">{q.text}</p>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                              {q.reference && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <MapPin size={12} />
                                  {q.reference}
                                </span>
                              )}
                              {q.yearAppeared && (
                                <span>Year: {q.yearAppeared}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', minWidth: '100px', flexShrink: 0 }}>
                            {q.marks && (
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '0.25rem 0.6rem', borderRadius: '4px' }}>
                                {q.marks} Marks
                              </span>
                            )}
                            <DifficultyBadge difficulty={q.difficulty} />
                        </div>
                      </div>
                    </div>
                 ))}
                 {sortedQuestions.length === 0 && (
                    <p className="text-muted text-center py-4">No questions available to sort.</p>
                 )}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Study Plan / Topics */}
        {activeTab === 'topics' && (
          <div className="grid grid-cols-1 lg-grid-cols-3 fade-in" style={{ marginTop: '1.5rem' }}>
            {/* Topics List Sidebar */}
            <div className="lg-col-span-1">
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {plan.modules.map((module, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveModuleIndex(idx)}
                    className={`module-btn ${activeModuleIndex === idx ? 'active' : ''}`}
                  >
                    <div className="module-btn-content">
                      <div style={{ color: activeModuleIndex === idx ? 'var(--color-primary)' : 'inherit' }}>
                        {module.topicName}
                      </div>
                      <PriorityBadge priority={module.priority} />
                    </div>
                    <ArrowRight size={16} color={activeModuleIndex === idx ? 'var(--color-primary)' : 'var(--color-text-secondary)'} />
                  </button>
                ))}
              </div>
            </div>

            {/* Module Detail Content */}
            <div className="lg-col-span-2">
              {activeModule && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                    <h2 style={{ marginBottom: '0.5rem' }}>{activeModule.topicName}</h2>
                    <p className="text-muted">{activeModule.description}</p>
                  </div>
                  
                  <div style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Bookmark size={20} color="var(--color-primary)" />
                      Relevant Questions
                    </h3>
                    
                    <div>
                      {activeModule.questions.map((q, qIdx) => (
                        <div key={qIdx} className="question-item">
                          <p className="font-medium" style={{ marginBottom: '0.5rem' }}>{q.text}</p>
                          <div className="flex justify-between items-center gap-4">
                             <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                               {q.reference && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <MapPin size={14} />
                                    {q.reference}
                                  </span>
                                )}
                             </div>
                             <div className="flex items-center gap-4">
                                <DifficultyBadge difficulty={q.difficulty} />
                                {q.marks && <span className="text-sm text-muted">{q.marks} Marks</span>}
                             </div>
                          </div>
                        </div>
                      ))}
                      {activeModule.questions.length === 0 && (
                         <div className="text-muted" style={{ fontStyle: 'italic' }}>No specific questions listed for this topic.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};