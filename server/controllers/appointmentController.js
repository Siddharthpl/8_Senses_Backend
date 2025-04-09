const Appointment = require("../models/Appointment");
const PublicAppointment = require("../models/PublicAppointment");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Service = require("../models/Service");
const { body, validationResult } = require("express-validator");


// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private (Admin, Therapist, Receptionist)
exports.getAppointments = async (req, res) => {
  try {
    let query = {};

    // If user is a therapist, only show their appointments
    if (req.user.role === "therapist") {
      query.assignedTherapist = req.user._id;
    }

    // Allow filtering by status, date range, patient, or therapist
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.patientId) {
      query["patient.patientId"] = req.query.patientId;
    }

    if (req.query.therapistId && req.user.role !== "therapist") {
      query.assignedTherapist = req.query.therapistId;
    }

    if (req.query.startDate && req.query.endDate) {
      query.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    } else if (req.query.startDate) {
      query.date = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      query.date = { $lte: new Date(req.query.endDate) };
    }

    const appointments = await Appointment.find(query)
      .populate({
        path: "patient.patientId",
        select: "firstName lastName dateOfBirth gender",
      })
      .populate({
        path: "assignedTherapist",
        select: "firstName lastName",
        model: "User",
      })
      .sort({ date: 1, timeSlot: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
exports.getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({
        path: "patient.patientId",
        select: "firstName lastName dateOfBirth gender emergencyContact",
      })
      .populate({
        path: "assignedTherapist",
        select: "firstName lastName email phone",
        model: "User",
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Check if user has permission to view this appointment
    if (
      req.user.role !== "admin" &&
      req.user.role !== "receptionist" &&
      appointment.assignedTherapist._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view this appointment",
      });
    }

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Validation for receptionist-side appointment creation
exports.validateAppointment = [
  // If registering a new patient
  body('patient.childName')
    .if(body('patient.patientId').not().exists())
    .notEmpty().withMessage("Child's name is required"),
  
  body('patient.childDOB')
    .if(body('patient.patientId').not().exists())
    .notEmpty().withMessage("Child's date of birth is required")
    .isDate().withMessage("Please provide a valid date of birth"),
  
  body('patient.childGender')
    .if(body('patient.patientId').not().exists())
    .notEmpty().withMessage("Child's gender is required")
    .isIn(["male", "female", "other"]).withMessage("Invalid gender selection"),
  
  body('parentInfo.parentName')
    .if(body('patient.patientId').not().exists())
    .notEmpty().withMessage("Parent/guardian name is required"),
  
  body('parentInfo.contactNumber')
    .if(body('patient.patientId').not().exists())
    .notEmpty().withMessage("Contact number is required"),
  
  body('parentInfo.address')
    .if(body('patient.patientId').not().exists())
    .notEmpty().withMessage("Address is required"),
  
  body('serviceType')
    .notEmpty().withMessage("Service type is required")
    .isIn(["assessment", "therapy", "consultation", "follow-up", "other"])
    .withMessage("Invalid service type"),
  
  body('medicalInfo.primaryConcern')
    .notEmpty().withMessage("Primary concern is required"),
  
  body('date')
    .notEmpty().withMessage("Appointment date is required")
    .isDate().withMessage("Please provide a valid date")
];

// @desc    Save appointment as draft
// @route   POST /api/appointments/save-later
// @access  Private (Admin/Receptionist)
exports.saveAppointmentAsDraft = async (req, res, next) => {
  try {
    const appointmentData = {
      ...req.body,
      isDraft: true,
      status: "requested"
    };

    const draft = await Appointment.create(appointmentData);

    res.status(201).json({
      success: true,
      message: "Appointment saved as draft",
      data: draft,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create appointment by receptionist
// @route   POST /api/appointments
// @access  Private (Admin, Receptionist)
exports.createAppointment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    // Determine if this is for a registered patient or new patient
    const patientId = req.body.patient?.patientId;
    
    // If patientId provided, verify the patient exists
    if (patientId) {
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          error: "Patient not found",
        });
      }
    }
    
    // Check if therapist exists if provided
    if (req.body.assignedTherapist) {
      const therapist = await User.findById(req.body.assignedTherapist);
      if (!therapist || therapist.role !== "therapist") {
        return res.status(404).json({
          success: false,
          error: "Therapist not found",
        });
      }
    }

    // Prepare appointment data
    const appointmentData = {
      ...req.body,
      status: req.body.assignedTherapist ? "confirmed" : "requested",
      
      // If therapist assigned, mark as confirmed
      ...(req.body.assignedTherapist && {
        confirmedBy: req.user._id,
        confirmedAt: new Date()
      })
    };

    // Create the appointment
    const appointment = await Appointment.create(appointmentData);

    // Return response
    res.status(201).json({
      success: true,
      message: appointment.status === "confirmed" 
        ? "Appointment confirmed" 
        : "Appointment requested",
      data: appointment,
    });
  } catch (err) {
    console.error("Error creating appointment:", err);
    
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    } else if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: `Invalid ${err.path}: ${err.value}`,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Server Error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined
      });
    }
  }
};

// @desc    Convert public appointment request to formal appointment
// @route   PUT /api/appointments/convert-public/:id
// @access  Private (Admin, Receptionist)
exports.convertPublicAppointment = async (req, res) => {
  try {
    // Find the public appointment
    const publicAppointment = await PublicAppointment.findById(req.params.id);

    if (!publicAppointment) {
      return res.status(404).json({
        success: false,
        error: "Public appointment request not found",
      });
    }

    // Check if already converted
    if (publicAppointment.convertedToAppointmentId) {
      return res.status(400).json({
        success: false,
        error: "This public appointment has already been converted",
      });
    }

    const {
      assignedTherapist,
      timeSlot,
      serviceType,
      patientId,
      paymentAmount,
      paymentMethod,
      notes
    } = req.body;

    // Validate therapist
    if (!assignedTherapist) {
      return res.status(400).json({
        success: false,
        error: "Therapist assignment is required",
      });
    }
    
    const therapist = await User.findById(assignedTherapist);
    if (!therapist || therapist.role !== "therapist") {
      return res.status(404).json({
        success: false,
        error: "Therapist not found",
      });
    }

    // Check therapist availability
    const existingAppointment = await Appointment.findOne({
      assignedTherapist,
      date: publicAppointment.date,
      timeSlot,
      status: { $nin: ["cancelled", "no_show"] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        error: "Therapist is not available at this time slot",
      });
    }
    
    // Create appointment data
    const appointmentData = {
      serviceType: serviceType || publicAppointment.serviceType,
      date: publicAppointment.date,
      timeSlot: timeSlot || publicAppointment.preferredTime,
      status: "confirmed",
      assignedTherapist,
      notes: notes || "",
      
      // Link to patient if provided, otherwise create new patient info
      patient: patientId ? {
        patientId
      } : {
        childName: publicAppointment.childName,
        childGender: req.body.childGender || "other", // Required field
        childDOB: req.body.childDOB || new Date() // Required field, would need to be specified
      },
      
      // Parent info
      parentInfo: patientId ? {} : {
        parentName: `${publicAppointment.motherName} & ${publicAppointment.fatherName}`,
        contactNumber: publicAppointment.contactNumber,
        email: publicAppointment.email,
        address: req.body.address || "To be updated" // Required field
      },
      
      // Medical info
      medicalInfo: {
        primaryConcern: req.body.primaryConcern || "From public appointment request",
        documents: []
      },
      
      // Payment info
      payment: {
        amount: paymentAmount || 0,
        method: paymentMethod || publicAppointment.paymentMethod,
        status: "pending"
      },
      
      // Reference to the source public appointment
      convertedFromPublicId: publicAppointment._id,
      
      // Confirmed by
      confirmedBy: req.user._id,
      confirmedAt: new Date()
    };
    
    // Create the formal appointment
    const formalAppointment = await Appointment.create(appointmentData);
    
    // Update the public appointment with a reference to the formal appointment
    publicAppointment.status = "confirmed";
    publicAppointment.assignedTherapist = assignedTherapist;
    publicAppointment.timeSlot = timeSlot;
    publicAppointment.confirmedBy = req.user._id;
    publicAppointment.confirmedAt = new Date();
    publicAppointment.convertedToAppointmentId = formalAppointment._id;
    await publicAppointment.save();
    
    // Populate therapist info for the response
    await formalAppointment.populate({
      path: "assignedTherapist",
      select: "firstName lastName email phone",
    });
    
    // Send response
    res.status(200).json({
      success: true,
      data: formalAppointment,
      message: "Public appointment has been converted to a formal appointment successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private (Admin, Therapist, Receptionist)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment not found",
      });
    }

    // Update status
    appointment.status = status;
    
    // Add additional info if completing or cancelling
    if (status === "completed") {
      appointment.completedAt = new Date();
      appointment.completedBy = req.user._id;
    } else if (status === "cancelled") {
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = req.user._id;
      appointment.cancellationReason = req.body.reason || "Not specified";
    }

    await appointment.save();

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// Additional exports

// @desc    Get therapist's appointments
// @route   GET /api/appointments/therapist/:therapistId
// @access  Private (Admin, Therapist, Receptionist)
exports.getTherapistAppointments = async (req, res) => {
  try {
    // If user is a therapist, they can only see their own appointments
    if (req.user.role === "therapist" && req.params.therapistId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to view other therapists' appointments",
      });
    }

    const appointments = await Appointment.find({
      assignedTherapist: req.params.therapistId,
    })
      .populate({
        path: "patient.patientId",
        select: "firstName lastName dateOfBirth gender",
      })
      .sort({ date: 1, timeSlot: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

// @desc    Get patient's appointments
// @route   GET /api/appointments/patient/:patientId
// @access  Private (Admin, Therapist, Receptionist)
exports.getPatientAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({
      "patient.patientId": req.params.patientId,
    })
      .populate({
        path: "assignedTherapist",
        select: "firstName lastName",
      })
      .sort({ date: -1, timeSlot: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};
