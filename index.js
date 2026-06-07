const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { HiggsfieldClient } = require('@higgsfield/client');

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
    console.log('Step 1: Generating script for:', question);

    const scriptResponse = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: 'You are a helpful instructor. For the question "' + question + '", create a step-by-step instructional guide with exactly 4 steps. Return ONLY a JSON array with no extra text, no markdown, no backticks. Format: [{"step":1,"title":"title","description":"desc","visual":"cinematic video scene description"},{"step":2,"title":"title","description":"desc","visual":"cinematic video scene description"},{"step":3,"title":"title","description":"desc","visual":"cinematic video scene description"},{"step":4,"title":"title","description":"desc","visual":"cinematic video scene description"}]'
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

    const rawText = scriptResponse.data.content[0].text.trim();
    const steps = JSON.parse(rawText);
    console.log('Steps generated:', steps.length);

    console.log('Step 2: Generating videos...');
    const videoUrls = [];

    for (const step of steps) {
      console.log('Generating video for step', step.step);

      const jobSet = await higgsfield.generate('/v1/text2video/dop', {
        prompt: step.visual + '. Cinematic, high quality, instructional style.',
        aspect_ratio: '16:9',
        duration: 4
      }, {
        withPolling: true
      });

      if (!jobSet.isCompleted) {
        throw new Error('Video generation failed for step ' + step.step);
      }

      const videoUrl = jobSet.jobs[0].results.raw.url;
      console.log('Step', step.step, 'done:', videoUrl);
      videoUrls.push({ step: step.step, title: step.title, description: step.description, videoUrl: videoUrl });
    }

    res.json({ success: true, steps: videoUrls });

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});