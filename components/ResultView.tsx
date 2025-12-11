import React, { useState } from 'react';
import { StudyPlan } from '../types';
import { BarChart3, Bookmark, ArrowRight, Download, List, Layers } from 'lucide-react';
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

  const activeModule = plan.modules[activeModuleIndex];

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text("ExamPrep AI - Question Bank & Study Plan", 15, y);
    y += 10;

    // Summary
    doc.setFontSize(12);
    doc.setTextColor(60);
    const summaryLines = doc.splitTextToSize(plan.summary, pageWidth - 30);
    doc.text(summaryLines, 15, y);
    y += (summaryLines.length * 7) + 10;

    // ALL QUESTIONS SECTION
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("All Extracted Questions", 15, y);
    y += 10;
    
    doc.setFontSize(11);
    doc.setTextColor(50);
    
    plan.extractedQuestions.forEach((q, i) => {
        if (y > 270) { doc.addPage(); y = 20; }
        
        const qText = `${i + 1}. ${q.text} [${q.difficulty}] ${q.marks ? `(${q.marks} marks)` : ''}`;
        const lines = doc.splitTextToSize(qText, pageWidth - 30);
        doc.text(lines, 15, y);
        y += (lines.length * 6) + 4;
    });

    y += 15;
    if (y > 250) { doc.addPage(); y = 20; }

    // TOPICS SECTION
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Topic-wise Study Plan", 15, y);
    y += 10;

    plan.modules.forEach((mod) => {
        if (y > 250) { doc.addPage(); y = 20; }
        
        doc.setFontSize(13);
        doc.setTextColor(0);
        doc.text(`${mod.topicName} (${mod.priority} Priority)`, 15, y);
        y += 7;
        
        doc.setFontSize(10);
        doc.setTextColor(80);
        const desc = doc.splitTextToSize(mod.description, pageWidth - 30);
        doc.text(desc, 15, y);
        y += (desc.length * 5) + 5;

        // Topic questions
        mod.questions.forEach(q => {
             if (y > 270) { doc.addPage(); y = 20; }
             const qLine = `- ${q.text}`;
             const lines = doc.splitTextToSize(qLine, pageWidth - 40);
             doc.text(lines, 20, y);
             y += (lines.length * 5) + 2;
        });
        y += 10;
    });

    doc.save("QuestionBank_StudyPlan.pdf");
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div className="flex flex-col md-flex-row justify-between items-center gap-4">
         <h2>Analysis Results</h2>
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

        {/* Tab Content: All Questions (Module-wise) */}
        {activeTab === 'questions' && (
          <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
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
                            <div className="flex justify-between items-center gap-4">
                              <div className="flex gap-4">
                                <span className="text-muted text-sm" style={{ fontFamily: 'monospace' }}>Q{qIdx + 1}</span>
                                <p className="font-medium">{q.text}</p>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', minWidth: '100px' }}>
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
                          <div className="flex items-center gap-4">
                            <DifficultyBadge difficulty={q.difficulty} />
                            {q.marks && <span className="text-sm text-muted">{q.marks} Marks</span>}
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