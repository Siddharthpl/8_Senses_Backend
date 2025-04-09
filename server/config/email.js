const nodemailer = require("nodemailer");

/**
 * Send an email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text email body
 * @param {string} [options.html] - HTML email body
 * @returns {Promise<void>}
 */
const sendEmail = async (options) => {
  // Check if email credentials are set
  if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD || 
      process.env.EMAIL_USERNAME === 'your_email@gmail.com' || 
      process.env.EMAIL_PASSWORD === 'your_email_password') {
    console.log("Email configuration incomplete. Email not sent.");
    return; // Exit early if credentials not set
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      // 30 second timeout
      connectionTimeout: 30000,
    });

    // Create both HTML and text versions
    const mailOptions = {
      from: `8Senses Pediatric Therapy <${process.env.EMAIL_USERNAME}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || stripHtml(options.html), // Fallback text version
      html: options.html,
    };

    // Verify connection
    await transporter.verify().catch(err => {
      console.log("Email transporter verification failed:", err.message);
      throw err;
    });

    // Send email
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", options.to);
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error;
  }
};

// Helper function to create text version from HTML
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>?/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

module.exports = { sendEmail };