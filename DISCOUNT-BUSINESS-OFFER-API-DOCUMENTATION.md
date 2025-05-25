# Discount and Business Offer API Documentation

This document provides comprehensive documentation for the Discount and Business Offer APIs, including integration with cart and order systems.

## Table of Contents

1. [Overview](#overview)
2. [Discount API](#discount-api)
3. [Business Offer API](#business-offer-api)
4. [Cart Integration](#cart-integration)
5. [Order Integration](#order-integration)
6. [Branch-Based Access Control](#branch-based-access-control)
7. [Testing](#testing)

## Overview

The Discount and Business Offer APIs provide comprehensive functionality for managing promotional content and discount codes in a multi-branch restaurant system. All operations are branch-based, ensuring data isolation between different restaurant locations.

### Key Features

- **Branch-based access control**: All discounts and offers are scoped to specific branches
- **Real-time discount validation**: Validate discount codes during checkout
- **Cart integration**: Apply discounts directly to shopping carts
- **Order tracking**: Track discount usage and savings
- **Analytics**: Comprehensive statistics for discounts and offers
- **Flexible conditions**: Support for time-based, usage-limited, and service-type restrictions

## Discount API

### Base URL
```
/api/discounts
```

### Authentication
Most endpoints require authentication with admin, manager, or staff roles. The public validation endpoint does not require authentication.

### Endpoints

#### 1. Get All Discounts
```http
GET /api/discounts
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `isActive` (optional): Filter by active status (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345",
      "name": "First Order Discount",
      "code": "FIRST20",
      "allowMultipleCoupons": false,
      "discountType": "percentage",
      "discountValue": 20,
      "minSpend": 15,
      "maxSpend": 0,
      "outlets": {
        "dunfermline": true,
        "edinburgh": true,
        "glasgow": false
      },
      "timeDependent": true,
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-12-31T23:59:59.999Z",
      "maxUses": {
        "total": 1000,
        "perCustomer": 1,
        "perDay": 50
      },
      "daysAvailable": {
        "monday": true,
        "tuesday": true,
        "wednesday": true,
        "thursday": true,
        "friday": true,
        "saturday": true,
        "sunday": true
      },
      "serviceTypes": {
        "collection": true,
        "delivery": true,
        "tableOrdering": false
      },
      "firstOrderOnly": true,
      "isActive": true,
      "usageStats": {
        "totalUsed": 45,
        "totalSavings": 450.75,
        "lastUsed": "2024-01-15T14:30:00.000Z"
      },
      "createdBy": {
        "_id": "64a1b2c3d4e5f6789012346",
        "name": "Admin User",
        "email": "admin@restaurant.com"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T14:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalDiscounts": 45,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "branchId": "64a1b2c3d4e5f6789012347"
}
```

#### 2. Get Single Discount
```http
GET /api/discounts/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Same structure as discount object above
  },
  "branchId": "64a1b2c3d4e5f6789012347"
}
```

#### 3. Create Discount
```http
POST /api/discounts
```

**Request Body:**
```json
{
  "name": "Weekend Special",
  "code": "WEEKEND15",
  "allowMultipleCoupons": false,
  "discountType": "percentage",
  "discountValue": 15,
  "minSpend": 25,
  "maxSpend": 0,
  "outlets": {
    "dunfermline": true,
    "edinburgh": true,
    "glasgow": true
  },
  "timeDependent": true,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-12-31T23:59:59.999Z",
  "maxUses": {
    "total": 500,
    "perCustomer": 2,
    "perDay": 25
  },
  "daysAvailable": {
    "monday": false,
    "tuesday": false,
    "wednesday": false,
    "thursday": false,
    "friday": true,
    "saturday": true,
    "sunday": true
  },
  "serviceTypes": {
    "collection": true,
    "delivery": true,
    "tableOrdering": true
  },
  "firstOrderOnly": false,
  "isActive": true
}
```

#### 4. Update Discount
```http
PUT /api/discounts/:id
```

**Request Body:** Same as create, but all fields are optional.

#### 5. Delete Discount
```http
DELETE /api/discounts/:id
```

#### 6. Validate Discount Code (Public)
```http
POST /api/discounts/validate
```

**Request Body:**
```json
{
  "code": "FIRST20",
  "branchId": "64a1b2c3d4e5f6789012347",
  "orderTotal": 50.00,
  "deliveryMethod": "delivery",
  "userId": "64a1b2c3d4e5f6789012348"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "discountId": "64a1b2c3d4e5f6789012345",
    "code": "FIRST20",
    "name": "First Order Discount",
    "discountType": "percentage",
    "discountValue": 20,
    "discountAmount": 10.00,
    "originalTotal": 50.00,
    "newTotal": 40.00,
    "savings": 10.00
  },
  "message": "Discount code is valid"
}
```

#### 7. Get Discount Statistics
```http
GET /api/discounts/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDiscounts": 12,
    "activeDiscounts": 8,
    "totalUsed": 1250,
    "totalSavings": 15750.50,
    "averageDiscountValue": 18.5,
    "topDiscounts": [
      {
        "_id": "64a1b2c3d4e5f6789012345",
        "name": "First Order Discount",
        "code": "FIRST20",
        "usageStats": {
          "totalUsed": 450,
          "totalSavings": 5625.75
        }
      }
    ]
  },
  "branchId": "64a1b2c3d4e5f6789012347"
}
```

## Business Offer API

### Base URL
```
/api/business-offers
```

### Endpoints

#### 1. Get All Business Offers
```http
GET /api/business-offers
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `isActive` (optional): Filter by active status (true/false)

#### 2. Get Active Business Offers (Public)
```http
GET /api/business-offers/active/:branchId
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012349",
      "title": "New Year Special Menu",
      "content": "<p>Try our <strong>exclusive New Year menu</strong> with special dishes and drinks!</p>",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.999Z",
      "displayOrder": 1,
      "image": "https://example.com/images/new-year-special.jpg",
      "isActive": true,
      "stats": {
        "views": 1250,
        "clicks": 85,
        "lastViewed": "2024-01-15T14:30:00.000Z"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T14:30:00.000Z"
    }
  ],
  "branchId": "64a1b2c3d4e5f6789012347"
}
```

#### 3. Track Offer View (Public)
```http
POST /api/business-offers/:id/view
```

#### 4. Track Offer Click (Public)
```http
POST /api/business-offers/:id/click
```

#### 5. Create Business Offer
```http
POST /api/business-offers
```

**Request Body:**
```json
{
  "title": "Summer BBQ Special",
  "content": "<p>Join us for our <strong>Summer BBQ Special</strong> every weekend!</p><ul><li>Grilled specialties</li><li>Fresh salads</li><li>Cold beverages</li></ul>",
  "startDate": "2024-06-01T00:00:00.000Z",
  "endDate": "2024-08-31T23:59:59.999Z",
  "displayOrder": 2,
  "image": "https://example.com/images/summer-bbq.jpg",
  "isActive": true
}
```

## Cart Integration

### Applying Discounts to Cart

The cart model has been extended to support discount information:

```javascript
// Cart schema includes:
{
  discount: {
    discountId: ObjectId,
    code: String,
    name: String,
    discountType: String,
    discountValue: Number,
    discountAmount: Number
  },
  finalTotal: Number // total - discountAmount
}
```

### Cart Methods

#### Apply Discount
```javascript
const cart = await Cart.findById(cartId);
const discount = await Discount.findOne({ code: 'FIRST20', isActive: true });

await cart.applyDiscount(discount);
```

#### Remove Discount
```javascript
await cart.removeDiscount();
```

## Order Integration

### Order Schema Extensions

Orders now include discount information:

```javascript
{
  discount: {
    discountId: ObjectId,
    code: String,
    name: String,
    discountType: String,
    discountValue: Number,
    discountAmount: Number,
    originalTotal: Number
  },
  finalTotal: Number
}
```

### Discount Usage Tracking

When an order is placed with a discount:
1. Discount usage statistics are updated
2. Usage limits are checked and enforced
3. Total savings are calculated and stored

## Branch-Based Access Control

### How It Works

1. **User Assignment**: Each admin/manager/staff user is assigned to a specific branch
2. **Data Isolation**: Users can only see and manage discounts/offers for their assigned branch
3. **Automatic Scoping**: All API operations automatically filter by the user's branch
4. **Public Endpoints**: Validation and active offer endpoints require explicit branch ID

### Branch Assignment

Users must have a `branchId` field in their profile. This is automatically used to scope all operations.

## Testing

### Running the Test Script

1. Start your server:
```bash
cd restaurant-api
npm start
```

2. Run the test script:
```bash
node test-discount-api.js
```

### Test Coverage

The test script covers:
- ✅ Discount validation (public endpoint)
- ✅ Discount CRUD operations
- ✅ Business offer CRUD operations
- ✅ Analytics and statistics
- ✅ View/click tracking

### Manual Testing

You can also test the APIs manually using tools like Postman or curl:

```bash
# Test discount validation
curl -X POST http://localhost:5000/api/discounts/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "FIRST20",
    "branchId": "64a1b2c3d4e5f6789012347",
    "orderTotal": 50,
    "deliveryMethod": "delivery"
  }'

# Get active business offers
curl http://localhost:5000/api/business-offers/active/64a1b2c3d4e5f6789012347
```

## Error Handling

### Common Error Responses

#### Invalid Discount Code
```json
{
  "success": false,
  "message": "Invalid discount code"
}
```

#### Discount Not Applicable
```json
{
  "success": false,
  "message": "Discount not applicable: Minimum spend requirement not met"
}
```

#### Usage Limit Exceeded
```json
{
  "success": false,
  "message": "Discount usage limit exceeded"
}
```

#### Unauthorized Access
```json
{
  "success": false,
  "message": "Only admin users can access discounts"
}
```

## Frontend Integration

### Services

The frontend includes TypeScript services for both APIs:

- `discountService`: Full CRUD operations and validation
- `businessOfferService`: Full CRUD operations and tracking

### Usage Examples

```typescript
// Validate discount code
const validation = await discountService.validateDiscountCode(
  'FIRST20',
  branchId,
  orderTotal,
  'delivery',
  userId
);

// Get active business offers
const offers = await businessOfferService.getActiveBusinessOffers(branchId);

// Track offer interaction
await businessOfferService.trackOfferView(offerId);
```

## Best Practices

1. **Always validate discounts** before applying them to orders
2. **Use branch-based scoping** to ensure data isolation
3. **Track usage statistics** for analytics and reporting
4. **Implement proper error handling** for all discount scenarios
5. **Test thoroughly** with various discount conditions and edge cases

## Support

For questions or issues with the Discount and Business Offer APIs, please contact the development team or refer to the main API documentation. 