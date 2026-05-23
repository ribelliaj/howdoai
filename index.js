require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
console.log('KEY CHECK:', ANTHROPIC_API_KEY ? 'Key found' : 'Key is MISSING');
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

app.get('/', (req, res) => {
  res.send('howdo.ai API is running!');
});

app.post('/generate', async (req, res) => {
  const { question } = req.body;

  try {
    // Step 1: Generate script with Claude
    const scriptResponse = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a helpful instructor. Create a clear, friendly, step-by-step script for an AI video presenter explaining: "${question}". Write it as if speaking directly to the viewer. Keep it under 300 words. Just write the script, no extra commentary.`
        }]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );

    const script = scriptResponse.data.content[0].text;

    // Step 2: Send script to HeyGen
    const videoResponse = await axios.post(
      'https://api.heygen.com/v2/video/generate',
      {
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: 'Daisy-inskirt-20220818',
            avatar_style: 'normal'
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: '2d5b0e6cf36f460aa7fc47e3eee4ba54'
          }
        }],
        dimension: { width: 1280, height: 720 }
      },
      {
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const videoId = videoResponse.data.data.video_id;
    res.json({ success: true, videoId, script });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});