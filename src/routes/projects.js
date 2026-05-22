const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate, requireAdmin, requireProjectAccess, requireProjectAdmin } = require('../middleware/auth');

const projectValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Project name must be 2-100 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('status').optional().isIn(['active', 'completed', 'archived', 'on_hold']).withMessage('Invalid status')
];

router.get('/', authenticate, projectController.getProjects);
router.get('/:id', authenticate, requireProjectAccess, projectController.getProject);
router.post('/', authenticate, projectValidation, projectController.createProject);
router.put('/:id', authenticate, requireProjectAccess, requireProjectAdmin, projectValidation, projectController.updateProject);
router.delete('/:id', authenticate, requireAdmin, projectController.deleteProject);

// Members
router.post('/:id/members', authenticate, requireProjectAccess, requireProjectAdmin, projectController.addMember);
router.delete('/:id/members/:userId', authenticate, requireProjectAccess, requireProjectAdmin, projectController.removeMember);

module.exports = router;
