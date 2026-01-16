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

// Wordle solver endpoint
router.post('/wordgames/wordle', requireAuth('admin'), (req, res) => wordGamesController.solveWordle(req, res));

// Mastermind solver endpoint
router.post('/wordgames/mastermind', requireAuth('admin'), (req, res) => wordGamesController.solveMastermind(req, res));

// Dungleon solver endpoint
router.post('/wordgames/dungleon', requireAuth('admin'), (req, res) => wordGamesController.solveDungleon(req, res));

// Hangman solver endpoint
router.post('/wordgames/hangman', requireAuth('admin'), (req, res) => wordGamesController.solveHangman(req, res));

// Load results from file (pagination) - supports all game types
router.post('/wordgames/load', requireAuth('admin'), (req, res) => wordGamesController.loadResults(req, res));

module.exports = router;
