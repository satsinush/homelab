import express, { Request, Response } from 'express';
import WordGamesController from '../controllers/wordGamesController';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();
const wordGamesController = new WordGamesController();

/**
 * @openapi
 * tags:
 *   name: WordGames
 *   description: Solvers and helpers for popular word and puzzle games
 */

// Word games status endpoint (check if executable is available)
/**
 * @openapi
 * /api/wordgames/status:
 *   get:
 *     summary: Verify availability of wordgames backend engine
 *     tags: [WordGames]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Status payload
 */
router.get('/wordgames/status', requireAuth('dashboard-wordgames-user'), (req: Request, res: Response) => wordGamesController.getStatus(req, res));

// Letter Boxed solver endpoint
/**
 * @openapi
 * /api/wordgames/letterboxed:
 *   post:
 *     summary: Solve NYT Letter Boxed puzzle
 *     tags: [WordGames]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sides
 *             properties:
 *               sides:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Solutions payload
 */
router.post('/wordgames/letterboxed', requireAuth('dashboard-wordgames-user'), (req: Request, res: Response) => wordGamesController.solveLetterBoxed(req, res));

// Spelling Bee solver endpoint
/**
 * @openapi
 * /api/wordgames/spellingbee:
 *   post:
 *     summary: Solve NYT Spelling Bee puzzle
 *     tags: [WordGames]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - centerLetter
 *               - outerLetters
 *             properties:
 *               centerLetter:
 *                 type: string
 *               outerLetters:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Solutions payload
 */
router.post('/wordgames/spellingbee', requireAuth('dashboard-wordgames-user'), (req: Request, res: Response) => wordGamesController.solveSpellingBee(req, res));

// Wordle solver endpoint
/**
 * @openapi
 * /api/wordgames/wordle:
 *   post:
 *     summary: Solve Wordle puzzle
 *     tags: [WordGames]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guesses:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Solutions payload
 */
router.post('/wordgames/wordle', requireAuth('dashboard-wordgames-user'), (req: Request, res: Response) => wordGamesController.solveWordle(req, res));

// Mastermind solver endpoint
/**
 * @openapi
 * /api/wordgames/mastermind:
 *   post:
 *     summary: Solve Mastermind board game
 *     tags: [WordGames]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Next guess recommendation
 */
router.post('/wordgames/mastermind', requireAuth('dashboard-wordgames-user'), (req: Request, res: Response) => wordGamesController.solveMastermind(req, res));

// Dungleon solver endpoint
/**
 * @openapi
 * /api/wordgames/dungleon:
 *   post:
 *     summary: Solve Dungleon puzzle
 *     tags: [WordGames]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Recommendations payload
 */
router.post('/wordgames/dungleon', requireAuth('dashboard-wordgames-user'), (req: Request, res: Response) => wordGamesController.solveDungleon(req, res));

// Hangman solver endpoint
/**
 * @openapi
 * /api/wordgames/hangman:
 *   post:
 *     summary: Solve Hangman word puzzle
 *     tags: [WordGames]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pattern
 *             properties:
 *               pattern:
 *                 type: string
 *               guesses:
 *                 type: string
 *     responses:
 *       200:
 *         description: Next letter recommendation
 */
router.post('/wordgames/hangman', requireAuth('dashboard-wordgames-user'), (req: Request, res: Response) => wordGamesController.solveHangman(req, res));

// Load results from file (pagination) - supports all game types
/**
 * @openapi
 * /api/wordgames/load:
 *   post:
 *     summary: Load paginate results history of games
 *     tags: [WordGames]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Page data payload
 */
router.post('/wordgames/load', requireAuth('dashboard-wordgames-user'), (req: Request, res: Response) => wordGamesController.loadResults(req, res));

export default router;
