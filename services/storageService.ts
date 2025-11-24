
import { LearningSession, MistakeItem, User } from '../types';

// Keys
const USERS_CREDS_KEY = 'realuse_users_creds'; // Map of username -> password
const CURRENT_USER_KEY = 'realuse_current_user';

// Helpers
const getStorageKey = (username: string, key: string) => `realuse_${username}_${key}`;

export const authService = {
  login: (username: string, password: string): boolean => {
    try {
        const credsString = localStorage.getItem(USERS_CREDS_KEY);
        const creds = credsString ? JSON.parse(credsString) : {};
        
        if (creds[username] && creds[username] === password) {
            localStorage.setItem(CURRENT_USER_KEY, username);
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
  },

  register: (username: string, password: string): boolean => {
    try {
        const credsString = localStorage.getItem(USERS_CREDS_KEY);
        const creds = credsString ? JSON.parse(credsString) : {};
        
        if (creds[username]) {
            return false; // Already exists
        }
        
        creds[username] = password;
        localStorage.setItem(USERS_CREDS_KEY, JSON.stringify(creds));
        localStorage.setItem(CURRENT_USER_KEY, username);
        return true;
    } catch (e) {
        return false;
    }
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const username = localStorage.getItem(CURRENT_USER_KEY);
    return username ? { username } : null;
  }
};

export const dataService = {
  // Points
  savePoints: (username: string, points: number) => {
      localStorage.setItem(getStorageKey(username, 'points'), points.toString());
  },

  getPoints: (username: string): number => {
      const points = localStorage.getItem(getStorageKey(username, 'points'));
      return points ? parseInt(points, 10) : 0;
  },

  // History
  saveHistory: (username: string, history: LearningSession[]) => {
    localStorage.setItem(getStorageKey(username, 'history'), JSON.stringify(history));
  },

  getHistory: (username: string): LearningSession[] => {
    const data = localStorage.getItem(getStorageKey(username, 'history'));
    return data ? JSON.parse(data) : [];
  },

  // Notebook (Saved Words)
  saveNotebook: (username: string, words: any[]) => {
    localStorage.setItem(getStorageKey(username, 'notebook_words'), JSON.stringify(words));
  },

  getNotebook: (username: string): any[] => {
    const data = localStorage.getItem(getStorageKey(username, 'notebook_words'));
    return data ? JSON.parse(data) : [];
  },

  // Mistakes
  saveMistakes: (username: string, mistakes: MistakeItem[]) => {
    localStorage.setItem(getStorageKey(username, 'mistakes'), JSON.stringify(mistakes));
  },

  getMistakes: (username: string): MistakeItem[] => {
    const data = localStorage.getItem(getStorageKey(username, 'mistakes'));
    return data ? JSON.parse(data) : [];
  },
  
  addMistake: (username: string, mistake: MistakeItem) => {
      const currentMistakes = dataService.getMistakes(username);
      // Avoid duplicates for the same word/type on the same day
      const today = new Date().toLocaleDateString();
      const exists = currentMistakes.find(m => 
          m.word === mistake.word && 
          m.type === mistake.type && 
          m.date === today
      );
      
      if (!exists) {
          const updated = [mistake, ...currentMistakes];
          dataService.saveMistakes(username, updated);
          return updated;
      }
      return currentMistakes;
  }
};
