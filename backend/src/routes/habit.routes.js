import express from 'express';
import { verifyJWT } from '../middleware/auth.js';
import {
  getHabits,
  createHabit,
  getHabit,
  deleteHabit,
  createCheckIn,
  getTodayLocal,
} from '../controllers/habit.controller.js';

const router = express.Router();

// All habit routes require auth
router.use(verifyJWT);

router.get('/today-local', getTodayLocal);
router.get('/', getHabits);
router.post('/', createHabit);
router.get('/:id', getHabit);
router.delete('/:id', deleteHabit);
router.post('/:id/checkins', createCheckIn);

export default router;
