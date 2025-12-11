import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { StudyPlan, AIProvider } from "../types";

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: {
      type: Type.STRING,
      description: "The name of the subject or exam inferred from the syllabus (e.g., 'Physics', 'Constitutional Law', 'Data Structures')."
    },
    summary: {
      type: Type.STRING,
      description: "A brief executive summary of the analysis, highlighting the most crucial areas to focus on."
    },
    extractedQuestions: {
      type: Type.ARRAY,
      description: "A consolidated list of all questions found in the papers.",
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          marks: { type: Type.NUMBER, description: "Marks for the question if available" },
          difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
          yearAppeared: { type: Type.STRING, description: "Year found in document if applicable" },
          reference: { type: Type.STRING, description: "Specific location in the doc (e.g. 'Page 2, Q4' or 'Section B')" }
        }
      }
    },
    modules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topicName: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
          description: { type: Type.STRING, description: "Why this topic is important based on previous papers." },
          questions: {
            type: Type.ARRAY,
            description: "Questions specifically related to this topic",
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                marks: { type: Type.NUMBER },
                difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
                yearAppeared: { type: Type.STRING },
                reference: { type: Type.STRING }
              }
            }
          }
        },
        required: ["topicName", "priority", "description", "questions"]
      }
    }
  },
  required: ["subject", "summary", "extractedQuestions", "modules"]
};

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Retry helper for API calls
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Retry on 503 (Service Unavailable) or 429 (Too Many Requests)
    if (retries > 0 && (error.status === 503 || error.status === 429)) {
      console.warn(`API call failed with ${error.status}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

export class GeminiService implements AIProvider {
  name = "Google Gemini 2.5";
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateStudyPlan(syllabus: string, files: File[]): Promise<StudyPlan> {
    try {
      // 1. Convert files to base64
      const fileParts = await Promise.all(files.map(fileToGenerativePart));

      const prompt = `
        You are an expert exam strategist. 
        
        Here is the syllabus for an upcoming exam:
        "${syllabus}"
        
        Attached are files containing previous year question papers.
        
        Your task:
        1. Identify the 'subject' of the exam.
        2. Extract ALL distinct questions verbatim found in the attached papers into a single consolidated list. 
           - Estimate difficulty and marks if not explicitly stated.
           - Identify the 'reference' for each question (e.g., "Page 1, Q2", "2023 Paper Section B", "Q5.a").
        3. Analyze these questions against the syllabus to identify topics.
        4. Create a "Study Plan" by grouping these topics into modules. 
           - Ensure EVERY extracted question is assigned to a relevant module.
        5. Assign a priority (High/Medium/Low) to each topic based on frequency.
        6. Provide a summary of the analysis.
      `;

      // 2. Call API with Retry Logic
      const response = await retryOperation<GenerateContentResponse>(() => 
        this.ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              { text: prompt },
              ...fileParts
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2, // Low temperature for factual extraction
          }
        })
      );

      if (!response.text) {
        throw new Error("No response text received from AI provider.");
      }

      return JSON.parse(response.text) as StudyPlan;
    } catch (error) {
      console.error("Error generating study plan:", error);
      // Re-throw with a user-friendly message if possible, or let the UI handle generic errors
      throw error;
    }
  }
}

// Export a singleton or factory
export const aiService = new GeminiService();