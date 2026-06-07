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

app.get('/', function(req, res) {
  res.send('howdo.ai API is running!');
});

app.post('/generate', async function(req, res) {
  const question = req.body.question;

  try {
    console.log('Generating script for: ' + question);

    const scriptResponse = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: 'For the question: ' + question + ' - create 4 instructional steps. Return ONLY valid JSON array, no markdown: [{"step":1,"title":"string","description":"string","visual":"cinematic scene description for video"},{"step":2,"title":"string","description":"string","visual":"cinematic scene description for video"},{"step":3,"title":"string","description":"string","visual":"cinematic scene description for video"},{"step":4,"title":"string","description":"string","visual":"cinematic scene description for video"}]'
          }
        ]
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
    console.log('Steps generated: ' + steps.length);

    const videoUrls = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log('Generating video for step ' + step.step);

      const jobSet = await higgsfield.generate('/v1/text2video/dop', {
        prompt: step.visual + '. Cinematic, high quality, instructional style.',
        aspect_ratio: '16:9',
        duration: 4
      }, {
        withPolling: true
      });

      if (!jobSet.isCompleted) {
        throw new Error('Video failed for step ' + step.step);
      }

      const videoUrl = jobSet.jobs[0].results.raw.url;
      console.log('Step ' + step.step + ' done: ' + videoUrl);

      videoUrls.push({
        step: step.step,
        title: step.title,
        description: step.description,
        videoUrl: videoUrl
      });
    }

    res.json({ success: true, steps: videoUrls });

  } catch (err) {
    console.error('Error: ' + err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
