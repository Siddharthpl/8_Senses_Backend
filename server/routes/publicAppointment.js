const express = require("express");
const router = express.Router();

const {
  submitPublicAppointment,
  checkPublicAppointmentStatus,
  getPublicAppointmentRequests,
  getPublicAppointment,
} = require("../controllers/publicAppointmentController");

const { protect, authorize } = require("../middleware/auth");

// Public routes (no authentication required)
router.post("/submit", submitPublicAppointment);
router.get("/status/:id", checkPublicAppointmentStatus);

// Protected routes (authentication required)
router.get("/", protect, authorize("admin", "receptionist", "therapist"), getPublicAppointmentRequests);
router.get("/:id", protect, authorize("admin", "receptionist", "therapist"), getPublicAppointment);

module.exports = router; 