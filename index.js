const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { HiggsfieldClient, InputImage } = require('@higgsfield/client');

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API_KEY;
const HIGGSFIELD_API_SECRET = process.env.HIGGSFIELD_API_SECRET;

const higgsfield = new HiggsfieldClient({
  apiKey: HIGGSFIELD_API_KEY,
  apiSecret: HIGGSFIELD_API_SECRET
});

app.get('/', (req, res) => {
  res.send('howdo.ai API is running!');
});

app.post('/generate', async (req, res) => {
  const { question } = req.body;

  try {
    // Step 1: Generate script split into steps using Claude
    console.log('Step 1: Generating script for:', question);
    const scriptResponse = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are a helpful instructor. For the question "${question}", create a step-by-step instructional guide with exactly 4 steps.

Return ONLY a JSON array with no extra text, no markdown, no backticks. Format exactly like this:
[
  {"step": 1, "title": "Step title", "description": "One sentence description", "visual": "Detailed cinematic description of what this step looks like visually for a video scene"},
  {"step": 2, "title": "Step title", "description": "One sentence description", "visual": "Detailed cinematic description of what this step looks like visually for a video scene"},
  {"step": 3, "title": "Step title", "description": "One sentence description", "visual": "Detailed cinematic description of what this step looks like visually for a video scene"},
  {"step": 4, "title": "Step title", "description": "One sentence description", "visual": "Detailed cinematic description of what this step looks like visually for a video scene"}
]`
        }]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthr