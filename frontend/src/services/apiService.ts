import { mockApi } from '../mocks/apiMock';
import { FORCE_MOCK_MODE } from '../constants/apiConfig';

// Determine if we should use mock API
const USE_MOCK_API = FORCE_MOCK_MODE;

// Import actual API services conditionally
async function getActualApis() {
  try {
    const { 
      sendQuery, 
      sendStreamingQuery, 
      uploadFile, 
      getAllSessions, 
      getSessionDetails,
      deleteSession,
      updateChatName,
      updateSessionSettings,
      getSessionDocuments,
      getAllUserFiles,
      deleteFile,
      generateChatName,
      translateMessage
    } = await import('./chatApi');

    const {
      checkOllamaStatus,
      generateCards,
      performCardAction
    } = await import('./boardApi');

    return {
      chat: {
        sendQuery,
        sendStreamingQuery,
        uploadFile,
        getAllSessions,
        getSessionDetails,
        deleteSession,
        updateChatName,
        updateSessionSettings,
        getSessionDocuments,
        getAllUserFiles,
        deleteFile,
        generateChatName,
        translateMessage
      },
      board: {
        checkOllamaStatus,
        generateCards,
        performCardAction
      }
    };
  } catch (error) {
    console.warn('Failed to load actual APIs, using mock services:', error);
    return null;
  }
}

// API Service that conditionally uses real API or mocks with error fallback
export const apiService = {
  chat: {
    sendQuery: async (userId: string, sessionId: string, query: string) => {
      if (USE_MOCK_API) {
        return mockApi.chat.sendQuery(userId, sessionId, query);
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure');
        return mockApi.chat.sendQuery(userId, sessionId, query);
      }
      
      try {
        return await apis.chat.sendQuery(userId, sessionId, query);
      } catch (error) {
        console.warn('Chat API failed, using mock:', error);
        return mockApi.chat.sendQuery(userId, sessionId, query);
      }
    },
    
    sendStreamingQuery: async (
      userId: string, 
      sessionId: string, 
      query: string, 
      onChunk: (chunk: any) => void,
      mentionedFileIds?: string[]
    ) => {
      if (USE_MOCK_API) {
        // For mock, simulate streaming
        const response = await mockApi.chat.sendQuery(userId, sessionId, query);
        onChunk({ type: 'complete', content: response.response });
        return Promise.resolve();
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for streaming');
        const response = await mockApi.chat.sendQuery(userId, sessionId, query);
        onChunk({ type: 'complete', content: response.response });
        return Promise.resolve();
      }
      
      try {
        return await apis.chat.sendStreamingQuery(userId, sessionId, query, onChunk, mentionedFileIds);
      } catch (error) {
        console.warn('Streaming API failed, using mock:', error);
        const response = await mockApi.chat.sendQuery(userId, sessionId, query);
        onChunk({ type: 'complete', content: response.response });
        return Promise.resolve();
      }
    },
    
    uploadFile: async (userId: string, sessionId: string, file: File, onProgress?: (progress: number) => void) => {
      if (USE_MOCK_API) {
        return mockApi.chat.uploadFile(userId, sessionId, file);
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for upload');
        return mockApi.chat.uploadFile(userId, sessionId, file);
      }
      
      try {
        return await apis.chat.uploadFile(userId, sessionId, file, onProgress);
      } catch (error) {
        console.warn('Upload API failed, using mock:', error);
        return mockApi.chat.uploadFile(userId, sessionId, file);
      }
    },
    
    getAllSessions: async (userId: string) => {
      if (USE_MOCK_API) {
        return mockApi.chat.getAllSessions(userId);
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for sessions');
        return mockApi.chat.getAllSessions(userId);
      }
      
      try {
        return await apis.chat.getAllSessions(userId);
      } catch (error) {
        console.warn('Sessions API failed, using mock:', error);
        return mockApi.chat.getAllSessions(userId);
      }
    },
    
    getSessionDetails: async (userId: string, sessionId: string) => {
      if (USE_MOCK_API) {
        return mockApi.chat.getSessionDetails(userId, sessionId);
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for session details');
        return mockApi.chat.getSessionDetails(userId, sessionId);
      }
      
      try {
        return await apis.chat.getSessionDetails(userId, sessionId);
      } catch (error) {
        console.warn('Session details API failed, using mock:', error);
        return mockApi.chat.getSessionDetails(userId, sessionId);
      }
    },
    
    deleteSession: async (userId: string, sessionId: string) => {
      if (USE_MOCK_API) {
        return { success: true, message: 'Session deleted (mock)' };
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for delete session');
        return { success: true, message: 'Session deleted (mock)' };
      }
      
      try {
        return await apis.chat.deleteSession(userId, sessionId);
      } catch (error) {
        console.warn('Delete session API failed, using mock:', error);
        return { success: true, message: 'Session deleted (mock)' };
      }
    },
    
    updateChatName: async (userId: string, sessionId: string, chatName: string) => {
      if (USE_MOCK_API) {
        return { success: true, message: 'Chat name updated (mock)' };
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for update chat name');
        return { success: true, message: 'Chat name updated (mock)' };
      }
      
      try {
        return await apis.chat.updateChatName(userId, sessionId, chatName);
      } catch (error) {
        console.warn('Update chat name API failed, using mock:', error);
        return { success: true, message: 'Chat name updated (mock)' };
      }
    },
    
    updateSessionSettings: async (userId: string, sessionId: string, settings: { language?: string; grade?: string }) => {
      if (USE_MOCK_API) {
        return { success: true, message: 'Settings updated (mock)' };
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for update settings');
        return { success: true, message: 'Settings updated (mock)' };
      }
      
      try {
        return await apis.chat.updateSessionSettings(userId, sessionId, settings);
      } catch (error) {
        console.warn('Update settings API failed, using mock:', error);
        return { success: true, message: 'Settings updated (mock)' };
      }
    },
    
    getSessionDocuments: async (userId: string, sessionId: string) => {
      if (USE_MOCK_API) {
        return mockApi.browse.getSessionDocuments(userId, sessionId);
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for session documents');
        return mockApi.browse.getSessionDocuments(userId, sessionId);
      }
      
      try {
        return await apis.chat.getSessionDocuments(userId, sessionId);
      } catch (error) {
        console.warn('Session documents API failed, using mock:', error);
        return mockApi.browse.getSessionDocuments(userId, sessionId);
      }
    },
    
    getAllUserFiles: async (userId: string, sessionId: string) => {
      if (USE_MOCK_API) {
        return mockApi.browse.getSessionDocuments(userId, sessionId);
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for user files');
        return mockApi.browse.getSessionDocuments(userId, sessionId);
      }
      
      try {
        return await apis.chat.getAllUserFiles(userId, sessionId);
      } catch (error) {
        console.warn('User files API failed, using mock:', error);
        return mockApi.browse.getSessionDocuments(userId, sessionId);
      }
    },
    
    deleteFile: async (userId: string, sessionId: string, fileId: string) => {
      if (USE_MOCK_API) {
        return { success: true, message: 'File deleted (mock)' };
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for delete file');
        return { success: true, message: 'File deleted (mock)' };
      }
      
      try {
        return await apis.chat.deleteFile(userId, sessionId, fileId);
      } catch (error) {
        console.warn('Delete file API failed, using mock:', error);
        return { success: true, message: 'File deleted (mock)' };
      }
    },
    
    generateChatName: async (firstMessage: string) => {
      if (USE_MOCK_API) {
        return `Mock Chat: ${firstMessage.substring(0, 20)}...`;
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for generate chat name');
        return `Mock Chat: ${firstMessage.substring(0, 20)}...`;
      }
      
      try {
        return await apis.chat.generateChatName(firstMessage);
      } catch (error) {
        console.warn('Generate chat name API failed, using mock:', error);
        return `Mock Chat: ${firstMessage.substring(0, 20)}...`;
      }
    },
    
    translateMessage: async (
      userId: string,
      sessionId: string,
      text: string,
      sourceLanguage: string,
      targetLanguage: string
    ) => {
      if (USE_MOCK_API) {
        return { success: true, translated: text, error: undefined };
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for translation');
        return { success: true, translated: text, error: undefined };
      }
      
      try {
        return await apis.chat.translateMessage(userId, sessionId, text, sourceLanguage, targetLanguage);
      } catch (error) {
        console.warn('Translation API failed, using mock:', error);
        return { success: true, translated: text, error: undefined };
      }
    }
  },

  board: {
    checkOllamaStatus: async () => {
      if (USE_MOCK_API) {
        return mockApi.board.checkOllamaStatus();
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for ollama status');
        return mockApi.board.checkOllamaStatus();
      }
      
      try {
        return await apis.board.checkOllamaStatus();
      } catch (error) {
        console.warn('Ollama status API failed, using mock:', error);
        return mockApi.board.checkOllamaStatus();
      }
    },
    
    generateCards: async (prompt: string, cardCount: number, onThinkingUpdate?: (text: string) => void, onCardUpdate?: (cards: any[]) => void) => {
      if (USE_MOCK_API) {
        const cards = await mockApi.board.generateCards(prompt, cardCount);
        if (onCardUpdate) onCardUpdate(cards);
        return cards;
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for generate cards');
        const cards = await mockApi.board.generateCards(prompt, cardCount);
        if (onCardUpdate) onCardUpdate(cards);
        return cards;
      }
      
      try {
        return await apis.board.generateCards(prompt, cardCount, onThinkingUpdate, onCardUpdate);
      } catch (error) {
        console.warn('Generate cards API failed, using mock:', error);
        const cards = await mockApi.board.generateCards(prompt, cardCount);
        if (onCardUpdate) onCardUpdate(cards);
        return cards;
      }
    },
    
    performCardAction: async (action: any, cardContents: string[], onPartialUpdate?: (data: any) => void, onThinkingUpdate?: (text: string) => void) => {
      if (USE_MOCK_API) {
        return mockApi.board.performCardAction(action, cardContents);
      }
      
      const apis = await getActualApis();
      if (!apis) {
        console.warn('Using mock API due to import failure for card action');
        return mockApi.board.performCardAction(action, cardContents);
      }
      
      try {
        return await apis.board.performCardAction(action, cardContents, onPartialUpdate, onThinkingUpdate);
      } catch (error) {
        console.warn('Card action API failed, using mock:', error);
        return mockApi.board.performCardAction(action, cardContents);
      }
    }
  }
};