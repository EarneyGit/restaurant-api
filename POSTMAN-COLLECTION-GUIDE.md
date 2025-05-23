# Restaurant API - Complete Postman Collection Guide

## Overview

This comprehensive Postman collection includes all API modules for the Restaurant Management System with sample payloads and automated testing scripts.

## Collection Structure

The collection is organized into 11 main modules:

1. **Authentication** - User registration, login, password management (Updated Flow)
2. **Branch Management** - Restaurant branch operations with outlet settings management (Enhanced)
3. **Cart Management** - Shopping cart functionality
4. **Category Management** - Product category operations
5. **Order Management** - Order processing and tracking
6. **Product Management** - Menu item management
7. **Report Management** - Comprehensive analytics and reporting (Enhanced)
8. **Reservation Management** - Table reservation system
9. **User Management** - User account operations
10. **Role Management** - User role and permission system
11. **Ordering Times Management** - Daily scheduling, closed dates, and order restrictions (New)

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

## Enhanced Branch Management with Outlet Settings

The branch management module has been extended with comprehensive outlet settings management capabilities:

### Core Branch Operations (7 endpoints):
- **Get All Branches**: List all branches with role-based filtering
- **Get Branch by ID**: Retrieve specific branch details
- **Create Branch**: Create new branch with full outlet configuration
- **Update Branch**: Modify general branch properties
- **Get Branches in Radius**: Location-based branch search
- **Update Branch Settings**: Modify service enablement flags
- **Delete Branch**: Remove branch with validation checks

### Outlet Settings Management (5 new endpoints):

#### 1. Get Outlet Settings
- **Endpoint**: `GET /api/branches/:id/outlet-settings`
- **Purpose**: Retrieve complete outlet configuration
- **Access**: Private/Admin/Manager (managers can only access their branch)
- **Returns**: Formatted outlet data matching frontend interface

#### 2. Update Outlet Details
- **Endpoint**: `PUT /api/branches/:id/outlet-details`
- **Purpose**: Update basic outlet information
- **Fields**: name, aboutUs (rich text), email, contactNumber, telephone
- **Access**: Admin/Manager only (staff cannot update)

#### 3. Update Outlet Location
- **Endpoint**: `PUT /api/branches/:id/outlet-location`
- **Purpose**: Update address and location details
- **Fields**: street, addressLine2, city, county, state, postcode, country
- **Access**: Admin/Manager only

#### 4. Update Outlet Ordering Options
- **Endpoint**: `PUT /api/branches/:id/outlet-ordering-options`
- **Purpose**: Configure ordering time display and slot settings
- **Fields**: 
  - collection: displayFormat (TimeOnly/DateAndTime), timeslotLength
  - delivery: displayFormat (TimeOnly/DateAndTime), timeslotLength
- **Access**: Admin/Manager only

#### 5. Update Outlet Pre-Ordering
- **Endpoint**: `PUT /api/branches/:id/outlet-pre-ordering`
- **Purpose**: Enable/disable pre-ordering for different service types
- **Fields**: allowCollectionPreOrders, allowDeliveryPreOrders
- **Access**: Admin/Manager only

### New Branch Model Fields:
- **aboutUs**: Rich text description (up to 2000 characters)
- **address.addressLine2**: Additional address line
- **address.county**: County/region field
- **contact.telephone**: Additional telephone number
- **openingTimes**: Frontend-compatible opening hours format
- **orderingOptions**: Display and timing configuration for collection/delivery
- **preOrdering**: Pre-order enablement flags

### Role-Based Access Control:
- **Admin**: Full access to all branches and settings
- **Manager**: Can only modify their assigned branch settings (except critical properties)
- **Staff**: Read-only access to their branch, cannot update settings
- **Public**: Limited access to active branches only

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

### 2. Branch Management (12 endpoints) - **Enhanced**
- **Core Operations**: CRUD operations for restaurant branches
- **Location Services**: Location-based search and settings management
- **Outlet Settings**: Complete outlet configuration management
  - Details management (name, about, contact info)
  - Location management (address, geographic details)
  - Ordering options (display format, timeslots)
  - Pre-ordering settings (collection/delivery enablement)
- **Role-Based Access**: Admin, Manager, Staff permissions
- **Data Validation**: Field validation and business rules

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

### 11. Ordering Times Management (12 endpoints) - **New Module**

This module manages the complete ordering schedule system for each branch, including:

#### Core Functionality:
- **Daily Ordering Times**: Configure ordering availability for Collection, Delivery, and Table Ordering for each day of the week
- **Closed Dates Management**: Manage single dates and date ranges when the outlet is closed
- **Order Restrictions**: Set order volume limits during specific time windows
- **Availability Checking**: Public endpoint to check if ordering is allowed at specific times

#### Key Features:
- **Flexible Scheduling**: Different times for different order types (collection vs delivery vs table ordering)
- **Lead Times**: Configure preparation time for each order type
- **Custom Times**: Override default times for delivery and table ordering per day
- **Holiday Management**: Single dates (Christmas) or ranges (Christmas week)
- **Order Volume Control**: Limit orders during peak times with configurable window sizes
- **Real-time Validation**: Check availability before placing orders

#### 11.1 Weekly Schedule Management (4 endpoints):

**Get Ordering Times**
- **Endpoint**: `GET /api/ordering-times/:branchId`
- **Purpose**: Retrieve complete ordering schedule for a branch
- **Access**: Private/Admin/Manager (managers limited to their branch)
- **Returns**: Full weekly schedule, closed dates, and restrictions

**Update Weekly Schedule**
- **Endpoint**: `PUT /api/ordering-times/:branchId/weekly-schedule`
- **Purpose**: Update complete weekly ordering schedule
- **Access**: Admin/Manager only (staff cannot update)
- **Features**: Bulk update all 7 days with different settings per day

**Update Day Schedule**
- **Endpoint**: `PUT /api/ordering-times/:branchId/day/:dayName`
- **Purpose**: Update ordering settings for a specific day
- **Access**: Admin/Manager only
- **Parameters**: dayName (monday, tuesday, wednesday, thursday, friday, saturday, sunday)

#### Day Schedule Structure:
```json
{
  "isCollectionAllowed": true,
  "isDeliveryAllowed": true,
  "isTableOrderingAllowed": false,
  "defaultTimes": {
    "start": "11:45",
    "end": "21:50"
  },
  "collection": {
    "leadTime": 20,
    "displayedTime": "12:10"
  },
  "delivery": {
    "useDifferentTimes": true,
    "leadTime": 45,
    "displayedTime": "12:30",
    "customTimes": {
      "start": "12:00",
      "end": "22:00"
    }
  },
  "tableOrdering": {
    "useDifferentTimes": false,
    "leadTime": 0,
    "displayedTime": "",
    "customTimes": {
      "start": "11:45",
      "end": "21:50"
    }
  }
}
```

#### 11.2 Closed Dates Management (5 endpoints):

**Get Closed Dates**
- **Endpoint**: `GET /api/ordering-times/:branchId/closed-dates`
- **Purpose**: Retrieve future closed dates
- **Features**: Automatically filters past dates, supports both single dates and ranges

**Add Single Closed Date**
- **Endpoint**: `POST /api/ordering-times/:branchId/closed-dates`
- **Payload**: `{ "date": "2024-12-25", "type": "single", "reason": "Christmas Day" }`

**Add Date Range Closed**
- **Endpoint**: `POST /api/ordering-times/:branchId/closed-dates`
- **Payload**: `{ "date": "2024-12-24", "endDate": "2024-12-26", "type": "range", "reason": "Christmas Holiday Period" }`

**Delete Closed Date**
- **Endpoint**: `DELETE /api/ordering-times/:branchId/closed-dates/:closedDateId`

**Delete All Closed Dates**
- **Endpoint**: `DELETE /api/ordering-times/:branchId/closed-dates`

#### 11.3 Order Restrictions Management (2 endpoints):

**Get Order Restrictions**
- **Endpoint**: `GET /api/ordering-times/:branchId/restrictions`
- **Purpose**: Retrieve current order volume restrictions

**Update Order Restrictions**
- **Endpoint**: `PUT /api/ordering-times/:branchId/restrictions`
- **Purpose**: Configure order volume limits
- **Types**: 
  - "None" - No restrictions
  - "Combined Total" - Single limit for all order types
  - "Split Total" - Separate limits for collection and delivery

#### Restriction Structure:
```json
{
  "restrictions": {
    "type": "Split Total",
    "collection": {
      "friday": {
        "enabled": true,
        "orderTotal": 900,
        "windowSize": 5
      }
    },
    "delivery": {
      "friday": {
        "enabled": true,
        "orderTotal": 600,
        "windowSize": 10
      }
    }
  }
}
```

#### 11.4 Availability Checking (1 endpoint):

**Check Ordering Availability**
- **Endpoint**: `POST /api/ordering-times/:branchId/check-availability`
- **Purpose**: Public endpoint to validate if ordering is allowed
- **Access**: Public (no authentication required)
- **Payload**: `{ "orderType": "collection", "date": "2024-01-15", "time": "12:30" }`
- **Returns**: `{ "available": true/false, "reason": "explanation" }`

#### Use Cases:
1. **Restaurant Configuration**: Set different operating hours for collection vs delivery
2. **Holiday Management**: Close for Christmas, New Year, or special events
3. **Peak Hour Management**: Limit order volume during busy periods
4. **Customer Experience**: Real-time availability checking before order placement
5. **Staff Planning**: Different lead times based on order complexity

#### Role-Based Security:
- **Admin**: Full access to all branches and settings
- **Manager**: Can only modify their assigned branch settings
- **Staff**: Read-only access to their branch schedule
- **Public**: Can check availability only

#### Frontend Integration:
The data structures exactly match the frontend ordering-times module interfaces:
- `DaySettings` interface for daily configurations
- `ClosedDate` interface for holiday management
- `RestrictionDaySettings` for order volume control
- Real-time availability validation for order flow

### Testing Sequence for Ordering Times:
1. **Get Ordering Times** - Retrieve current configuration
2. **Update Weekly Schedule** - Configure multiple days at once
3. **Update Day Schedule** - Fine-tune specific day settings
4. **Add Closed Dates** - Set holiday periods
5. **Update Restrictions** - Configure order volume limits
6. **Check Availability** - Validate order placement

## Testing Workflow

### Complete User Journey:
1. **Authentication**:
   - Send OTP → Verify OTP → Complete Registration
   - Login to get authentication token

2. **Setup**:
   - Create Roles → Create Branches → Create Categories → Create Products

3. **Operations**:
   - Add items to cart → Place orders → Make reservations

4. **Management**:
   - Configure outlet settings → Update location → Set ordering options → Configure ordering times

5. **Analytics**:
   - View dashboard summary → Generate reports → Export data

### Outlet Settings Testing Sequence:
1. **Get Outlet Settings** - Retrieve current configuration
2. **Update Outlet Details** - Modify basic information
3. **Update Outlet Location** - Change address details
4. **Update Ordering Options** - Configure timeslots and display
5. **Update Pre-Ordering** - Enable/disable pre-order features

### Report Testing Sequence:
1. **Dashboard Summary** - Get current metrics
2. **End of Night** - Check daily performance
3. **Sales History** - Review transactions
4. **Item Sales** - Analyze product performance
5. **Discount History** - Track promotions
6. **Outlet Reports** - Branch-specific data
7. **Custom Reports** - Specialized analytics

### Ordering Times Testing Sequence:
1. **Get Ordering Times** - Retrieve current configuration
2. **Update Weekly Schedule** - Configure multiple days at once
3. **Update Day Schedule** - Fine-tune specific day settings
4. **Add Closed Dates** - Set holiday periods
5. **Update Restrictions** - Configure order volume limits
6. **Check Availability** - Validate order placement

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

### Comprehensive Outlet Management
- **Frontend Integration**: Data structures match frontend requirements exactly
- **Role-Based Security**: Admin, Manager, Staff access controls
- **Field Validation**: Comprehensive input validation and business rules
- **Rich Text Support**: About Us field supports HTML content
- **Flexible Configuration**: Ordering options and pre-ordering settings

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

### Outlet Settings Issues:
1. **Permission Denied**: Check user role and branch assignment
2. **Validation Errors**: Verify field formats and requirements
3. **Branch Not Found**: Ensure valid branchId in environment

### Report Issues:
1. **No Data**: Check date ranges and filters
2. **Performance**: Use pagination for large datasets
3. **Missing Filters**: Ensure required parameters are provided

### General Issues:
1. **Server Connection**: Verify `baseUrl` and server status
2. **Variable Missing**: Check environment variable population
3. **Permission Denied**: Ensure proper authentication token

This comprehensive collection provides complete testing coverage for your Restaurant API with enhanced authentication security, detailed outlet management, and comprehensive reporting capabilities. 