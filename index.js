const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API_KEY;

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
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );

    const rawText = scriptResponse.data.content[0].text.trim();
    const steps = JSON.parse(rawText);
    console.log('Steps generated:', steps.length);

    // Step 2: Generate a video for each step using Higgsfield
    console.log('Step 2: Generating videos for each step...');
    const videoUrls = [];

    for (const step of steps) {
      console.log(`Generating video for step ${step.step}: ${step.title}`);

      const videoResponse = await axios.post(
        'https://api.cloud.higgsfield.ai/v1/video/text-to-video',
        {
          prompt: `${step.visual}. Cinematic, high quality, instructional style, clear and well-lit.`,
          duration: 4,
          aspect_ratio: '16:9'
        },
        {
          headers: {
            'Authorization': `Bearer ${HIGGSFIELD_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const jobId = videoResponse.data.id || videoResponse.data.job_id;
      console.log(`Job ID for step ${step.step}:`, jobId);

      // Poll for completion
      let videoUrl = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 5000));

        const statusResponse = await axios.get(
          `https://api.cloud.higgsfield.ai/v1/video/${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${HIGGSFIELD_API_KEY}`
            }
          }
        );

        const status = statusResponse.data.status;
        console.log(`Step ${step.step} status:`, status);

        if (status === 'completed' || status === 'COMPLETED') {
          videoUrl = statusResponse.data.video_url || statusResponse.data.output?.url;
          break;
        } else if (status === 'failed' || status === 'FAILED' || status === 'ERROR') {
          throw new Error(`Video generation failed for step ${step.step}`);
        }
      }

      if (!videoUrl) throw new Error(`Timeout waiting for step ${step.step}`);
      videoUrls.push({ ...step, videoUrl });
    }

    console.log('All videos generated:', videoUrls.length);
    res.json({ success: true, steps: videoUrls });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message || 'Something went wrong' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});