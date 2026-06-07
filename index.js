const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const HF_API_SECRET = process.env.HF_API_SECRET;
const HF_AUTH = 'Key ' + HF_API_KEY + ':' + HF_API_SECRET;

async function pollStatus(requestId) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await axios.get(
      'https://platform.higgsfield.ai/requests/' + requestId + '/status',
      { headers: { 'Authorization': HF_AUTH } }
    );
    const status = res.data.status;
    console.log('Status: ' + status);
    if (status === 'completed') return res.data;
    if (status === 'failed' || status === 'nsfw') throw new Error('Generation failed: ' + status);
  }
  throw new Error('Timeout waiting for generation');
}

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
        messages: [{
          role: 'user',
          content: 'For the question: ' + question + ' - create 4 instructional steps. Return ONLY valid JSON array, no markdown: [{"step":1,"title":"string","description":"string","visual":"detailed image description showing this step being performed, photorealistic"},{"step":2,"title":"string","description":"string","visual":"detailed image description showing this step being performed, photorealistic"},{"step":3,"title":"string","description":"string","visual":"detailed image description showing this step being performed, photorealistic"},{"step":4,"title":"string","description":"string","visual":"detailed image description showing this step being performed, photorealistic"}]'
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

    const steps = JSON.parse(scriptResponse.data.content[0].text.trim());
    console.log('Steps generated: ' + steps.length);

    const videoUrls = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log('Step ' + step.step + ': generating image...');

      const imageSubmit = await axios.post(
        'https://platform.higgsfield.ai/higgsfield-ai/soul/standard',
        {
          prompt: step.visual,
          aspect_ratio: '16:9',
          resolution: '720p'
        },
        { headers: { 'Authorization': HF_AUTH, 'Content-Type': 'application/json' } }
      );

      const imageResult = await pollStatus(imageSubmit.data.request_id);
      const imageUrl = imageResult.images[0].url;
      console.log('Image ready: ' + imageUrl);

      console.log('Step ' + step.step + ': generating video...');

      const videoSubmit = await axios.post(
        'https://platform.higgsfield.ai/higgsfield-ai/dop/preview',
        {
          image_url: imageUrl,
          prompt: 'Smooth cinematic camera movement, instructional style, clear and well lit',
          duration: 4
        },
        { headers: { 'Authorization': HF_AUTH, 'Content-Type': 'application/json' } }
      );

      const videoResult = await pollStatus(videoSubmit.data.request_id);
      const videoUrl = videoResult.video.url;
      console.log('Video ready: ' + videoUrl);

      videoUrls.push({
        step: step.step,
        title: step.title,
        description: step.description,
        videoUrl: videoUrl
      });
    }

    res.json({ success: true, steps: videoUrls });

  } catch (err) {
    console.error('Error: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
