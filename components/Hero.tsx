import React from 'react';
import { Sparkles, FileText, BookOpen } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="hero">
      <div className="container">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="hero-pill">
            <Sparkles size={18} style={{ marginRight: '8px' }} />
            <span>Powered by Gemini 2.5 Flash</span>
          </div>
          
          <h1 style={{ marginBottom: '1rem' }}>
            Transform Past Papers into <br />
            <span style={{ color: 'var(--color-primary)' }}>Smart Question Banks</span>
          </h1>
          
          <p className="text-lg text-muted" style={{ marginBottom: '2rem' }}>
            Upload your previous year question papers and syllabus. We'll analyze trends, identify high-yield topics, and generate a tailored study plan just for you.
          </p>
          
          <div className="hero-steps">
            <div className="step-item">
              <div className="step-icon">
                <FileText size={16} />
              </div>
              Upload Papers
            </div>
            <div style={{ width: '1px', height: '32px', background: 'var(--color-border)' }}></div>
            <div className="step-item">
              <div className="step-icon">
                <BookOpen size={16} />
              </div>
              Paste Syllabus
            </div>
            <div style={{ width: '1px', height: '32px', background: 'var(--color-border)' }}></div>
            <div className="step-item">
              <div className="step-icon" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                <Sparkles size={16} />
              </div>
              Get Study Plan
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};