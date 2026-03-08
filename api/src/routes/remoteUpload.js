const express = require('express');
const { remoteUpload } = require('../services/remoteUploadService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { url, provider, filename, metadata } = req.body;

    if (!url || !provider) {
      return res.status(400).json({
        error: 'URL and provider are required'
      });
    }

    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid URL format'
      });
    }

    const result = await remoteUpload({
      url,
      provider,
      filename,
      metadata
    });

    res.json(result);
  } catch (error) {
    console.error('Remote upload error:', error);
    
    if (error.message?.includes('timeout')) {
      return res.status(504).json({
        error: 'Timeout downloading from remote URL'
      });
    }
    
    if (error.message?.includes('not found') || error.status === 404) {
      return res.status(502).json({
        error: 'Remote file not found'
      });
    }

    res.status(500).json({
      error: 'Internal server error during remote upload'
    });
  }
});

module.exports = router;
