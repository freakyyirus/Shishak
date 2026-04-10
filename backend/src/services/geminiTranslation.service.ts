import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';

const GEMINI_MODEL = 'gemini-2.5-flash';

export class GeminiTranslationService {
  private ai: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured. Set it in environment variables.');
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  async translate(text: string, sourceFormat: string, targetLanguage: string): Promise<string> {
    try {
      const client = this.getClient();
      const prompt = `You are a professional educational translator. Translate the following text from English to ${targetLanguage}. Maintain all educational context, tone, formatting, and mathematical equations. Only return the translated text without any conversational preamble.

Text to translate:
"""
${text}
"""`;

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        }
      });

      return response.text || '';
    } catch (error) {
      console.error('Gemini translation error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Translation failed'
      );
    }
  }
}

export const geminiTranslationService = new GeminiTranslationService();
