import 'dotenv/config';
import axios from 'axios';
import { env } from './src/config/env.js';

async function test() {
  const token = env.IG_ACCESS_TOKEN;
  const igUserId = env.IG_ACCOUNT_ID;
  const publicAppUrl = env.APP_PUBLIC_URL;
  
  // Use a known image from output/images
  const fileName = '0039cef2-1d4f-41d0-864d-aafc2ebfbc04_16x9.webp';
  const jpegName = fileName.replace('.webp', '.jpeg');
  
  const imageUrl = `${publicAppUrl?.replace(/\/$/, '')}/images/${jpegName}`;
  console.log('Testing image_url:', imageUrl);
  
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${igUserId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption: 'Test caption',
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
