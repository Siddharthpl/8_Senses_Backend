const AppointmentForm = require('../models/AppointmentForm');
const { sendEmail } = require('../config/email');

// Submit appointment form
exports.submitAppointmentForm = async (req, res) => {
  try {
    const {
      motherName,
      fatherName,
      childName,
      contactNumber,
      email,
      childAge,
      serviceType,
      preferredDate,
      preferredTime,
      specialNeeds,
      paymentMethod
    } = req.body;

    // Create new appointment form entry
    const appointmentForm = await AppointmentForm.create({
      motherName,
      fatherName,
      childName,
      contactNumber,
      email,
      childAge,
      serviceType,
      preferredDate,
      preferredTime,
      specialNeeds,
      paymentMethod
    });

    // Check if email credentials are configured
    if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
      console.error('Email credentials not configured');
      return res.status(201).json({
        success: true,
        message: 'Appointment request submitted successfully. Email notifications are disabled due to missing email configuration.',
        data: appointmentForm
      });
    }

    // Send email to receptionist
    const receptionistEmail = process.env.RECEPTIONIST_EMAIL;
    if (!receptionistEmail) {
      console.error('Receptionist email not configured');
    } else {
      try {
        const receptionistEmailContent = `
          <h2>New Appointment Request</h2>
          <p><strong>Mother's Name:</strong> ${motherName}</p>
          <p><strong>Father's Name:</strong> ${fatherName}</p>
          <p><strong>Child's Name:</strong> ${childName}</p>
          <p><strong>Contact Number:</strong> ${contactNumber}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Child's Age:</strong> ${childAge}</p>
          <p><strong>Service Type:</strong> ${serviceType}</p>
          <p><strong>Preferred Date:</strong> ${preferredDate}</p>
          <p><strong>Preferred Time:</strong> ${preferredTime}</p>
          <p><strong>Special Needs:</strong> ${specialNeeds || 'None specified'}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
        `;

        await sendEmail({
          to: receptionistEmail,
          subject: 'New Appointment Request',
          html: receptionistEmailContent
        });
        console.log('Receptionist email sent successfully');
      } catch (emailError) {
        console.error('Error sending receptionist email:', emailError);
      }
    }

    // Send confirmation email to user
    try {
      const userEmailContent = `
        <h2>Appointment Request Received</h2>
        <p>Dear ${motherName},</p>
        <p>Thank you for submitting your appointment request. We have received your details and will contact you shortly to confirm your appointment.</p>
        <p>Here are the details you submitted:</p>
        <ul>
          <li>Child's Name: ${childName}</li>
          <li>Service Type: ${serviceType}</li>
          <li>Preferred Date: ${preferredDate}</li>
          <li>Preferred Time: ${preferredTime}</li>
        </ul>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>The 8 Senses Team</p>
      `;

      await sendEmail({
        to: email,
        subject: 'Appointment Request Received',
        html: userEmailContent
      });
      console.log('User confirmation email sent successfully');
    } catch (emailError) {
      console.error('Error sending user confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Appointment request submitted successfully. You will receive a confirmation email shortly.',
      data: appointmentForm
    });

  } catch (error) {
    console.error('Error submitting appointment form:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting appointment form',
      error: error.message
    });
  }
};

// Get all appointment forms (for receptionist)
exports.getAllAppointmentForms = async (req, res) => {
  try {
    const appointmentForms = await AppointmentForm.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: appointmentForms
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment forms',
      error: error.message
    });
  }
};

// Update appointment form status
exports.updateAppointmentFormStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const appointmentForm = await AppointmentForm.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!appointmentForm) {
      return res.status(404).json({
        success: false,
        message: 'Appointment form not found'
      });
    }

    res.status(200).json({
      success: true,
      data: appointmentForm
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating appointment form status',
      error: error.message
    });
  }
}; 