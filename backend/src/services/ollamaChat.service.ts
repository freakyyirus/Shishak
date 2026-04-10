import axios from "axios";
import { SUPPORTED_LANGUAGES, LanguageCode } from "../config/constants";
import { ChatMessage, SourceCitation } from "../types";
import { RAG_CONSTANTS } from "../config/ragConstants";
import { countTokens } from "../utils/tokenCounter";
import env from "../config/env";

export class OllamaChatService {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = env.OLLAMA_URL;
    this.model = env.OLLAMA_CHAT_MODEL;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5001,
      });

      const models = response.data.models || [];
      return models.some(
        (m: any) => m.name === this.model || m.name.startsWith("deepseek-r1")
      );
    } catch (error) {
      return false;
    }
  }

  async classifyQuery(
    query: string,
    hasDocuments: boolean,
    chatHistory: ChatMessage[]
  ): Promise<{
    type: "GREETING" | "SIMPLE" | "RAG";
    reason: string;
    estimatedOutputTokens: number;
  }> {
    const queryTokens = countTokens(query);
    const trimmed = query.trim().toLowerCase();

    // Quick rejection of gibberish/non-educational queries
    if (this.isGibberish(trimmed)) {
      return {
        type: "SIMPLE",
        reason: "Invalid or gibberish query",
        estimatedOutputTokens: 50,
      };
    }

    if (queryTokens < RAG_CONSTANTS.ROUTER_THRESHOLDS.MIN_TOKENS_FOR_RAG) {
      if (RAG_CONSTANTS.GREETINGS.some((g) => trimmed.startsWith(g))) {
        return {
          type: "GREETING",
          reason: "Short greeting",
          estimatedOutputTokens: 30,
        };
      }
      if (RAG_CONSTANTS.POLITE.some((p) => trimmed.startsWith(p))) {
        return {
          type: "GREETING",
          reason: "Polite phrase",
          estimatedOutputTokens: 30,
        };
      }
    }

    const recentContext = chatHistory
      .slice(-3)
      .map((m) => `${m.role}: ${m.content.substring(0, 100)}`)
      .join("\n");

    const prompt = `You are a query classifier for an educational AI assistant.

TASK: Classify this user query and determine appropriate response length.

USER QUERY: "${query}"

CONTEXT:
- Documents available: ${hasDocuments ? "YES" : "NO"}
${recentContext ? `- Recent conversation:\n${recentContext}\n` : ""}

CLASSIFICATION RULES:

1. GREETING - Simple social interactions (30-50 tokens needed)
   - Examples: "hi", "hello", "thanks", "bye", "thank you"
   - Response: Brief acknowledgment

2. SIMPLE - Non-document queries or invalid content (50-150 tokens needed)
   - Examples: "help me", "how to use", "what can you do"
   - Invalid queries: gibberish, random characters, non-educational
   - Response: Brief help message or rejection

3. RAG - Educational questions requiring document knowledge (1000-15000 tokens)
   - ALWAYS classify as RAG if:
     * Query asks to explain/describe/analyze educational concepts
     * Query contains subject matter (math, science, history, etc.)
     * Query requests detailed information or examples
     * Query is about learning/understanding a topic
   - Token allocation based on complexity:
     * Simple definition/concept: 1000-2000 tokens
     * Moderate explanation with examples: 3000-5000 tokens  
     * Detailed analysis/multiple concepts: 8000-12000 tokens
     * Comprehensive deep-dive: 15000+ tokens

IMPORTANT:
- Educational queries should ALWAYS be RAG type, never SIMPLE
- If query mentions "explain", "understand", "learn", "study" → RAG
- If query contains academic/educational content → RAG
- Only mark as SIMPLE if truly non-educational or invalid
- DO NOT INCLUDE ANY REASONING OR EXTRA TEXT. JUST THE JSON.

OUTPUT FORMAT (JSON only, no other text):
{"type": "GREETING|SIMPLE|RAG", "reason": "brief explanation", "outputTokens": number}`;

    try {
      const cloudKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
      if (cloudKey) {
        // Use cloud for faster classification
        const response = await axios.post(
          "https://api.cerebras.ai/v1/chat/completions",
          {
            model: "llama3.1-8b",
            messages: [{ role: "user", content: prompt }],
            temperature: RAG_CONSTANTS.TEMP_ROUTER,
            max_tokens: 150,
            response_format: { type: "json_object" },
          },
          { headers: { Authorization: `Bearer ${cloudKey}` }, timeout: 15000 }
        );

        const rawResponse = response.data.choices[0]?.message?.content || "";
        const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const validTypes = ["GREETING", "SIMPLE", "RAG"];
          const type = validTypes.includes(parsed.type?.toUpperCase())
            ? parsed.type.toUpperCase()
            : "RAG";

          const estimatedTokens =
            parsed.outputTokens || this.estimateOutputTokens(queryTokens, type);

          return {
            type: type as "GREETING" | "SIMPLE" | "RAG",
            reason: parsed.reason || "Cloud classified",
            estimatedOutputTokens: estimatedTokens,
          };
        }
      }

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: RAG_CONSTANTS.TEMP_ROUTER,
            num_predict: 150,
          },
        },
        { timeout: 30000 }
      );

      const rawResponse = response.data.response || "";
      const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const validTypes = ["GREETING", "SIMPLE", "RAG"];
          const type = validTypes.includes(parsed.type?.toUpperCase())
            ? parsed.type.toUpperCase()
            : "RAG";

          // Use AI's estimated output tokens, with fallback based on query length
          const estimatedTokens =
            parsed.outputTokens || this.estimateOutputTokens(queryTokens, type);

          return {
            type: type as "GREETING" | "SIMPLE" | "RAG",
            reason: parsed.reason || "AI classified",
            estimatedOutputTokens: estimatedTokens,
          };
        } catch (parseError) { }
      }

      return {
        type: "RAG",
        reason: "Default to document search",
        estimatedOutputTokens: this.estimateOutputTokens(queryTokens, "RAG"),
      };
    } catch (error: any) {
      return this.fallbackClassify(query);
    }
  }

  /**
   * Estimate output tokens based on query complexity
   */
  private estimateOutputTokens(queryTokens: number, type: string): number {
    if (type === "GREETING") return 30;
    if (type === "SIMPLE") return 100;

    // For RAG queries, scale based on query complexity
    if (queryTokens < 10) return 1000; // Simple: "What is X?"
    if (queryTokens < 25) return 3000; // Medium: "Explain X in detail"
    if (queryTokens < 50) return 8000; // Complex: "Explain X, Y, and Z..."
    return 15000; // Very complex: Long detailed questions
  }

  private fallbackClassify(query: string): {
    type: "GREETING" | "SIMPLE" | "RAG";
    reason: string;
    estimatedOutputTokens: number;
  } {
    const trimmed = query.trim().toLowerCase();
    const queryTokens = countTokens(query);

    for (const g of RAG_CONSTANTS.GREETINGS) {
      if (
        trimmed === g ||
        trimmed.startsWith(g + " ") ||
        trimmed.startsWith(g + "!")
      ) {
        return {
          type: "GREETING",
          reason: "Fallback: greeting",
          estimatedOutputTokens: 30,
        };
      }
    }

    const simplePatterns = [/^who are you/i, /^what can you do/i, /^help$/i];
    if (simplePatterns.some((p) => p.test(trimmed))) {
      return {
        type: "SIMPLE",
        reason: "Fallback: simple",
        estimatedOutputTokens: 100,
      };
    }

    // Default to RAG for any educational-sounding query
    return {
      type: "RAG",
      reason: "Fallback: Treat as educational query",
      estimatedOutputTokens: this.estimateOutputTokens(queryTokens, "RAG"),
    };
  }

  async generateEducationalAnswer(
    context: string,
    history: ChatMessage[],
    query: string,
    language: LanguageCode,
    sources: SourceCitation[]
  ): Promise<{ answer: string; reasoning?: string; thinking?: string }> {
    const prompt = `CONTEXT: ${context}\n\nHISTORY: ${JSON.stringify(history.slice(-3))}\n\nUSER: ${query}`;

    const numPredict = 15000;
    const numCtx = RAG_CONSTANTS.LLM_CTX;

    // Try local Ollama first
    try {
      console.log("🏠 Attempting local Ollama (DeepSeek-R1)...");
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: RAG_CONSTANTS.TEMP_RAG,
            num_predict: numPredict,
            num_ctx: numCtx,
            top_p: 0.95,
          },
        },
        { timeout: 180000 }
      );

      const fullResponse = response.data.response || "";
      const { answer, thinking } = this.parseDeepSeekResponse(fullResponse);
      console.log("✅ Ollama Response Generated.");
      return { answer, reasoning: thinking, thinking };
    } catch (ollamaError: any) {
      console.warn("⚠️ Ollama failed, trying cloud...", ollamaError.message);
      
      // Try Gemini as fallback
      try {
        const geminiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
        if (geminiKey) {
          console.log("☁️ Attempting Gemini API...");
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: RAG_CONSTANTS.TEMP_RAG,
                maxOutputTokens: numPredict,
                topP: 0.95
              }
            },
            { timeout: 90000 }
          );
          const answer = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          console.log("✅ Gemini Response Generated.");
          return { answer };
        }
      } catch (geminiError: any) {
        console.warn("⚠️ Gemini failed:", geminiError.message);
      }

      // Try Groq as second fallback
      try {
        const groqKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;
        if (groqKey) {
          console.log("☁️ Attempting Groq API...");
          const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: "llama-3.1-70b-versatile",
              messages: [{ role: "user", content: prompt }],
              temperature: RAG_CONSTANTS.TEMP_RAG,
              max_tokens: numPredict,
            },
            { headers: { Authorization: `Bearer ${groqKey}` }, timeout: 120000 }
          );
          const answer = response.data.choices?.[0]?.message?.content?.trim() || "";
          console.log("✅ Groq Response Generated.");
          return { answer };
        }
      } catch (groqError: any) {
        console.warn("⚠️ Groq failed:", groqError.message);
      }

      // All failed
      console.error("❌ All AI providers failed!");
      throw new Error(`Failed to generate response: ${ollamaError.message}`);
    }
  }

  async handleSimpleQuery(
    query: string,
    language: LanguageCode,
    chatHistory: ChatMessage[]
  ): Promise<string> {
    const prompt = `You are ShikShak, a friendly educational AI tutor. Answer this query concisely: "${query}". Context: ${JSON.stringify(chatHistory.slice(-2))}`;

    // Try local Ollama first
    try {
      console.log("🏠 Attempting Ollama for simple query...");
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 250,
          },
        },
        { timeout: 30000 }
      );
      const answer = response.data.response || response.data.thinking || "";
      console.log("✅ Ollama Simple Answer Generated.");
      return answer.trim() || "I'm here to help! How can I assist you with your studies today?";
    } catch (ollamaError: any) {
      console.warn("⚠️ Ollama failed for simple query, trying cloud...", ollamaError.message);
      
      // Try Gemini as fallback
      try {
        const geminiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
        if (geminiKey) {
          console.log("☁️ Attempting Gemini Simple Query...");
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 250
              }
            },
            { timeout: 15000 }
          );
          const answer = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          console.log("✅ Gemini Simple Answer Generated.");
          return answer.trim();
        }
      } catch (geminiError: any) {
        console.warn("⚠️ Gemini failed:", geminiError.message);
      }

      // All failed - return a friendly fallback message
      console.warn("⚠️ All AI providers failed for simple query");
      return "I'm here to help! Could you please rephrase your question?";
    }
  }

  async generateWithMaxOutput(
    prompt: string,
    maxOutputTokens: number
  ): Promise<{ answer: string; thinking?: string }> {
    const promptTokens = countTokens(prompt);

    const calculatedMaxTokens =
      RAG_CONSTANTS.LLM_CTX - promptTokens - RAG_CONSTANTS.SAFETY_MARGIN;

    // Ensure num_predict is always positive and at least 50 tokens
    const numPredict = Math.max(
      50,
      Math.min(maxOutputTokens, calculatedMaxTokens)
    );

    console.log(
      `🚀 Generation Request: num_predict=${numPredict}, prompt_tokens=${promptTokens}, max_requested=${maxOutputTokens}, calculated_max=${calculatedMaxTokens}`
    );

    // Try local Ollama first (most reliable for local setup)
    try {
      console.log("🏠 Attempting local Ollama (DeepSeek-R1)...");
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: RAG_CONSTANTS.TEMP_RAG,
            num_predict: numPredict,
            top_p: 0.95,
          },
        },
        { timeout: 180000 }
      );

      if (!response.data) {
        console.error("❌ Ollama returned no data");
        throw new Error("No data from Ollama");
      }

      const responseText = response.data.response?.trim() || "";
      const thinkingText = response.data.thinking?.trim() || "";

      if (!responseText && !thinkingText) {
        console.error("❌ Ollama response missing both 'response' and 'thinking' fields");
        throw new Error("No content from Ollama");
      }

      const fullResponse = responseText || thinkingText;
      const { answer, thinking } = this.parseDeepSeekResponse(fullResponse);

      console.log(`✅ Ollama Response: generated ${countTokens(answer)} tokens`);
      return { answer, thinking };
    } catch (ollamaError: any) {
      console.warn("⚠️ Ollama failed, trying Gemini API...", ollamaError.message);
      
      // Try Gemini as first fallback
      try {
        const geminiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
        if (geminiKey) {
          console.log("☁️ Attempting Gemini API...");
          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: RAG_CONSTANTS.TEMP_RAG,
                maxOutputTokens: numPredict,
                topP: 0.95
              }
            },
            { timeout: 90000 }
          );
          
          const answer = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          console.log(`✅ Gemini Response: generated ${countTokens(answer)} tokens`);
          return { answer };
        }
      } catch (geminiError: any) {
        console.warn("⚠️ Gemini failed:", geminiError.message);
      }

      // Try Groq/Cerebras as second fallback
      try {
        const groqKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;
        if (groqKey) {
          console.log("☁️ Attempting Groq/Cerebras API...");
          const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: "llama-3.1-70b-versatile",
              messages: [{ role: "user", content: prompt }],
              temperature: RAG_CONSTANTS.TEMP_RAG,
              max_tokens: numPredict,
            },
            { headers: { Authorization: `Bearer ${groqKey}` }, timeout: 120000 }
          );
          
          const answer = response.data.choices?.[0]?.message?.content?.trim() || "";
          console.log(`✅ Groq Response: generated ${countTokens(answer)} tokens`);
          return { answer };
        }
      } catch (groqError: any) {
        console.warn("⚠️ Groq failed:", groqError.message);
      }

      // All cloud options failed - report the original Ollama error
      console.error("❌ All AI providers failed!");
      if (ollamaError.code === "ECONNREFUSED") {
        throw new Error("Ollama is not running. Please start Ollama service with: ollama serve");
      }
      if (ollamaError.code === "ETIMEDOUT") {
        throw new Error("Ollama request timed out.");
      }
      throw new Error(`AI generation failed: ${ollamaError.message}`);
    }
  }

  private parseDeepSeekResponse(response: string): {
    answer: string;
    thinking?: string;
  } {
    const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/);

    if (thinkMatch) {
      const thinking = thinkMatch[1].trim();
      const answer = response.replace(/<think>[\s\S]*?<\/think>/, "").trim();
      return { answer, thinking };
    }

    return { answer: response.trim() };
  }

  async extractKeywords(query: string): Promise<string[]> {
    try {
      const prompt = `Extract keywords from: "${query}"
Return comma-separated list (3-5 words max). If none, return "NONE".

Keywords:`;

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 50,
          },
        },
        { timeout: 15001 }
      );

      const extractedText = response.data.response?.trim() || "NONE";

      if (extractedText === "NONE" || extractedText.toLowerCase() === "none") {
        return [];
      }

      return extractedText
        .split(",")
        .map((k: string) => k.trim().toLowerCase())
        .filter((k: string) => k.length > 0);
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Check if query is gibberish/non-educational
   */
  private isGibberish(query: string): boolean {
    const trimmed = query.trim();

    // Too short (less than 2 chars)
    if (trimmed.length < 2) return true;

    // Only repeated characters (e.g., "aaaa", "!!!!")
    if (/^(.)\1+$/.test(trimmed)) return true;

    // Only symbols or numbers
    if (/^[^a-zA-Z]+$/.test(trimmed)) return true;

    // Random keyboard mashing - but be more lenient
    // Only flag if there are VERY long consonant clusters (6+)
    const consonantClusters = trimmed.match(/[bcdfghjklmnpqrstvwxyz]{6,}/gi);
    if (consonantClusters && consonantClusters.length > 2) return true;

    // Very low vowel ratio - only for short strings
    // Long queries (like educational ones) can have technical terms with low vowel ratio
    if (trimmed.length <= 10) {
      const vowels = trimmed.match(/[aeiou]/gi);
      const vowelRatio = vowels ? vowels.length / trimmed.length : 0;
      if (vowelRatio < 0.1) return true;
    }

    // Check for obvious keyboard mashing (same few keys repeated)
    const gibberishPatterns = [
      /^[qwerty]{5,}$/i, // keyboard row
      /^[asdfgh]{5,}$/i, // keyboard row
      /^[zxcvbn]{5,}$/i, // keyboard row
      /^([a-z]{2,3})\1+$/i, // repeated pattern like "asdasdasd"
    ];

    if (gibberishPatterns.some((pattern) => pattern.test(trimmed))) {
      return true;
    }

    // If query contains common educational words, it's definitely not gibberish
    const educationalKeywords = [
      "explain",
      "what",
      "how",
      "why",
      "when",
      "where",
      "who",
      "define",
      "describe",
      "analyze",
      "compare",
      "calculate",
      "solve",
      "understand",
      "learn",
      "study",
      "teach",
      "tell",
      "show",
      "demonstrate",
      "elaborate",
      "detail",
      "discuss",
    ];

    const lowerQuery = trimmed.toLowerCase();
    if (educationalKeywords.some((keyword) => lowerQuery.includes(keyword))) {
      return false;
    }

    // If it has proper sentence structure (words separated by spaces), likely valid
    const words = trimmed.split(/\s+/);
    if (words.length >= 3) {
      // Check if at least 50% of words have reasonable length
      const reasonableWords = words.filter(
        (w) => w.length >= 2 && w.length <= 20
      );
      if (reasonableWords.length >= words.length * 0.5) {
        return false;
      }
    }

    return false;
  }
}

export const ollamaChatService = new OllamaChatService();
