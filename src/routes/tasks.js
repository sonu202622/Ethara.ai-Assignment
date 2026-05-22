const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');

const taskValidation = [
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Task title must be 2-200 characters'),
  body('project_id').isInt({ min: 1 }).withMessage('Valid project ID required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']).withMessage('Invalid status'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('Invalid date format')
];

router.get('/', authenticate, taskController.getTasks);
router.get('/:id', authenticate, taskController.getTask);
router.post('/', authenticate, taskValidation, taskController.createTask);
router.put('/:id', authenticate, taskController.updateTask);
router.patch('/:id/status', authenticate, taskController.updateTaskStatus);
router.delete('/:id', authenticate, taskController.deleteTask);

// Comments
router.post('/:id/comments', authenticate, taskController.addComment);
router.delete('/:id/comments/:commentId', authenticate, taskController.deleteComment);

module.exports = router;
