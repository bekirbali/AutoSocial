import { env } from '../src/config/env.js';
import axios from 'axios';

interface GeminiModel {
  name: string;
}

interface ModelsResponse {
  models: GeminiModel[];
}

async function main() {
  try {
    const res = await axios.get<ModelsResponse>(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);
    const models = res.data.models;
    console.log('Available models:');
    for (const model of models) {
      if (model.name.includes('flash') || model.name.includes('pro')) {
        console.log(`- ${model.name}`);
      }
    }
  } catch (error) {
    const err = error as any;
    console.error('Error fetching models:', err.response?.data || err.message);
  }
}
main();
