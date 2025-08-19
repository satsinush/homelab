const express = require('express');
const WordGamesController = require('../controllers/wordGamesController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const wordGamesController = new WordGamesController();

// Word games status endpoint (check if executable is available)
router.get('/wordgames/status', requireAuth('admin'), (req, res) => wordGamesController.getStatus(req, res));

// Letter Boxed solver endpoint
router.post('/wordgames/letterboxed', requireAuth('admin'), (req, res) => wordGamesController.solveLetterBoxed(req, res));

// Spelling Bee solver endpoint
router.post('/wordgames/spellingbee', requireAuth('admin'), (req, res) => wordGamesController.solveSpellingBee(req, res));

// Read results from temp file (pagination)
router.post('/wordgames/read', requireAuth('admin'), (req, res) => wordGamesController.readResults(req, res));

module.exports = router;
