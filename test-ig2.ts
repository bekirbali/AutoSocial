import 'dotenv/config';
import axios from 'axios';
import { env } from './src/config/env.js';

async function test() {
  const token = env.IG_ACCESS_TOKEN;
  const igUserId = env.IG_ACCOUNT_ID;
  const publicAppUrl = env.APP_PUBLIC_URL;
  
  // Test the exact image from the failed job
  const fileName = '4564e9ec-c6e5-4e0b-99c2-f353acba7082_16x9.jpeg';
  
  const imageUrl = `${publicAppUrl?.replace(/\/$/, '')}/images/${fileName}`;
  console.log('Testing image_url:', imageUrl);
  
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${igUserId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption: 'Test caption with failed image',
          access_token: token,
        },
      }
    );
    console.log('Success:', res.data);
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
