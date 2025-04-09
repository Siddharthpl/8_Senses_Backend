const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const appointmentController = require("../controllers/appointmentController");
const publicAppointmentController = require("../controllers/publicAppointmentController");

// ===== PUBLIC APPOINTMENT ROUTES (NO AUTH REQUIRED) =====
// Submit a public appointment request
router.post("/public/submit", publicAppointmentController.submitPublicAppointment);
// Check status of a public appointment request
router.get("/public/status/:id", publicAppointmentController.checkPublicAppointmentStatus);

// ===== PROTECTED ROUTES (AUTH REQUIRED) =====

// Public appointment management - Admin/Receptionist only
router.get("/public", protect, authorize("admin", "receptionist"), publicAppointmentController.getPublicAppointmentRequests);
router.get("/public/:id", protect, authorize("admin", "receptionist"), publicAppointmentController.getPublicAppointment);
// Convert public appointment to formal appointment
router.put("/convert-public/:id", protect, authorize("admin", "receptionist"), appointmentController.convertPublicAppointment);

// Regular appointment management
router.route("/")
  .get(protect, authorize("admin", "receptionist", "therapist"), appointmentController.getAppointments)
  .post(protect, authorize("admin", "receptionist"), appointmentController.validateAppointment, appointmentController.createAppointment);

// Save appointment draft
router.post("/save-later", protect, authorize("admin", "receptionist"), appointmentController.saveAppointmentAsDraft);

// Single appointment operations
router.route("/:id")
  .get(protect, authorize("admin", "receptionist", "therapist"), appointmentController.getAppointment);

// Update appointment status (completed, cancelled, etc.)
router.put("/:id/status", protect, authorize("admin", "receptionist", "therapist"), appointmentController.updateAppointmentStatus);

// Filtered appointment views
router.get("/therapist/:therapistId", protect, authorize("admin", "receptionist", "therapist"), appointmentController.getTherapistAppointments);
router.get("/patient/:patientId", protect, authorize("admin", "receptionist", "therapist"), appointmentController.getPatientAppointments);

module.exports = router;
