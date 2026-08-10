import { Request, Response } from 'express';
import { WordGamesContext } from './shared';
import { solveLetterBoxed } from './games/letterBoxed';
import { solveSpellingBee } from './games/spellingBee';
import { solveWordle } from './games/wordle';
import { solveMastermind } from './games/mastermind';
import { solveHangman } from './games/hangman';
import { solveDungleon } from './games/dungleon';
import { loadResults } from './loadResults';

class WordGamesController {
    private ctx: WordGamesContext;

    constructor() {
        this.ctx = new WordGamesContext();
    }

    async solveLetterBoxed(req: Request, res: Response) {
        return solveLetterBoxed(this.ctx, req, res);
    }

    async solveSpellingBee(req: Request, res: Response) {
        return solveSpellingBee(this.ctx, req, res);
    }

    async solveWordle(req: Request, res: Response) {
        return solveWordle(this.ctx, req, res);
    }

    async solveMastermind(req: Request, res: Response) {
        return solveMastermind(this.ctx, req, res);
    }

    async solveDungleon(req: Request, res: Response) {
        return solveDungleon(this.ctx, req, res);
    }

    async solveHangman(req: Request, res: Response) {
        return solveHangman(this.ctx, req, res);
    }

    async loadResults(req: Request, res: Response) {
        return loadResults(this.ctx, req, res);
    }

    async getStatus(req: Request, res: Response) {
        return this.ctx.getStatus(req, res);
    }

    async cancelSolve(req: Request, res: Response) {
        return this.ctx.cancelSolve(req, res);
    }
}

export default WordGamesController;
