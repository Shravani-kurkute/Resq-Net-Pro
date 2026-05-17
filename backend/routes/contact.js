const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// GET /api/contact — health check
router.get('/', (req, res) => res.json({ status: 'Contact API ready' }));

// POST /api/contact — send email notification
router.post('/', async (req, res) => {
    const { name, email, subject, message, type } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, error: 'Missing required fields: name, email, message' });
    }

    // Log submission
    console.log(`📬 Contact from ${name} (${email}) [${type || 'General'}]: ${subject}`);

    // If email credentials are configured, send a real email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            await transporter.sendMail({
                from: `"ResQNet Website" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_USER,
                replyTo: email,
                subject: `[ResQNet] ${subject || `New message from ${name}`}`,
                html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Type:</strong> ${type || 'General'}</p>
          <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
          <hr/>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        `,
            });

            return res.json({ success: true, message: 'Message sent! We\'ll get back to you within 24 hours.' });
        } catch (err) {
            console.error('Email error:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to send email.' });
        }
    }

    // No email credentials — just acknowledge
    res.json({ success: true, message: 'Message received! (Email not configured yet)' });
});

module.exports = router;
