import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';

const GEMINI_MODEL = 'gemini-2.5-flash';

interface GeminiStitchStreamChunk {
  type: 'thinking' | 'response' | 'complete' | 'error';
  content?: string;
  thinkingText?: string;
  error?: string;
}

/**
 * Gemini Stitch Service - Cloud API for content generation
 * Uses Gemini 2.5 Flash for blistering fast responses
 */
export class GeminiStitchService {
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

  /**
   * Check if Gemini API is available
   */
  async checkConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: 'test',
        config: { maxOutputTokens: 5 }
      });
      return true;
    } catch (error) {
      console.error('Gemini connection check failed:', error);
      return false;
    }
  }

  /**
   * Generate content with streaming support
   */
  async *generateStream(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<GeminiStitchStreamChunk, void, unknown> {
    try {
      const client = this.getClient();
      const systemInstruction = 'You are an expert Indian educator specializing in NCERT, CBSE, and State Board curricula. You have FULL CAPABILITY to include complex mathematical equations, expressions, scientific notation, chemical formulas, and advanced mathematical symbols. Generate comprehensive, well-structured educational content in perfect markdown format. FREELY use mathematical notation, equations, and expressions when appropriate.';

      const responseStream = await client.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 4096,
        }
      });

      let accumulatedContent = '';

      for await (const chunk of responseStream) {
        if (chunk.text) {
          accumulatedContent += chunk.text;
          yield {
            type: 'response',
            content: chunk.text,
          };
        }
      }

      // Send completion
      yield {
        type: 'complete',
        content: accumulatedContent,
        thinkingText: '', 
      };
    } catch (error) {
      console.error('Gemini stream generation error:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Content generation failed',
      };
    }
  }

  /**
   * Generate content without streaming
   */
  async generateTextContent(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    try {
      const client = this.getClient();
      const systemInstruction = 'You are an expert Indian educator specializing in NCERT, CBSE, and State Board curricula. You have FULL CAPABILITY to include complex mathematical equations, expressions, scientific notation, chemical formulas, and advanced mathematical symbols. Generate comprehensive, well-structured educational content in perfect markdown format. FREELY use mathematical notation, equations, and expressions when appropriate.';

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 4096,
        }
      });

      return response.text || '';
    } catch (error) {
      console.error('Gemini text generation error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Content generation failed'
      );
    }
  }
}

export const geminiStitchService = new GeminiStitchService();
