import { StudyPlan } from '../types';

interface AIService {
  name: string;
  generateStudyPlan(syllabus: string, files: File[]): Promise<StudyPlan>;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

const groqService: AIService = {
  name: 'Groq AI',

  async generateStudyPlan(syllabus: string, files: File[]): Promise<StudyPlan> {
    try {
      // Convert files to base64
      const fileData = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type,
          data: await fileToBase64(file),
        }))
      );

      // Call backend API (Vercel serverless function)
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syllabus,
          files: fileData,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Groq service error:', error);
      throw error;
    }
  },
};

export { groqService as aiService };