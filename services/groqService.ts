import { StudyPlan } from '../types';


interface AIService {
  name: string;
  generateStudyPlan(syllabus: string, files: File[]): Promise<StudyPlan>;
}

const MAX_TOTAL_CHARS = 30000;
const MAX_PER_FILE_CHARS = 12000;

const groqService: AIService = {
  name: 'Groq AI',

  async generateStudyPlan(syllabus: string, files: File[]): Promise<StudyPlan> {
    // PDFs are text-extracted in the browser — the text model cannot read
    // base64 attachments, and raw file payloads stay out of the request body.
    // pdfjs is dynamically imported so it stays out of the main bundle.
    const { extractPdfText, PdfExtractionError } = await import('./pdfService');
    const fileData: Array<{ name: string; text: string }> = [];
    let budget = MAX_TOTAL_CHARS;

    for (const file of files) {
      if (budget <= 0) break;
      try {
        const extracted = await extractPdfText(file);
        const text = extracted.pages.join('\n').slice(0, Math.min(MAX_PER_FILE_CHARS, budget));
        budget -= text.length;
        fileData.push({ name: file.name, text });
      } catch (err) {
        if (err instanceof PdfExtractionError) {
          throw err;
        }
        throw new Error(`"${file.name}" could not be processed.`);
      }
    }

    if (budget <= 0) {
      console.warn('Syllabus analyzer input was truncated to stay within model limits.');
    }

    let response: Response;
    try {
      response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabus, files: fileData }),
      });
    } catch (err) {
      console.error('Analyze network error:', err);
      throw new Error('Network error while contacting the analysis service. Please check your connection and try again.');
    }

    if (!response.ok) {
      let message = `Analysis failed (HTTP ${response.status}).`;
      try {
        const body = await response.json();
        if (body?.message) message = body.message;
      } catch {
        /* keep default */
      }
      throw new Error(message);
    }

    return (await response.json()) as StudyPlan;
  },
};

export { groqService as aiService };
