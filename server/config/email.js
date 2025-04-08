const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Create both HTML and text versions
  const mailOptions = {
    from: "Your App <yourapp@gmail.com>",
    to: options.email,
    subject: options.subject,
    text: options.text || stripHtml(options.html), // Fallback text version
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

// Helper function to create text version from HTML
function stripHtml(html) {
  return html
    .replace(/<[^>]*>?/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

module.exports = sendEmail;