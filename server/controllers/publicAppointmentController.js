const asyncHandler = require("express-async-handler");
const PublicAppointment = require("../models/PublicAppointment");
const Therapist = require("../models/Therapist");
const ErrorResponse = require("../utils/errorResponse");
const { sendEmail } = require("../config/email");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { body, validationResult } = require("express-validator");

/**
 * @desc    Validate public appointment request data
 * @route   POST /api/appointments/public
 * @access  Public
 */
exports.validatePublicAppointment = [
  body("motherName")
    .notEmpty()
    .withMessage("Mother's name is required")
    .trim(),
  body("fatherName")
    .notEmpty()
    .withMessage("Father's name is required")
    .trim(),
  body("childName")
    .notEmpty()
    .withMessage("Child's name is required")
    .trim(),
  body("contactNumber")
    .notEmpty()
    .withMessage("Contact number is required")
    .trim(),
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .trim(),
  body("childAge")
    .notEmpty()
    .withMessage("Child's age group is required")
    .trim(),
  body("serviceType")
    .notEmpty()
    .withMessage("Service type is required")
    .isIn(["assessment", "therapy", "consultation", "follow-up", "other"])
    .withMessage("Invalid service type"),
  body("preferredTime")
    .notEmpty()
    .withMessage("Preferred time is required")
    .trim(),
  body("preferredDate")
    .notEmpty()
    .withMessage("Preferred date is required")
    .isDate()
    .withMessage("Please provide a valid date"),
  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["credit_card", "debit_card", "cash", "online_transfer"])
    .withMessage("Invalid payment method")
];

/**
 * @desc    Submit a public appointment request
 * @route   POST /api/appointments/public
 * @access  Public
 */
exports.submitPublicAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const appointment = await PublicAppointment.create(req.body);

    // Try to send emails, but continue if fails
    try {
      // Check if email credentials are set
      if (process.env.EMAIL_USERNAME && process.env.EMAIL_USERNAME !== 'your_email@gmail.com') {
        // Send confirmation email to client
        await sendEmail({
          to: appointment.email,
          subject: "Appointment Request Received - 8Senses Pediatric Therapy",
          html: `
            <h2>Thank you for your appointment request!</h2>
            <p>Dear ${appointment.motherName} & ${appointment.fatherName},</p>
            <p>We have received your appointment request for ${appointment.childName}. Here are the details:</p>
            <ul>
              <li>Service Type: ${appointment.serviceType}</li>
              <li>Preferred Date: ${appointment.preferredDate.toLocaleDateString()}</li>
              <li>Preferred Time: ${appointment.preferredTime}</li>
              <li>Child's Age: ${appointment.childAge}</li>
            </ul>
            <p>Our team will review your request and get back to you shortly. You can check the status of your request using your request ID: ${appointment._id}</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>8Senses Pediatric Therapy Team</p>
          `,
        });

        // Send notification to staff
        const staffEmail = process.env.STAFF_NOTIFICATION_EMAIL || 'staff@8senses.com';
        await sendEmail({
          to: staffEmail,
          subject: "New Appointment Request Received",
          html: `
            <h2>New Appointment Request</h2>
            <p>A new appointment request has been submitted:</p>
            <ul>
              <li>Request ID: ${appointment._id}</li>
              <li>Child's Name: ${appointment.childName}</li>
              <li>Parents: ${appointment.motherName} & ${appointment.fatherName}</li>
              <li>Contact: ${appointment.contactNumber}</li>
              <li>Email: ${appointment.email}</li>
              <li>Service Type: ${appointment.serviceType}</li>
              <li>Preferred Date: ${appointment.preferredDate.toLocaleDateString()}</li>
              <li>Preferred Time: ${appointment.preferredTime}</li>
              <li>Child's Age: ${appointment.childAge}</li>
              <li>Special Needs: ${appointment.specialNeeds || 'None specified'}</li>
              <li>Payment Method: ${appointment.paymentMethod}</li>
            </ul>
            <p>Please review and process this request at your earliest convenience.</p>
          `,
        });
      } else {
        console.log("Email credentials not properly configured - skipping email notifications");
      }
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      data: appointment,
      message: "Appointment request submitted successfully.",
    });
  } catch (err) {
    console.error("Error submitting appointment:", err);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

/**
 * @desc    Check status of a public appointment request
 * @route   GET /api/appointments/public/status/:id
 * @access  Public
 */
exports.checkPublicAppointmentStatus = async (req, res) => {
  try {
    const appointment = await PublicAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment request not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        status: appointment.status,
        appointmentId: appointment._id,
        convertedToAppointmentId: appointment.convertedToAppointmentId,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

/**
 * @desc    Get all public appointment requests
 * @route   GET /api/appointments/public-requests
 * @access  Private/Admin
 */
exports.getPublicAppointmentRequests = async (req, res) => {
  try {
    const appointments = await PublicAppointment.find()
      .sort({ createdAt: -1 });

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

/**
 * @desc    Get a single public appointment request
 * @route   GET /api/appointments/public/:id
 * @access  Private/Admin
 */
exports.getPublicAppointment = async (req, res) => {
  try {
    const appointment = await PublicAppointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: "Appointment request not found",
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

// Helper function to get status message
const getStatusMessage = (status) => {
  switch (status) {
    case "pending":
      return "Your appointment request is pending review.";
    case "confirmed":
      return "Your appointment has been confirmed.";
    case "converted":
      return "Your appointment has been processed and added to our system.";
    case "cancelled":
      return "Your appointment request has been cancelled.";
    case "rejected":
      return "We're sorry, but we are unable to accommodate your appointment request at this time.";
    default:
      return "Status unknown. Please contact our office for more information.";
  }
};

// Utility function to send confirmation email to client
const sendAppointmentRequestConfirmation = async (appointmentRequest) => {
  try {
    const message = {
      to: appointmentRequest.email,
      subject: "Your Appointment Request Confirmation - 8 Senses",
      text: `Dear ${appointmentRequest.firstName},
      
Thank you for requesting an appointment with 8 Senses. This email confirms that we have received your request for ${appointmentRequest.serviceType} on ${new Date(appointmentRequest.preferredDate).toLocaleDateString()} at ${appointmentRequest.preferredTime}.

Your appointment request ID is: ${appointmentRequest._id}

Our team will review your request and get back to you within 24-48 hours. You can check the status of your request anytime by visiting our website and entering your request ID.

If you have any questions, please don't hesitate to contact us.

Thank you,
The 8 Senses Team`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a6eb5;">Appointment Request Confirmation</h2>
        <p>Dear ${appointmentRequest.firstName},</p>
        <p>Thank you for requesting an appointment with 8 Senses. This email confirms that we have received your request.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Service Type:</strong> ${appointmentRequest.serviceType}</p>
          <p><strong>Preferred Date:</strong> ${new Date(appointmentRequest.preferredDate).toLocaleDateString()}</p>
          <p><strong>Preferred Time:</strong> ${appointmentRequest.preferredTime}</p>
          <p><strong>Request ID:</strong> ${appointmentRequest._id}</p>
        </div>
        
        <p>Our team will review your request and get back to you within 24-48 hours. You can check the status of your request anytime by visiting our website and entering your request ID.</p>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
        
        <p>Thank you,<br>The 8 Senses Team</p>
      </div>
      `
    };

    await sendEmail(message);
  } catch (error) {
    console.error("Error sending appointment request confirmation email:", error);
  }
};

// Utility function to notify staff about new appointment request
const notifyStaffNewAppointmentRequest = async (appointmentRequest) => {
  try {
    // Get admin and receptionist emails
    const staffUsers = await User.find({
      role: { $in: ["admin", "receptionist"] }
    }).select("email");

    if (staffUsers.length === 0) {
      console.log("No admin or receptionist users found to notify");
      return;
    }

    const staffEmails = staffUsers.map(user => user.email);

    const message = {
      to: staffEmails,
      subject: "New Appointment Request - 8 Senses",
      text: `A new appointment request has been submitted.
      
Request ID: ${appointmentRequest._id}
Client: ${appointmentRequest.firstName} ${appointmentRequest.lastName}
Email: ${appointmentRequest.email}
Phone: ${appointmentRequest.phone}
Service: ${appointmentRequest.serviceType}
Preferred Date: ${new Date(appointmentRequest.preferredDate).toLocaleDateString()}
Preferred Time: ${appointmentRequest.preferredTime}

Please log in to the admin dashboard to review this request.`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a6eb5;">New Appointment Request</h2>
        <p>A new appointment request has been submitted to 8 Senses.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Request ID:</strong> ${appointmentRequest._id}</p>
          <p><strong>Client:</strong> ${appointmentRequest.firstName} ${appointmentRequest.lastName}</p>
          <p><strong>Email:</strong> ${appointmentRequest.email}</p>
          <p><strong>Phone:</strong> ${appointmentRequest.phone}</p>
          <p><strong>Service:</strong> ${appointmentRequest.serviceType}</p>
          <p><strong>Preferred Date:</strong> ${new Date(appointmentRequest.preferredDate).toLocaleDateString()}</p>
          <p><strong>Preferred Time:</strong> ${appointmentRequest.preferredTime}</p>
        </div>
        
        <p>Please log in to the admin dashboard to review this request.</p>
      </div>
      `
    };

    await sendEmail(message);
  } catch (error) {
    console.error("Error sending staff notification email:", error);
  }
}; 