# Customer Management API Documentation

## Overview

The Customer Management API provides endpoints to fetch and manage customer data based on orders. The system extracts unique customers from orders, ensuring no duplicate customers are returned even if they have multiple orders. This API is branch-based, meaning admin users can only access customers from their assigned branch.

## Key Features

- **Branch-based Access Control**: Admin users can only access customers from their assigned branch
- **Unique Customer Extraction**: Customers are extracted from orders, with no duplicates
- **Comprehensive Customer Data**: Includes order statistics, spending patterns, and customer classification
- **Advanced Filtering**: Filter by name, email, mobile, postcode, and more
- **Pagination Support**: Efficient pagination for large customer lists
- **Customer Statistics**: Dashboard-ready statistics for customer insights
- **Order History**: Detailed order history for individual customers

## Authentication

All endpoints require admin authentication (admin, manager, or staff roles).

```javascript
Headers: {
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
```

## API Endpoints

### 1. Get Customers

**Endpoint:** `GET /api/customers`
**Access:** Private (Admin/Manager/Staff only)
**Description:** Get paginated list of customers with filtering options

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `userId` (string, optional): Filter by specific user ID
- `firstname` (string, optional): Filter by first name (case-insensitive)
- `lastname` (string, optional): Filter by last name (case-insensitive)
- `email` (string, optional): Filter by email (case-insensitive)
- `mobile` (string, optional): Filter by mobile number
- `postcode` (string, optional): Filter by postcode (case-insensitive)
- `sortBy` (string, optional): Sort field - `name`, `email`, `totalOrders`, `totalSpent`, `lastOrderDate` (default: `lastOrderDate`)
- `sortOrder` (string, optional): Sort direction - `asc`, `desc` (default: `desc`)

**Example Request:**
```bash
GET /api/customers?page=1&limit=20&firstname=John&sortBy=totalSpent&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john.doe@example.com",
      "mobile": "+447123456789",
      "address": "123 Main Street, London",
      "postcode": "SW1A 1AA",
      "totalOrders": 15,
      "totalSpent": 450.75,
      "averageOrderValue": 30.05,
      "lastOrderDate": "2024-01-15T10:30:00.000Z",
      "firstOrderDate": "2023-06-01T14:20:00.000Z",
      "customerType": "Regular"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCustomers": 95,
    "customersPerPage": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "branchId": "60f7b3b3b3b3b3b3b3b3b3b3"
}
```

### 2. Get Customer Details

**Endpoint:** `GET /api/customers/:id`
**Access:** Private (Admin/Manager/Staff only)
**Description:** Get detailed information about a specific customer including order history

**Path Parameters:**
- `id` (string, required): Customer ID (MongoDB ObjectId)

**Example Request:**
```bash
GET /api/customers/60f7b3b3b3b3b3b3b3b3b3b3
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "mobile": "+447123456789",
    "address": "123 Main Street, London",
    "totalOrders": 15,
    "totalSpent": 450.75,
    "averageOrderValue": 30.05,
    "lastOrderDate": "2024-01-15T10:30:00.000Z",
    "firstOrderDate": "2023-06-01T14:20:00.000Z",
    "customerType": "Regular",
    "orders": [
      {
        "orderId": "60f7b3b3b3b3b3b3b3b3b3b4",
        "orderNumber": "BR-240115-0001",
        "totalAmount": 35.50,
        "status": "completed",
        "paymentMethod": "card",
        "deliveryMethod": "delivery",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "deliveryAddress": {
          "street": "123 Main Street",
          "city": "London",
          "postalCode": "SW1A 1AA",
          "country": "United Kingdom"
        }
      }
    ]
  },
  "branchId": "60f7b3b3b3b3b3b3b3b3b3b3"
}
```

### 3. Get Customer Statistics

**Endpoint:** `GET /api/customers/stats`
**Access:** Private (Admin/Manager/Staff only)
**Description:** Get comprehensive customer statistics for dashboard

**Example Request:**
```bash
GET /api/customers/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCustomers": 150,
    "totalRevenue": 12500.75,
    "averageCustomerValue": 83.34,
    "averageOrdersPerCustomer": 3.2,
    "newCustomers": 25,
    "regularCustomers": 45,
    "retentionRate": 30.0
  },
  "branchId": "60f7b3b3b3b3b3b3b3b3b3b3"
}
```

## Frontend Integration

The customer management page has been fully integrated with the backend API:

### Features Implemented

1. **Real-time Data Fetching**: Customers are fetched from the backend API
2. **Advanced Filtering**: Filter by user ID, name, email, mobile, postcode
3. **Pagination**: Full pagination support with configurable page sizes
4. **Loading States**: Loading indicators during API calls
5. **Error Handling**: Comprehensive error handling with retry options
6. **Customer Details**: Click "Details" to view customer information
7. **Enhanced Display**: Shows order count, total spent, customer type badges

### Service Usage

```typescript
import { customerService } from '@/services/customer.service';

// Get customers with filtering
const customers = await customerService.getFilteredCustomers(
  {
    firstname: 'John',
    email: 'john@example.com'
  },
  1, // page
  20, // limit
  'totalSpent', // sortBy
  'desc' // sortOrder
);
```

## Summary

I have successfully built and integrated a comprehensive customer management system:

### Backend API ✅
- **Customer Controller**: Extracts unique customers from orders with comprehensive statistics
- **Branch-based Access**: Only shows customers from admin's assigned branch
- **Advanced Filtering**: Filter by name, email, mobile, postcode with pagination
- **Customer Statistics**: Dashboard-ready metrics for customer insights
- **Order History**: Detailed customer order history with last 10 orders
- **No Duplicate Customers**: Ensures same user appears only once regardless of order count

### Frontend Integration ✅
- **Updated Customer Page**: Replaced hardcoded data with real API integration
- **Customer Service**: TypeScript service with comprehensive API methods
- **Enhanced UI**: Added order count, total spent, customer type badges
- **Loading States**: Proper loading indicators and error handling
- **Search & Filter**: Real-time search with multiple filter options
- **Pagination**: Full pagination support with configurable page sizes

### Key Features
1. **Unique Customer Extraction**: Customers are extracted from orders, no duplicates
2. **Branch-based Access**: Admin users only see customers from their branch
3. **Comprehensive Data**: Includes order statistics, spending patterns, customer classification
4. **Real-time Integration**: Frontend fetches live data from backend
5. **Enhanced User Experience**: Loading states, error handling, detailed customer information

The system is now ready for production use and provides a complete customer management solution for restaurant branches. 