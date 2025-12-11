import React from 'react';
import { Sparkles, FileText, BookOpen } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="bg-white border-b border-slate-200 py-12 px-6 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center p-2 bg-primary-50 rounded-full mb-4">
            <Sparkles className="w-5 h-5 text-primary-600 mr-2" />
            <span className="text-primary-700 font-medium text-sm">Powered by Gemini 2.5 Flash</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl mb-4">
            Transform Past Papers into <br className="hidden sm:block" />
            <span className="text-primary-600">Smart Question Banks</span>
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Upload your previous year question papers and syllabus. We'll analyze trends, identify high-yield topics, and generate a tailored study plan just for you.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-slate-500">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                <FileText className="w-4 h-4 text-slate-600" />
              </div>
              Upload Papers (PDF/Img)
            </div>
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                <BookOpen className="w-4 h-4 text-slate-600" />
              </div>
              Paste Syllabus
            </div>
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                <Sparkles className="w-4 h-4 text-primary-600" />
              </div>
              Get Study Plan
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};