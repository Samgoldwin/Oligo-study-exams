import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyPlan } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
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
          yearAppeared: { type: Type.STRING, description: "Year found in document if applicable" }
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
                yearAppeared: { type: Type.STRING }
              }
            }
          }
        },
        required: ["topicName", "priority", "description", "questions"]
      }
    }
  },
  required: ["summary", "extractedQuestions", "modules"]
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

export const generateStudyPlan = async (
  syllabus: string,
  files: File[]
): Promise<StudyPlan> => {
  try {
    const fileParts = await Promise.all(files.map(fileToGenerativePart));

    const prompt = `
      You are an expert exam strategist. 
      
      Here is the syllabus for an upcoming exam:
      "${syllabus}"
      
      Attached are files containing previous year question papers.
      
      Your task:
      1. First, extract ALL distinct questions verbatim found in the attached papers into a single consolidated list. Estimate difficulty and marks if not explicitly stated.
      2. Analyze these questions against the syllabus to identify topics.
      3. Create a "Study Plan" by grouping these topics into modules.
      4. Assign a priority (High/Medium/Low) to each topic based on frequency.
      5. Provide a summary of the analysis.
    `;

    const response = await ai.models.generateContent({
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
        temperature: 0.2, 
      }
    });

    if (!response.text) {
      throw new Error("No response received from Gemini");
    }

    return JSON.parse(response.text) as StudyPlan;
  } catch (error) {
    console.error("Error generating study plan:", error);
    throw error;
  }
};