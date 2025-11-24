const express = require('express');
const File = require('../models/File');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/upload', authMiddleware, async (req, res) => {
  try {
    const { receiverId, fileName, fileSize, mimeType, encryptedData, iv, authTag } = req.body;

    if (!receiverId || !fileName || !fileSize || !mimeType || !encryptedData || !iv || !authTag) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const file = new File({
      senderId: req.userId,
      receiverId,
      fileName,
      fileSize,
      mimeType,
      encryptedData,
      iv,
      authTag,
      timestamp: new Date()
    });

    await file.save();

    logger.info(`File uploaded from ${req.userId} to ${receiverId}: ${fileName}`);

    res.status(201).json({
      message: 'File uploaded successfully',
      fileId: file._id,
      timestamp: file.timestamp
    });
  } catch (error) {
    logger.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.get('/list/:userId', authMiddleware, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const files = await File.find({
      $or: [
        { senderId: req.userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: req.userId }
      ]
    })
    .sort({ timestamp: -1 })
    .select('senderId receiverId fileName fileSize mimeType timestamp');

    res.json({ files });
  } catch (error) {
    logger.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

router.get('/download/:fileId', authMiddleware, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.fileId,
      $or: [
        { senderId: req.userId },
        { receiverId: req.userId }
      ]
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      encryptedData: file.encryptedData,
      iv: file.iv,
      authTag: file.authTag,
      timestamp: file.timestamp
    });
  } catch (error) {
    logger.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

module.exports = router;
