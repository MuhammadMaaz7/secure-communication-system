const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    logger.error('Email transporter verification failed:', error);
  } else {
    logger.info('Email service is ready to send messages');
  }
});

const EmailService = {
  // Send 2FA code via email
  async send2FACode(email, code, username) {
    try {
      const mailOptions = {
        from: `"SecureChat" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your SecureChat 2FA Code',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e88e5 0%, #1976d2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .code-box { background: white; border: 2px solid #1e88e5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .code { font-size: 32px; font-weight: bold; color: #1e88e5; letter-spacing: 5px; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔒 SecureChat</h1>
                <p>Two-Factor Authentication</p>
              </div>
              <div class="content">
                <h2>Hello ${username}!</h2>
                <p>You requested a 2FA code to log in to your SecureChat account.</p>
                
                <div class="code-box">
                  <p style="margin: 0; color: #666; font-size: 14px;">Your verification code is:</p>
                  <div class="code">${code}</div>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Valid for 10 minutes</p>
                </div>

                <div class="warning">
                  <strong>⚠️ Security Notice:</strong>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Never share this code with anyone</li>
                    <li>SecureChat will never ask for this code via email or phone</li>
                    <li>If you didn't request this code, please secure your account immediately</li>
                  </ul>
                </div>

                <p style="color: #666; font-size: 14px;">
                  This code will expire in <strong>10 minutes</strong>. If you didn't request this code, you can safely ignore this email.
                </p>
              </div>
              <div class="footer">
                <p>This is an automated message from SecureChat</p>
                <p>End-to-End Encrypted Messaging</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello ${username}!

Your SecureChat 2FA verification code is: ${code}

This code will expire in 10 minutes.

Security Notice:
- Never share this code with anyone
- SecureChat will never ask for this code via email or phone
- If you didn't request this code, please secure your account immediately

This is an automated message from SecureChat.
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`2FA code sent to ${email}, messageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Failed to send 2FA email:', error);
      throw new Error('Failed to send verification code');
    }
  },

  // Send 2FA enabled notification
  async send2FAEnabledNotification(email, username) {
    try {
      const mailOptions = {
        from: `"SecureChat" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Two-Factor Authentication Enabled',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✓ 2FA Enabled</h1>
              </div>
              <div class="content">
                <h2>Hello ${username}!</h2>
                <div class="success-box">
                  <strong>Two-Factor Authentication has been enabled on your account.</strong>
                </div>
                <p>Your SecureChat account is now protected with an additional layer of security.</p>
                <p>From now on, you'll need to enter a verification code sent to this email address when logging in.</p>
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  If you didn't enable 2FA, please contact support immediately.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await transporter.sendMail(mailOptions);
      logger.info(`2FA enabled notification sent to ${email}`);
    } catch (error) {
      logger.error('Failed to send 2FA enabled notification:', error);
    }
  },

  // Send email verification code during registration
  async sendEmailVerification(email, code) {
    try {
      const mailOptions = {
        from: `"SecureChat" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - SecureChat',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1e88e5 0%, #1976d2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .code-box { background: white; border: 2px solid #1e88e5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .code { font-size: 32px; font-weight: bold; color: #1e88e5; letter-spacing: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔒 Welcome to SecureChat!</h1>
                <p>Verify Your Email Address</p>
              </div>
              <div class="content">
                <h2>Almost there!</h2>
                <p>To complete your registration, please verify your email address by entering this code:</p>
                
                <div class="code-box">
                  <p style="margin: 0; color: #666; font-size: 14px;">Your verification code is:</p>
                  <div class="code">${code}</div>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Valid for 10 minutes</p>
                </div>

                <p style="color: #666; font-size: 14px;">
                  If you didn't create an account with SecureChat, you can safely ignore this email.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Welcome to SecureChat!

Your email verification code is: ${code}

This code will expire in 10 minutes.

If you didn't create an account with SecureChat, you can safely ignore this email.
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      
      // Check if email was rejected
      if (info.rejected && info.rejected.length > 0) {
        logger.error(`Email verification rejected for ${email}: ${info.rejected.join(', ')}`);
        throw new Error('Invalid email address - email was rejected');
      }
      
      // Check if email was accepted
      if (info.accepted && info.accepted.length > 0) {
        logger.info(`Email verification code sent to ${email}, messageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } else {
        logger.error(`Email verification failed for ${email} - no accepted recipients`);
        throw new Error('Email could not be delivered');
      }
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      
      // Provide more specific error information
      if (error.code === 'EAUTH') {
        throw new Error('Email service authentication failed');
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        throw new Error('Email service is temporarily unavailable');
      } else if (error.responseCode === 550 || error.response?.includes('550')) {
        throw new Error('Invalid email address - account does not exist');
      } else if (error.message?.includes('rejected') || error.message?.includes('Invalid email')) {
        throw new Error('Invalid email address');
      } else {
        throw new Error('Failed to send verification code');
      }
    }
  },

  // Send 2FA disabled notification
  async send2FADisabledNotification(email, username) {
    try {
      const mailOptions = {
        from: `"SecureChat" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Two-Factor Authentication Disabled',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ 2FA Disabled</h1>
              </div>
              <div class="content">
                <h2>Hello ${username}!</h2>
                <div class="warning-box">
                  <strong>Two-Factor Authentication has been disabled on your account.</strong>
                </div>
                <p>Your account security level has been reduced. We recommend keeping 2FA enabled for maximum protection.</p>
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  If you didn't disable 2FA, please secure your account immediately.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await transporter.sendMail(mailOptions);
      logger.info(`2FA disabled notification sent to ${email}`);
    } catch (error) {
      logger.error('Failed to send 2FA disabled notification:', error);
    }
  },
};

module.exports = EmailService;
