const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const appointmentController = require("../controllers/appointmentController");


// Regular appointment management
router.route("/")
  .get(protect, authorize("admin", "receptionist", "therapist"), appointmentController.getAppointments)
 

// Single appointment operations 
router.route("/:id")
  .get(protect, authorize("admin", "receptionist", "therapist"), appointmentController.getAppointment);

// Update appointment status (completed, cancelled, etc.)
router.put("/:id/status", protect, authorize("admin", "receptionist", "therapist"), appointmentController.updateAppointmentStatus);

// Filtered appointment views
router.get("/therapist/:therapistId", protect, authorize("admin", "receptionist", "therapist"), appointmentController.getTherapistAppointments);
router.get("/patient/:patientId", protect, authorize("admin", "receptionist", "therapist"), appointmentController.getPatientAppointments);

// Patient registration and appointment scheduling
router.post("/register-patient", 
  protect, 
  authorize("admin", "receptionist"), 
  appointmentController.registerPatientAndSchedule
);

// Register patient only (without scheduling an appointment) - "Register for Later" button
router.post("/register-patient-only",
  protect,
  authorize("admin", "receptionist"),
  appointmentController.registerPatientOnly
);

// Schedule appointment for existing patient
router.post("/schedule-existing/:patientId",
  protect,
  authorize("admin", "receptionist"),
  appointmentController.scheduleExistingPatient
);

module.exports = router;
