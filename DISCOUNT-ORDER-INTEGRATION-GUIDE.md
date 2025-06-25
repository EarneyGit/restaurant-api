# Discount & Order API Integration Guide

## Overview
This guide explains how to integrate promo codes and discounts with the order system in your frontend application.

## API Flow

### 1. Frontend Integration Flow

```
User adds items to cart → User enters promo code → Validate discount → Apply discount → Create order
```

## Discount Validation API

### Validate Discount Code
**Endpoint:** `POST /api/discounts/validate`
**Access:** Public

```javascript
// Request
{
  "code": "WELCOME10",
  "branchId": "68330325eff1bd5bc97750bf",
  "orderTotal": 50.00,
  "deliveryMethod": "delivery",
  "orderType": "delivery",
  "userId": "user123" // Optional for guest users
}

// Success Response
{
  "success": true,
  "data": {
    "discountId": "discount_id",
    "code": "WELCOME10",
    "name": "Welcome Discount",
    "discountType": "percentage",
    "discountValue": 10,
    "discountAmount": 5.00,
    "originalTotal": 50.00,
    "newTotal": 45.00,
    "savings": 5.00
  },
  "message": "Coupon applied"
}

// Error Response
{
  "success": false,
  "message": "Invalid coupon code"
}
```

## Cart API with Stock Management

### Get Cart
**Endpoint:** `GET /api/cart?branchId={branchId}`
**Headers:** `X-Session-ID: guest-session-123`

```javascript
// Response includes stock management
{
  "success": true,
  "data": {
    "items": [
      {
        "price": {
          "base": 15.99,
          "currentEffectivePrice": 12.99,
          "attributes": 2.50,
          "total": 15.49
        },
        "stockManagement": {
          "isManaged": true,
          "quantity": 25,
          "lowStockThreshold": 10,
          "lastUpdated": "2024-01-01T10:00:00.000Z"
        }
      }
    ]
  }
}
```

## Order Creation with Discount

### Create Order
**Endpoint:** `POST /api/orders`

```javascript
// Request with Discount
{
  "branchId": "68330325eff1bd5bc97750bf",
  "products": [
    {
      "product": "product_id",
      "quantity": 2
    }
  ],
  "couponCode": "WELCOME10",
  "deliveryMethod": "delivery"
}

// Success Response
{
  "success": true,
  "data": {
    "products": [
      {
        "price": {
          "base": 15.99,
          "currentEffectivePrice": 12.99,
          "attributes": 2.50,
          "total": 15.49
        }
      }
    ],
    "totalAmount": 30.98,
    "finalTotal": 25.98,
    "discountApplied": {
      "code": "WELCOME10",
      "discountAmount": 5.00
    }
  },
  "savings": 5.00
}
```

## Frontend Implementation

### Validate Discount
```javascript
async function validateDiscount(code, orderTotal, branchId) {
  const response = await fetch('/api/discounts/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code, branchId, orderTotal,
      deliveryMethod: 'delivery',
      orderType: 'delivery'
    })
  });
  return response.json();
}
```

### Create Order with Discount
```javascript
async function createOrder(orderData, discountCode) {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...orderData,
      couponCode: discountCode
    })
  });
  return response.json();
}
```

## Testing
Import `discount-order-api-collection.json` into Postman for testing all endpoints.

## Price Structure

Both cart and order responses now include a consistent price structure:

```javascript
{
  "price": {
    "base": 15.99,                    // Original product price
    "currentEffectivePrice": 12.99,   // Price after any active price changes
    "attributes": 2.50,               // Additional cost from selected attributes
    "total": 15.49                    // Final price per item (currentEffectivePrice + attributes)
  }
}
```

## Error Handling

### Common Error Responses

1. **Invalid Discount Code**
```javascript
{
  "success": false,
  "message": "Invalid coupon code"
}
```

2. **Discount Expired**
```javascript
{
  "success": false,
  "message": "This coupon has expired"
}
```

3. **Usage Limit Exceeded**
```javascript
{
  "success": false,
  "message": "You have already used this coupon the maximum number of times"
}
```

4. **Minimum Order Not Met**
```javascript
{
  "success": false,
  "message": "Minimum order amount of $25.00 required for this coupon"
}
```

## Best Practices

1. **Validate discount before order creation** - Always validate the discount code before creating the order
2. **Handle stock updates** - Check stock availability before allowing checkout
3. **Show clear pricing** - Display original price, discount amount, and final total
4. **Error handling** - Provide clear error messages for discount validation failures
5. **Session management** - Use session IDs for guest users consistently

## Testing with Postman

Import the `discount-order-api-collection.json` file into Postman to test all endpoints. The collection includes:

- Authentication endpoints
- Discount validation
- Cart management with stock info
- Order creation with discounts
- Product APIs with stock management

## Environment Variables

Set these variables in Postman:
- `baseUrl`: http://localhost:5000/api
- `branchId`: Your branch ID
- `sessionId`: A unique session identifier for guest users
- `authToken`: JWT token after login 