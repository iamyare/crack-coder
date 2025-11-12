import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { z } from 'zod';

dotenv.config();

let apiKey: string | null = null;
let language = process.env.LANGUAGE || "Python";

interface Config {
  apiKey: string;
  language: string;
}

function updateConfig(config: Config) {
  if (!config.apiKey) {
    throw new Error('Gemini API key is required');
  }

  try {
    apiKey = config.apiKey.trim();
    language = config.language || 'Python';
    // console.log('Gemini client initialized with new config');
  } catch (error) {
    console.error('Error initializing Gemini client:', error);
    throw error;
  }
}

// Initialize with environment variables if available
if (process.env.GEMINI_API_KEY) {
  try {
    updateConfig({
      apiKey: process.env.GEMINI_API_KEY,
      language: process.env.LANGUAGE || 'Python'
    });
  } catch (error) {
    console.error('Error initializing Gemini with environment variables:', error);
  }
}

interface ProcessedSolution {
  approach: string;
  code: string;
  timeComplexity: string;
  spaceComplexity: string;
}

// Schema para validar la respuesta
const solutionSchema = z.object({
  approach: z.string().describe('Detailed approach to solve the problem on how are we solving the problem, that the interviewee will speak out loud and in easy explainatory words'),
  code: z.string().describe('The complete solution code'),
  timeComplexity: z.string().describe('Big O analysis of time complexity with the reason'),
  spaceComplexity: z.string().describe('Big O analysis of space complexity with the reason')
});

export async function processScreenshots(screenshots: { path: string }[]): Promise<ProcessedSolution> {
  if (!apiKey) {
    throw new Error('Gemini client not initialized. Please configure API key first. Click CTRL/CMD + P to open settings and set the API key.');
  }

  try {
    // Preparar el contenido con las imágenes
    const imagePromises = screenshots.map(async (screenshot) => {
      const imageBuffer = await fs.readFile(screenshot.path);
      const base64Image = imageBuffer.toString('base64');
      return {
        type: 'image' as const,
        image: base64Image
      };
    });

    const images = await Promise.all(imagePromises);

    // Crear el modelo Gemini con la API key
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
    const model = google('gemini-2.5-flash');

    const systemPrompt = `You are an expert coding interview assistant. Analyze the coding question from the screenshots and provide a solution in ${language}.`;

    const userPrompt = 'Here is a coding interview question. Please analyze and provide a solution with: 1) A detailed approach to solve the problem that the interviewee will speak out loud in easy explanatory words, 2) The complete solution code, 3) Big O analysis of time complexity with the reason, 4) Big O analysis of space complexity with the reason.';

    // Generar la respuesta estructurada con Gemini
    const { object } = await generateObject({
      model: model,
      schema: solutionSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'text', text: userPrompt },
            ...images
          ]
        }
      ],
      temperature: 0.7,
    });

    return object as ProcessedSolution;
  } catch (error) {
    console.error('Error processing screenshots:', error);
    throw error;
  }
}

export default {
  processScreenshots,
  updateConfig
};
