const express = require('express');
const documentsRouter = require('./routes/documents');
const completeUploadRouter = require('./uploads/completeRoute');
const extractRouter = require('./extraction/extractRoute');
const chatRouter = require('./chat/chatRoute');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/documents', documentsRouter);
app.use('/documents', completeUploadRouter);
app.use('/documents', extractRouter);
app.use('/documents', chatRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
