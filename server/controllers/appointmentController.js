const Appointment = require("../models/Appointment");
const PublicAppointment = require("../models/PublicAppointment");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Service = require("../models/Service");
const { body, validationResult } = require("express-validator");
const { sendEmail } = require("../config/email");


// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private (Admin, Therapist, Receptionist)
exports.getAppointments = async (req, res) => {
  try {
    let query = {};

    // If user is a therapist, only show their appointments
    if (req.user.role === "therapist") {
      query.doctorId = req.user._id;
    }

    // Allow filtering by status, date range, patient, or therapist
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.patientId) {
      query.patientId = req.query.patientId;
    }

    if (req.query.therapistId && req.user.role !== "therapist") {
      query.doctorId = req.query.therapistId;
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
        path: "patientId",
        select: "childName dateOfBirth gender",
      })
      .populate({
        path: "doctorId",
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
        path: "patientId",
        select: "childName dateOfBirth gender emergencyContact",
      })
      .populate({
        path: "doctorId",
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
      appointment.doctorId._id.toString() !== req.user._id.toString()
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
    .isDate().withMessage("Please provide a valid date"),

  body('status')
    .optional()
    .isIn(["scheduled", "completed", "cancelled", "no_show"])
    .withMessage("Invalid appointment status")
];

// @desc    Save appointment as draft
// @route   POST /api/appointments/save-later
// @access  Private (Admin/Receptionist)
exports.saveAppointmentAsDraft = async (req, res, next) => {
  try {
    const appointmentData = {
      ...req.body,
      isDraft: true,
      status: "scheduled"
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
    const patientId = req.body.patientId;
    
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

    // Check if doctor exists if provided
    if (req.body.doctorId) {
      const doctor = await User.findById(req.body.doctorId);
      if (!doctor || doctor.role !== "therapist") {
        return res.status(404).json({
          success: false,
          error: "Doctor not found",
        });
      }
    }

    // Prepare appointment data
    const appointmentData = {
      ...req.body,
      status: req.body.doctorId ? "scheduled" : "scheduled",
      
      // If doctor assigned, mark as confirmed
      ...(req.body.doctorId && {
        confirmedBy: req.user._id,
        confirmedAt: new Date()
      }),
      createdBy: req.user._id
    };

    // Create the appointment
    const appointment = await Appointment.create(appointmentData);

    // Return response
    res.status(201).json({
      success: true,
      message: appointment.status === "scheduled" 
        ? "Appointment confirmed" 
        : "Appointment scheduled",
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

    // Validate status
    if (!["scheduled", "completed", "cancelled", "no_show"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid appointment status. Must be one of: scheduled, completed, cancelled, no_show",
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
    
    // Add additional info if cancelling
    if (status === "cancelled") {
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = req.user._id;
      appointment.cancellationReason = req.body.reason || "Not specified";
    } else if (status === "completed") {
      appointment.completedAt = new Date();
      appointment.completedBy = req.user._id;
    } else if (status === "no_show") {
      appointment.noShowAt = new Date();
      appointment.noShowBy = req.user._id;
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
      doctorId: req.params.therapistId,
    })
      .populate({
        path: "patientId",
        select: "childName dateOfBirth gender",
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
      patientId: req.params.patientId,
    })
      .populate({
        path: "doctorId",
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

// @desc    Register patient and optionally schedule appointment (Receptionist)
// @route   POST /api/appointments/register-patient
// @access  Private (Admin, Receptionist)
exports.registerPatientAndSchedule = async (req, res) => {
  try {
    const {
      // Child's Information
      childName,
      childDOB,
      childGender,
      childPhoto,
      birthCertificate,
      
      // Parent's Information
      parentName,
      contactNumber,
      email,
      parentPhoto,
      address,
      aadharCard,
      
      // Appointment Details (optional)
      scheduleAppointment,
      serviceType,
      date,
      timeSlot,
      doctorId,
      primaryConcern,
      documents
    } = req.body;

    // Validate required fields
    if (!childName || !childDOB || !childGender || !parentName || !contactNumber || !email || !address) {
      return res.status(400).json({
        success: false,
        error: "Missing required patient information fields"
      });
    }

    // Validate appointment fields if scheduling
    if (scheduleAppointment && (!serviceType || !date || !timeSlot || !primaryConcern)) {
      return res.status(400).json({
        success: false,
        error: "Missing required appointment fields"
      });
    }

    // Create patient record
    const patient = await Patient.create({
      childName: childName,
      childDOB: childDOB,
      childGender: childGender,
      childPhoto: childPhoto || '',
      birthCertificate: birthCertificate || '',
      parentName,
      contactNumber,
      email,
      address,
      aadharCard: aadharCard || '',
      parentPhoto: parentPhoto || ''
    });

    // If scheduleAppointment is true, create appointment
    if (scheduleAppointment) {
      // Check doctor availability if a doctor is assigned
      if (doctorId) {
        const existingAppointment = await Appointment.findOne({
          doctorId,
          date,
          timeSlot,
          status: { $ne: "cancelled" }
        });

        if (existingAppointment) {
        return res.status(400).json({
          success: false,
            error: "Doctor is not available at this time slot",
            data: { patient }
        });
      }
    }

      const appointment = await Appointment.create({
        patientId: patient._id,
        doctorId,
        serviceType,
        date,
        timeSlot,
        status: "scheduled",
        primaryConcern,
        documents: documents || [],
        notes: `New patient registered by ${req.user.firstName} ${req.user.lastName}`,
        createdBy: req.user._id
      });

      // Send confirmation email to parent if email functionality is available
      try {
        const emailSubject = `Appointment Confirmation for ${childName}`;
        const emailMessage = `
          <h2>Appointment Confirmation</h2>
          <p>Dear ${parentName},</p>
          <p>Your appointment for ${childName} has been scheduled.</p>
          <p><strong>Appointment Details:</strong></p>
          <ul>
            <li><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</li>
            <li><strong>Time:</strong> ${timeSlot}</li>
            <li><strong>Service:</strong> ${serviceType}</li>
            <li><strong>Primary Concern:</strong> ${primaryConcern}</li>
          </ul>
          <p>Please arrive 15 minutes before your scheduled time.</p>
          <p>Best regards,<br>8 Senses Clinic</p>
        `;

        if (typeof sendEmail === 'function') {  
          await sendEmail({
            to: email,
            subject: emailSubject,
            html: emailMessage
          });
        } else {
          console.log('Email function not available');
        }
      } catch (emailError) {
        console.error('Error sending appointment confirmation email:', emailError);
      }

      return res.status(201).json({
        success: true,
        message: "Patient registered and appointment scheduled successfully",
        data: {
          patient,
          appointment
        }
      });
    }

    // If no appointment scheduling, just return patient data
    return res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      data: {
        patient
      }
    });

  } catch (err) {
    console.error('Error in registerPatientAndSchedule:', err);
    
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    } else if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Patient with this email already exists"
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Server Error"
      });
    }
  }
};

// @desc    Schedule appointment for existing patient
// @route   POST /api/appointments/schedule-existing/:patientId
// @access  Private (Admin, Receptionist)
exports.scheduleExistingPatient = async (req, res) => {
  try {
    const {
      serviceType,
      date,
      timeSlot,
      doctorId,
      primaryConcern,
      documents
    } = req.body;

    const patientId = req.params.patientId;

    // Validate required fields
    if (!patientId || !serviceType || !date || !timeSlot || !doctorId || !primaryConcern) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Patient not found"
      });
    }

    // Check if doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "therapist") {
      return res.status(404).json({
        success: false,
        error: "Doctor not found"
      });
    }

    // Check doctor availability
    const existingAppointment = await Appointment.findOne({
      doctorId,
      date,
      timeSlot,
      status: { $ne: "cancelled" }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        error: "Doctor is not available at this time slot"
      });
    }

    // Create appointment
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      serviceType,
      date,
      timeSlot,
      status: "scheduled",
      primaryConcern,
      documents: documents || [],
      notes: `Appointment scheduled by ${req.user.firstName} ${req.user.lastName}`,
      createdBy: req.user._id
    });

    // Send confirmation email
    const emailSubject = `Appointment Confirmation for ${patient.childName}`;
    const emailMessage = `
      <h2>Appointment Confirmation</h2>
      <p>Dear ${patient.parentName},</p>
      <p>Your appointment for ${patient.childName} has been scheduled.</p>
      <p><strong>Appointment Details:</strong></p>
      <ul>
        <li><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${timeSlot}</li>
        <li><strong>Service:</strong> ${serviceType}</li>
        <li><strong>Primary Concern:</strong> ${primaryConcern}</li>
        <li><strong>Status:</strong> Scheduled</li>
      </ul>
      <p>Please arrive 15 minutes before your scheduled time.</p>
      <p>Best regards,<br>8 Senses Clinic</p>
    `;

    try {
      if (typeof sendEmail === 'function') {
        await sendEmail({
          to: patient.email,
          subject: emailSubject,
          html: emailMessage
        });
      }
    } catch (emailError) {
      console.error('Error sending appointment confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: "Appointment scheduled successfully",
      data: appointment
    });

  } catch (err) {
    console.error('Error in scheduleExistingPatient:', err);
    res.status(500).json({
      success: false,
      error: "Server Error"
    });
  }
};

// @desc    Register patient only (without scheduling an appointment)
// @route   POST /api/appointments/register-patient-only
// @access  Private (Admin, Receptionist)
exports.registerPatientOnly = async (req, res) => {
  try {
    const {
      // Child's Information
      childName,
      childDOB,
      childGender,
      childPhoto,
      birthCertificate,
      
      // Parent's Information
      parentName,
      contactNumber,
      email,
      parentPhoto,
      address,
      aadharCard
    } = req.body;

    // Validate required fields
    if (!childName || !childDOB || !childGender || !parentName || !contactNumber || !email || !address) {
      return res.status(400).json({
      success: false,
        error: "Missing required fields"
      });
    }

    // Validate and convert date
    const dateOfBirth = new Date(childDOB);
    if (isNaN(dateOfBirth.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date of birth format. Please use YYYY-MM-DD format."
      });
    }

    // Create patient record
    const patient = await Patient.create({
      childName: childName,
      childDOB: childDOB,
      childGender: childGender,
      childPhoto: childPhoto || '',
      birthCertificate: birthCertificate || '',
      parentName,
      contactNumber,
      email,
      address,
      aadharCard: aadharCard || '',
      parentPhoto: parentPhoto || ''
    });

    return res.status(201).json({
      success: true,
      message: "Patient registered successfully. You can schedule an appointment for this patient later.",
      data: {
        patient
      }
    });

  } catch (err) {
    console.error('Error in registerPatientOnly:', err);
    
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return res.status(400).json({
      success: false,
        error: messages,
      });
    } else if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Patient with this email already exists"
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Server Error"
      });
    }
  }
};
