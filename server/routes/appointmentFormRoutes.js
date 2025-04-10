const express = require('express');
const router = express.Router();
const {
  submitAppointmentForm,
  getAllAppointmentForms,
  updateAppointmentFormStatus
} = require('../controllers/appointmentFormController');
const { protect, authorize } = require('../middleware/auth');

// Public route for submitting appointment form
router.post('/', submitAppointmentForm);

// Protected routes for receptionist
router.get('/', protect, authorize('receptionist'), getAllAppointmentForms);
router.put('/:id/status', protect, authorize('receptionist'), updateAppointmentFormStatus);

module.exports = router; 