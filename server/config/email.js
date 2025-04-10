const nodemailer = require("nodemailer");

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content (optional)
 */
const sendEmail = async (options) => {
  try {
    // Check if email credentials are configured
    if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
      console.error('Email credentials not configured');
      return;
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      },
      // Add connection timeout
      connectionTimeout: 30000,
      // Add socket timeout
      socketTimeout: 30000
    });

    // Verify transporter connection
    try {
      await transporter.verify();
      console.log('Email server connection verified');
    } catch (error) {
      console.error('Error verifying email server connection:', error);
      return;
    }

    // Create mail options
    const mailOptions = {
      from: `8Senses Pediatric Therapy <${process.env.EMAIL_USERNAME}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html)
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Convert HTML to plain text
 * @param {string} html - HTML content
 * @returns {string} Plain text content
 */
const stripHtml = (html) => {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

console.log('Email function exists?', typeof sendEmail === 'function');

module.exports = { sendEmail };