# Restaurant API - Complete Postman Collection Guide

## Overview

This comprehensive Postman collection includes all API modules for the Restaurant Management System with sample payloads and automated testing scripts.

## Collection Structure

The collection is organized into 10 main modules:

1. **Authentication** - User registration, login, password management (Updated Flow)
2. **Branch Management** - Restaurant branch operations
3. **Cart Management** - Shopping cart functionality
4. **Category Management** - Product category operations
5. **Order Management** - Order processing and tracking
6. **Product Management** - Menu item management
7. **Report Management** - Comprehensive analytics and reporting (Enhanced)
8. **Reservation Management** - Table reservation system
9. **User Management** - User account operations
10. **Role Management** - User role and permission system

## Setup Instructions

### 1. Import Collection
1. Open Postman
2. Click **Import**
3. Select `restaurant-api-complete-collection.json`
4. The collection will be imported with all endpoints and sample payloads

### 2. Set Up Environment
Create a new environment with these variables:
- `baseUrl` = `http://localhost:5000` (or your server URL)
- `token` = (will be auto-populated after login)
- `sessionId` = (auto-generated for cart operations)
- `tempToken` = (auto-populated after OTP verification)
- `resetToken` = (auto-populated for password reset)
- `userId` = (auto-populated after registration/login)
- `productId` = (auto-populated after creating products)
- `categoryId` = (auto-populated after creating categories)
- `branchId` = (auto-populated after creating branches)
- `orderId` = (auto-populated after creating orders)
- `reservationId` = (auto-populated after creating reservations)
- `roleId` = (auto-populated after creating roles)

### 3. Server Setup
Ensure your Restaurant API server is running:
```bash
npm start
# Server should be running on http://localhost:5000
```

## Updated Authentication Flow

### Registration Flow:
```
1. Send OTP for Registration → Request OTP via email
2. Verify OTP → Verify OTP and get temporary token
3. Complete Registration → Register with temporary token and get login token
```

### Forgot Password Flow:
```
1. Send Forgot Password OTP → Request password reset OTP
2. Verify OTP → Verify OTP and get temporary token
3. Reset Password → Reset password with temporary token
```

### Login Flow:
```
1. Login → Standard email/password authentication
```

## Enhanced Reports Module

The reports module has been completely redesigned to match frontend requirements with 7 different report types:

### 1. Dashboard Summary
- **Endpoint**: `GET /api/reports/dashboard-summary`
- **Purpose**: Real-time metrics with period comparisons
- **Filters**: period (today, yesterday, week, month, year), branchId

### 2. End of Night Report
- **Endpoint**: `GET /api/reports/end-of-night` 
- **Purpose**: Daily sales summary with hourly breakdown
- **Filters**: date, branchId
- **Features**: Sales totals, payment methods, order types, top items

### 3. End of Month Report
- **Endpoint**: `GET /api/reports/end-of-month`
- **Purpose**: Monthly performance analysis
- **Filters**: month, year, branchId
- **Features**: Monthly summary, daily breakdown, top customers

### 4. Sales History
- **Endpoint**: `GET /api/reports/sales-history`
- **Purpose**: Detailed sales transactions
- **Filters**: startDate, endDate, branchId, pagination
- **Features**: Customer details, payment info, order types

### 5. Item Sales History
- **Endpoint**: `GET /api/reports/item-sales-history`
- **Purpose**: Product-wise sales analysis
- **Filters**: startDate, endDate, productId, categoryId, pagination
- **Features**: Quantity sold, revenue by item

### 6. Discount History
- **Endpoint**: `GET /api/reports/discount-history`
- **Purpose**: Discount usage tracking
- **Filters**: startDate, endDate, discountType, pagination
- **Features**: Customer details, discount values, types

### 7. Outlet Reports
- **Endpoint**: `GET /api/reports/outlet-reports`
- **Purpose**: Branch-specific performance
- **Filters**: branchId (required), period
- **Features**: Branch summary, order type breakdown, top products

### 8. Custom Reports
- **Endpoint**: `GET /api/reports/custom`
- **Purpose**: Specialized report types
- **Types**: 
  - `menu-category-totals` - Sales by product category
  - `daily-totals` - Day-by-day sales breakdown
  - `order-export` - Complete order data export

## Module Details

### 1. Authentication (9 endpoints)
- **New Flow**: Send OTP → Verify OTP → Complete Registration
- **Enhanced Security**: Database token validation, single-use tokens
- **Password Reset**: OTP-based secure reset process

**Key Variables Set:**
- `token` - JWT authentication token (24h)
- `tempToken` - Temporary token for registration/reset (10min)
- `resetToken` - Password reset token (10min)

### 2. Branch Management (7 endpoints)
- CRUD operations for restaurant branches
- Location-based search and settings management

### 3. Cart Management (9 endpoints)
- Guest and authenticated user support
- Product customization with options and special requirements
- Cart merging on login

### 4. Category Management (7 endpoints)
- Menu category operations with hierarchy support

### 5. Order Management (7 endpoints)
- Complete order lifecycle management
- Status tracking and customer history

### 6. Product Management (9 endpoints)
- Menu item management with stock control
- Product recommendations and analytics

### 7. Report Management (10 endpoints) - **Enhanced**
- **Dashboard Summary**: Real-time metrics with comparisons
- **End of Night**: Daily closing reports
- **End of Month**: Monthly performance analysis
- **Sales History**: Transaction-level details
- **Item Sales**: Product performance tracking
- **Discount History**: Promotion usage analysis
- **Outlet Reports**: Branch-specific insights
- **Custom Reports**: Specialized analytics (3 types)

### 8. Reservation Management (6 endpoints)
- Table booking system with status management

### 9. User Management (5 endpoints)
- User account operations and profile management

### 10. Role Management (5 endpoints)
- Permission-based access control

## Testing Workflow

### Complete User Journey:
1. **Authentication**:
   - Send OTP → Verify OTP → Complete Registration
   - Login to get authentication token

2. **Setup**:
   - Create Roles → Create Branches → Create Categories → Create Products

3. **Operations**:
   - Add items to cart → Place orders → Make reservations

4. **Analytics**:
   - View dashboard summary → Generate reports → Export data

### Report Testing Sequence:
1. **Dashboard Summary** - Get current metrics
2. **End of Night** - Check daily performance
3. **Sales History** - Review transactions
4. **Item Sales** - Analyze product performance
5. **Discount History** - Track promotions
6. **Outlet Reports** - Branch-specific data
7. **Custom Reports** - Specialized analytics

## Environment Variables Reference

| Variable | Purpose | Auto-populated |
|----------|---------|----------------|
| `baseUrl` | API server URL | No |
| `token` | Login JWT token (24h) | Yes (login/register) |
| `tempToken` | Temporary token (10min) | Yes (OTP verification) |
| `resetToken` | Password reset token | Yes (password reset OTP) |
| `sessionId` | Guest cart session | Yes (auto-generated) |
| `userId` | Current user ID | Yes (auth) |
| `productId` | Sample product ID | Yes (create product) |
| `categoryId` | Sample category ID | Yes (create category) |
| `branchId` | Sample branch ID | Yes (create branch) |
| `orderId` | Sample order ID | Yes (create order) |
| `reservationId` | Sample reservation ID | Yes (create reservation) |
| `roleId` | Sample role ID | Yes (create role) |

## Key Features

### Enhanced Security
- **Database Token Validation**: All tokens verified against database
- **Single-Use OTPs**: Prevent replay attacks
- **Automatic Cleanup**: Expired tokens/OTPs auto-removed
- **JWT + Database**: Dual validation for maximum security

### Comprehensive Reporting
- **Frontend-Compatible**: Data structures match frontend interfaces
- **Flexible Filtering**: Date ranges, branches, categories, pagination
- **Performance Metrics**: Comparisons, trends, breakdowns
- **Export Ready**: Structured data for CSV/Excel export

### Automated Testing
- **Response Validation**: Time limits, JSON structure checks
- **Variable Capture**: Automatic ID and token extraction
- **Error Scenarios**: Invalid data testing capabilities

## Troubleshooting

### Authentication Issues:
1. **Invalid OTP**: Check OTP expiration (10 minutes)
2. **Token Expired**: Re-login or verify OTP again
3. **Invalid Token**: Ensure token is properly captured in environment

### Report Issues:
1. **No Data**: Check date ranges and filters
2. **Performance**: Use pagination for large datasets
3. **Missing Filters**: Ensure required parameters are provided

### General Issues:
1. **Server Connection**: Verify `baseUrl` and server status
2. **Variable Missing**: Check environment variable population
3. **Permission Denied**: Ensure proper authentication token

This comprehensive collection provides complete testing coverage for your Restaurant API with enhanced authentication security and detailed reporting capabilities. 