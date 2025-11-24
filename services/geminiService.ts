
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordData, ArticleData, SentenceFeedback, WritingFeedback, DifficultyLevel, ChatMessage, PronunciationResult, WordExtras } from "../types";

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateVocabulary = async (theme: string, difficulty: DifficultyLevel = 'C1', excludeWords: string[] = []): Promise<WordData[]> => {
  const ai = getClient();
  
  const levelText = ['IELTS', 'TOEFL', 'SAT'].includes(difficulty) 
    ? `${difficulty} exam level` 
    : `CEFR level ${difficulty}`;

  let prompt = `Generate 8 English vocabulary words at ${levelText} for the theme: "${theme}". 
    Include:
    1. Phonetic transcription (IPA)
    2. A simple English definition
    3. The Chinese translation of that definition (definitionTranslation)
    4. The Chinese translation of the word itself (translation)
    5. An example sentence using the word in a ${difficulty} level context
    6. The Chinese translation of the example sentence
    7. The word broken into syllables (e.g., "e-du-ca-tion")
    8. Part of speech (e.g., "noun", "adjective")`;

  if (excludeWords.length > 0) {
    prompt += ` Do not include the following words: ${excludeWords.join(', ')}.`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            phonetic: { type: Type.STRING },
            definition: { type: Type.STRING },
            definitionTranslation: { type: Type.STRING },
            translation: { type: Type.STRING, description: "The Chinese meaning of the word itself (e.g. 苹果)" },
            exampleSentence: { type: Type.STRING },
            exampleTranslation: { type: Type.STRING },
            syllables: { type: Type.STRING, description: "The word split by hyphens for syllables, e.g., 'com-put-er'" },
            partOfSpeech: { type: Type.STRING, description: "e.g., noun, verb, adj" },
          },
          required: ["word", "phonetic", "definition", "definitionTranslation", "translation", "exampleSentence", "exampleTranslation", "syllables", "partOfSpeech"]
        },
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text) as WordData[];
  }
  throw new Error("Failed to generate vocabulary");
};

export const generateWordExtras = async (word: string): Promise<WordExtras> => {
  const ai = getClient();
  const prompt = `Generate advanced vocabulary details for the English word "${word}".
  Provide:
  1. 5 Synonyms (single words).
  2. 5 Antonyms (single words). If none, return empty array.
  3. Etymology/Root breakdown. Identify 1-3 key roots, prefixes, or suffixes. For each, provide the meaning and 3-4 other English words derived from it.
  
  Example structure for "bicycle":
  Root: "bi-", Meaning: "two", Related: ["binary", "bilingual"]
  Root: "-cycle", Meaning: "circle/wheel", Related: ["motorcycle", "recycle"]
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
          antonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
          roots: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                root: { type: Type.STRING, description: "The root part, e.g. 'bi-' or '-spect'" },
                meaning: { type: Type.STRING, description: "Meaning of the root, e.g. 'two'" },
                relatedWords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of other words sharing this root" }
              },
              required: ["root", "meaning", "relatedWords"]
            }
          }
        },
        required: ["synonyms", "antonyms", "roots"]
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as WordExtras;
  }
  throw new Error("Failed to generate word extras");
};

export const generateWordDetails = async (word: string, theme: string, difficulty: DifficultyLevel): Promise<WordData> => {
  const ai = getClient();
  const levelText = ['IELTS', 'TOEFL', 'SAT'].includes(difficulty) 
    ? `${difficulty} exam level` 
    : `CEFR level ${difficulty}`;

  const prompt = `Generate details for the English vocabulary word "${word}" (${levelText}) related to the theme "${theme}".
    Include:
    1. Phonetic transcription (IPA)
    2. A simple English definition
    3. The Chinese translation of that definition (definitionTranslation)
    4. The Chinese translation of the word itself (translation)
    5. An example sentence using the word in a ${difficulty} level context
    6. The Chinese translation of the example sentence
    7. The word broken into syllables
    8. Part of speech`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          definition: { type: Type.STRING },
          definitionTranslation: { type: Type.STRING },
          translation: { type: Type.STRING },
          exampleSentence: { type: Type.STRING },
          exampleTranslation: { type: Type.STRING },
          syllables: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
        },
        required: ["word", "phonetic", "definition", "definitionTranslation", "translation", "exampleSentence", "exampleTranslation", "syllables", "partOfSpeech"]
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text) as WordData;
  }
  throw new Error("Failed to generate word details");
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const checkSentence = async (word: string, sentence: string): Promise<SentenceFeedback> => {
  const ai = getClient();
  const prompt = `
  Act as an expert English teacher. Review this user-written sentence containing the target word "${word}".
  User Sentence: "${sentence}"
  
  Provide a response in JSON format.
  
  1. "isCorrect": boolean. True only if the sentence is grammatically correct AND uses the word naturally.
  2. "correctedSentence": string. A corrected, more natural version of the sentence.
  3. "explanation": string. A detailed critique in **English**.
  4. "explanationTranslation": string. The detailed critique translated into **Chinese**.
  
  CRITICAL INSTRUCTIONS FOR "explanation":
  - If "isCorrect" is FALSE:
    1. ONLY list the categories that have errors.
    2. Start each point on a new line using a number (1., 2., etc.).
    3. Use **bold** for key terms or corrections.
    4. Categories to check: **Spelling**, **Grammar**, **Expression**.
    
  - If "isCorrect" is TRUE:
    - Simply praise the sentence in English (e.g. "Excellent usage!").
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          correctedSentence: { type: Type.STRING },
          explanation: { type: Type.STRING },
          explanationTranslation: { type: Type.STRING },
        },
        required: ["isCorrect", "explanation", "explanationTranslation"]
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text) as SentenceFeedback;
  }
  throw new Error("Failed to check sentence");
};

export const askGrammarQuestion = async (
  word: string,
  userSentence: string,
  feedback: SentenceFeedback,
  currentHistory: ChatMessage[],
  question: string
): Promise<{content: string, translation: string}> => {
  const ai = getClient();
  
  const historyText = currentHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Teacher'}: ${msg.content}`).join('\n');

  const prompt = `
  Act as an expert English teacher.
  
  Context:
  Target Word: "${word}"
  Student's Sentence: "${userSentence}"
  Correction: "${feedback.correctedSentence || 'N/A'}"
  Feedback Provided: "${feedback.explanation}"

  Conversation History:
  ${historyText}

  Student Question: "${question}"

  Please answer in **English** and provide a **Chinese translation**.
  STRICT FORMAT REQUIREMENTS:
  1. Use a numbered list (1., 2., 3.) if there are multiple points.
  2. Start each point on a NEW LINE.
  3. Keep explanations concise and easy to read.
  4. Use **bold** for emphasis on key terms.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                content: { type: Type.STRING, description: "The answer in English" },
                translation: { type: Type.STRING, description: "The answer translated to Chinese" }
            },
            required: ["content", "translation"]
        }
    }
  });

  if (response.text) {
      return JSON.parse(response.text) as {content: string, translation: string};
  }
  
  throw new Error("Failed to get answer");
};

export const generateArticle = async (theme: string, words: string[]): Promise<ArticleData> => {
  const ai = getClient();
  const prompt = `Write a short, academic-style article (approx 150-200 words) suitable for English learners about "${theme}" that naturally includes these words: ${words.join(', ')}. 
  Also provide a Chinese translation.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          translation: { type: Type.STRING },
        },
        required: ["title", "content", "translation"]
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text) as ArticleData;
  }
  throw new Error("Failed to generate article");
};

export const reviewWriting = async (theme: string, userText: string): Promise<WritingFeedback> => {
  const ai = getClient();
  const prompt = `
  Review this user's short essay on the theme "${theme}".
  User Text: "${userText}"
  
  Provide:
  1. A band score estimate (0-9) based on IELTS criteria.
  2. "critique": Critique and tips in **English** (focus on vocabulary and coherence).
  3. "critiqueTranslation": Chinese translation of the critique.
  4. "improvedVersion": An improved/native-like version of the text in English (Band 9 level).
  5. "improvedVersionTranslation": Chinese translation of the improved version.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          critique: { type: Type.STRING },
          critiqueTranslation: { type: Type.STRING },
          improvedVersion: { type: Type.STRING },
          improvedVersionTranslation: { type: Type.STRING },
        },
        required: ["score", "critique", "critiqueTranslation", "improvedVersion", "improvedVersionTranslation"]
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text) as WritingFeedback;
  }
  throw new Error("Failed to review writing");
};

export const chatWithAi = async (
  theme: string, 
  userText: string,
  aiCritique: string,
  history: ChatMessage[], 
  userMessage: string
): Promise<string> => {
  const ai = getClient();
  const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');

  const prompt = `
  You are an helpful English tutor. 
  Context: The user wrote an essay about "${theme}".
  User's Essay: "${userText}"
  Your Critique: "${aiCritique}"
  
  Conversation History:
  ${historyText}
  
  User Question: "${userMessage}"
  
  Answer the user's question in **English**. Be encouraging and specific.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "I'm unable to answer that right now.";
};

export const evaluatePronunciation = async (audioBase64: string, targetText: string): Promise<PronunciationResult> => {
  const ai = getClient();
  
  const prompt = `
  Listen to the attached audio. The user is attempting to read the following text: "${targetText}".
  
  Evaluate their pronunciation.
  1. "score": Provide a score from 0 to 100.
  2. "feedback": Give a concise feedback string in **English** describing the overall quality.
  3. "feedbackTranslation": Chinese translation of the feedback.
  4. "details": Provide specific details (in **English**) on any mispronounced words or syllables. 
     - Identify specific syllables or phonemes that were incorrect.
  5. "detailsTranslation": Chinese translation of the details.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "audio/webm", // Browsers typically record as webm or mp4, Gemini handles it.
            data: audioBase64
          }
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          feedback: { type: Type.STRING },
          feedbackTranslation: { type: Type.STRING },
          details: { type: Type.STRING },
          detailsTranslation: { type: Type.STRING },
        },
        required: ["score", "feedback", "feedbackTranslation", "details", "detailsTranslation"]
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text) as PronunciationResult;
  }
  throw new Error("Failed to evaluate pronunciation");
};