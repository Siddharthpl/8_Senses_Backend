const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  addPatientNote,
  addPatientAssessment,
  createPatientValidation,
  updatePatientValidation,
  addNoteValidation,
  addAssessmentValidation,
  updatePatientPhoto,
  updateBirthCertificate,
  updateParentPhoto,
  addMedicalRecord,
  updateAadharCard,
} = require("../controllers/patientController");
const { validateRequest } = require("../middleware/validationMiddleware");
const Patient = require("../models/Patient");

const router = express.Router();

// Apply protection and admin/therapist/receptionist authorization to all routes
router.use(protect, authorize("admin", "therapist", "receptionist"));

// GET /api/patients - Get all patients
router.route("/").get(getPatients);

// POST /api/patients - Create a new patient
router
  .route("/register")
  .post(createPatientValidation, validateRequest, createPatient);

// GET /api/patients/:id - Get single patient
// PUT /api/patients/:id - Update patient
// DELETE /api/patients/:id - Delete patient
router
  .route("/:id")
  .get(getPatient)
  .put(updatePatientValidation, validateRequest, updatePatient)
  .delete(deletePatient);

// POST /api/patients/:id/notes - Add a note to patient (admin and therapist only)
router
  .route("/:id/notes")
  .post(
    authorize("admin", "therapist"),
    addNoteValidation,
    validateRequest,
    addPatientNote
  )
  .get(async (req, res, next) => {
    try {
      const patient = await Patient.findById(req.params.id);

      if (!patient) {
        return res.status(404).json({
          success: false,
          error: "Patient not found",
        });
      }

      res.status(200).json({
        success: true,
        data: patient.therapistNotes,
      });
    } catch (err) {
      next(err);
    }
  });

// POST /api/patients/:id/assessments - Add an assessment to patient (admin and therapist only)
router
  .route("/:id/assessments")
  .post(
    authorize("admin", "therapist"),
    addAssessmentValidation,
    validateRequest,
    addPatientAssessment
  )
  .get(async (req, res, next) => {
    try {
      const patient = await Patient.findById(req.params.id);

      if (!patient) {
        return res.status(404).json({
          success: false,
          error: "Patient not found",
        });
      }

      res.status(200).json({
        success: true,
        data: patient.assessments,
      });
    } catch (err) {
      next(err);
    }
  });

// Document upload routes
router.route("/:id/photo").put(updatePatientPhoto);
router.route("/:id/birth-certificate").put(updateBirthCertificate);
router.route("/:id/aadhar-card").put(updateAadharCard);
router.route("/:id/parent-photo").put(updateParentPhoto);
router.route("/:id/medical-records").post(addMedicalRecord);

module.exports = router;
