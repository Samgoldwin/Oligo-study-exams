import { Groq } from 'groq-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { syllabus, files } = req.body;

    if (!syllabus || !files || files.length === 0) {
      return res.status(400).json({ error: 'Missing syllabus or files' });
    }

    const fileContents = files
      .map((f: any) => `[File: ${f.name}]\n${f.data}`)
      .join('\n\n');

    const prompt = `You are an expert educational advisor. Analyze the following syllabus and previous year question papers to create a comprehensive study plan.

SYLLABUS:
${syllabus}

QUESTION PAPERS:
${fileContents}

Please provide a detailed JSON response with:
1. keyTopics: array of important topics from syllabus
2. questionsByTopic: object mapping topics to extracted questions
3. studySchedule: array of daily/weekly study recommendations
4. focusAreas: array of areas needing extra attention
5. estimatedHours: total estimated study hours needed

Format as valid JSON only.`;

    const message = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.choices[0].message.content || '';
    const studyPlan = JSON.parse(responseText);

    return res.status(200).json(studyPlan);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Failed to analyze documents' });
  }
}