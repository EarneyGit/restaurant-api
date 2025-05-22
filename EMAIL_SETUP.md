# Email Setup for Restaurant API

This document provides instructions for setting up the email functionality used for OTP-based user registration and password reset.

## Environment Variables

Add the following variables to your `.env` file:

```
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Restaurant API <noreply@restaurant.com>
EMAIL_SECURE=false
```

## Gmail Configuration

If you're using Gmail as your email provider, follow these steps:

1. **Enable 2-Step Verification**:
   - Go to your Google Account
   - Navigate to Security
   - Enable 2-Step Verification

2. **Create App Password**:
   - Go to your Google Account
   - Navigate to Security
   - Under "Signing in to Google", select "App passwords"
   - Select app "Mail" and device "Other (Custom name)"
   - Name it "Restaurant API"
   - Copy the generated password and use it as `EMAIL_PASS` in your `.env` file

## Other Email Providers

For other email providers, update the `EMAIL_HOST` and `EMAIL_PORT` accordingly, and provide the proper credentials.

## Features Added

The API now includes:

1. **OTP-Based Registration**:
   - `POST /api/auth/register-init`: Initiates registration and sends OTP
   - `POST /api/auth/register-complete`: Validates OTP and completes registration

2. **Password Reset Flow**:
   - `POST /api/auth/forgot-password`: Sends OTP to email
   - `POST /api/auth/verify-reset-otp`: Validates OTP and issues temporary token
   - `POST /api/auth/reset-password/:resetToken`: Resets password using token

## API Documentation

### Registration Process

#### Step 1: Initiate Registration
```
POST /api/auth/register-init
Content-Type: application/json

{
  "name": "User Name",
  "email": "user@example.com"
}
```

#### Step 2: Complete Registration with OTP
```
POST /api/auth/register-complete
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "password": "securepassword",
  "phone": "1234567890",  // Optional
  "address": "User Address"  // Optional
}
```

### Password Reset Process

#### Step 1: Request Password Reset
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Step 2: Verify OTP
```
POST /api/auth/verify-reset-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

#### Step 3: Reset Password
```
POST /api/auth/reset-password/:resetToken
Content-Type: application/json

{
  "password": "newpassword",
  "confirmPassword": "newpassword"
}
``` 