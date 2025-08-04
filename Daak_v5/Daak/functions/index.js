const functions = require("firebase-functions");
const nodemailer = require("nodemailer");

// 🔐 Use config set by `firebase functions:config:set gmail.email="" gmail.password=""`
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;

// Nodemailer transporter using Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword
  }
});

// Panic email function
exports.sendPanicEmail = functions.https.onCall(async (data, context) => {
  const { toEmail, locationLink } = data;

  const mailOptions = {
    from: `Daak App <${gmailEmail}>`,
    to: toEmail,
    subject: "🚨 Panic Alert from Daak!",
    html: `
      <h2>🚨 Someone triggered a Panic Alert!</h2>
      <p>The user may be in danger and has shared their location.</p>
      <p><strong>Location:</strong> <a href="${locationLink}" target="_blank">${locationLink}</a></p>
      <p>Please try to contact them immediately.</p>
      <br>
      <p>— Daak Emergency Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending panic email:", error);
    return { success: false, error: error.message };
  }
});
