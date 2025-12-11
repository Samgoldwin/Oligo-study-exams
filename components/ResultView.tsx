import React, { useState } from 'react';
import { StudyPlan, TopicModule } from '../types';
import { CheckCircle2, BarChart3, AlertCircle, Bookmark, ArrowRight, Download, List, Layers } from 'lucide-react';
import { jsPDF } from "jspdf";

interface ResultViewProps {
  plan: StudyPlan;
  onReset: () => void;
}

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors = {
    High: "bg-red-100 text-red-700 border-red-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Low: "bg-green-100 text-green-700 border-green-200"
  };
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[priority as keyof typeof colors] || colors.Low}`}>
      {priority} Priority
    </span>
  );
};

const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
   const colors = {
    Hard: "text-red-600 bg-red-50",
    Medium: "text-yellow-600 bg-yellow-50",
    Easy: "text-green-600 bg-green-50"
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[difficulty as keyof typeof colors] || colors.Easy}`}>
      {difficulty}
    </span>
  );
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
    <div className="animate-fade-in space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <h1 className="text-2xl font-bold text-slate-900">Analysis Results</h1>
         <div className="flex gap-3">
            <button 
              onClick={downloadPDF}
              className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
            >
               <Download className="w-4 h-4 mr-2" />
               Download PDF
            </button>
            <button 
              onClick={onReset}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
            >
               New Analysis
            </button>
         </div>
      </div>

      {/* Summary Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-100 rounded-xl shrink-0">
            <BarChart3 className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Executive Summary</h2>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base">{plan.summary}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'questions' 
              ? 'border-primary-600 text-primary-700 bg-primary-50/50' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <List className="w-4 h-4 mr-2" />
          All Questions ({plan.extractedQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab('topics')}
          className={`flex items-center px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'topics' 
              ? 'border-primary-600 text-primary-700 bg-primary-50/50' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4 mr-2" />
          Topics to Complete
        </button>
      </div>

      {/* Tab Content: All Questions */}
      {activeTab === 'questions' && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
           <div className="space-y-4">
              {plan.extractedQuestions.map((q, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-primary-100 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start gap-4">
                     <div className="flex gap-3">
                        <span className="text-slate-400 font-mono text-sm mt-0.5">#{idx + 1}</span>
                        <p className="text-slate-800 font-medium">{q.text}</p>
                     </div>
                     <div className="flex flex-col items-end gap-2 shrink-0">
                        {q.marks && (
                           <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-1 rounded">
                             {q.marks} Marks
                           </span>
                        )}
                        <DifficultyBadge difficulty={q.difficulty} />
                     </div>
                  </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Tab Content: Study Plan / Topics */}
      {activeTab === 'topics' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          {/* Topics List Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {plan.modules.map((module, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveModuleIndex(idx)}
                  className={`w-full text-left p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors flex items-center justify-between group ${
                    activeModuleIndex === idx ? 'bg-primary-50 hover:bg-primary-50' : ''
                  }`}
                >
                  <div>
                    <div className={`font-medium mb-1 ${activeModuleIndex === idx ? 'text-primary-700' : 'text-slate-700'}`}>
                      {module.topicName}
                    </div>
                    <PriorityBadge priority={module.priority} />
                  </div>
                  <ArrowRight className={`w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform ${activeModuleIndex === idx ? 'text-primary-400' : ''}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Module Detail Content */}
          <div className="lg:col-span-2">
            {activeModule && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                       <h2 className="text-2xl font-bold text-slate-900 mb-2">{activeModule.topicName}</h2>
                       <p className="text-slate-600">{activeModule.description}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <Bookmark className="w-5 h-5 mr-2 text-primary-500" />
                    Relevant Questions
                  </h3>
                  
                  <div className="space-y-4">
                    {activeModule.questions.map((q, qIdx) => (
                      <div key={qIdx} className="p-4 rounded-xl border border-slate-200 bg-white">
                        <p className="text-slate-800 font-medium mb-2">{q.text}</p>
                        <div className="flex items-center gap-3">
                          <DifficultyBadge difficulty={q.difficulty} />
                          {q.marks && <span className="text-xs text-slate-500">{q.marks} Marks</span>}
                        </div>
                      </div>
                    ))}
                    {activeModule.questions.length === 0 && (
                       <div className="text-slate-400 italic">No specific questions listed for this topic.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};