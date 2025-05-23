# Cart API Documentation

## Overview

The Cart API module provides complete cart functionality that exactly matches the frontend cart implementation. It supports both authenticated users and guest users (session-based), with seamless cart merging when guests sign up or log in.

## Frontend Cart Analysis

Based on the frontend cart implementation analysis, the API supports:

### Frontend Cart Context Structure:
```typescript
interface CartItem extends Product {
  quantity: number;
  selectedOptions?: Record<string, string>;  // Product customizations
  specialRequirements?: string;              // Special instructions
}
```

### Key Frontend Operations Supported:
- `addToCart` - Adds items with options as unique entries
- `removeFromCart` - Removes items by ID
- `updateQuantity` - Updates quantity or removes if <= 0
- `getCartTotal` - Calculates total price
- `getCartCount` - Gets total item count
- `clearCart` - Empties the cart

## Database Schema

### Cart Model
```javascript
{
  userId: ObjectId,                 // Reference to User (for authenticated users)
  sessionId: String,               // Session ID for guest users
  items: [CartItem],               // Array of cart items
  subtotal: Number,                // Cart subtotal
  deliveryFee: Number,             // Delivery fee (default: $5.00 for delivery)
  total: Number,                   // Total price (subtotal + deliveryFee)
  orderType: String,               // 'delivery', 'pickup', 'dine-in'
  branchId: ObjectId,              // Selected branch
  status: String,                  // 'active', 'checkout', 'abandoned', 'converted'
  expiresAt: Date                  // Auto-expires after 30 days
}
```

### CartItem Schema
```javascript
{
  productId: ObjectId,             // Reference to Product
  quantity: Number,                // Item quantity
  selectedOptions: Map,            // Product customizations (size, toppings, etc.)
  specialRequirements: String,     // Special instructions
  priceAtTime: Number,             // Price when added (for consistency)
  itemTotal: Number                // Calculated total for this item
}
```

## API Endpoints

### 1. Get Cart
```
GET /api/cart
Headers: 
  - Authorization: Bearer {token} (optional)
  - x-session-id: {sessionId} (for guest users)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cart_id",
    "userId": "user_id",
    "sessionId": "session_id",
    "items": [
      {
        "id": "item_id",
        "productId": "product_id",
        "name": "Product Name",
        "price": 12.99,
        "quantity": 2,
        "selectedOptions": {
          "size": "Large",
          "toppings": "Extra Cheese"
        },
        "specialRequirements": "No onions please",
        "images": ["image1.jpg"],
        "itemTotal": 25.98,
        "category": "category_info"
      }
    ],
    "subtotal": 25.98,
    "deliveryFee": 5.00,
    "total": 30.98,
    "itemCount": 2,
    "orderType": "delivery",
    "branchId": "branch_id",
    "status": "active"
  }
}
```

### 2. Add Item to Cart
```
POST /api/cart/items
Headers: 
  - Authorization: Bearer {token} (optional)
  - x-session-id: {sessionId} (for guest users)
```

**Request Body:**
```json
{
  "productId": "product_id",
  "quantity": 1,
  "selectedOptions": {
    "size": "Large",
    "toppings": "Extra Cheese"
  },
  "specialRequirements": "No onions please",
  "sessionId": "session_id",
  "branchId": "branch_id"
}
```

### 3. Update Cart Item
```
PUT /api/cart/items/:itemId
Headers: 
  - Authorization: Bearer {token} (optional)
  - x-session-id: {sessionId} (for guest users)
```

**Request Body:**
```json
{
  "quantity": 3,
  "specialRequirements": "Updated instructions"
}
```

### 4. Remove Item from Cart
```
DELETE /api/cart/items/:itemId
Headers: 
  - Authorization: Bearer {token} (optional)
  - x-session-id: {sessionId} (for guest users)
```

### 5. Clear Cart
```
DELETE /api/cart
Headers: 
  - Authorization: Bearer {token} (optional)
  - x-session-id: {sessionId} (for guest users)
```

### 6. Update Delivery Settings
```
PUT /api/cart/delivery
Headers: 
  - Authorization: Bearer {token} (optional)
  - x-session-id: {sessionId} (for guest users)
```

**Request Body:**
```json
{
  "orderType": "pickup",
  "branchId": "branch_id",
  "deliveryFee": 0
}
```

### 7. Get Cart Summary (Lightweight)
```
GET /api/cart/summary
Headers: 
  - Authorization: Bearer {token} (optional)
  - x-session-id: {sessionId} (for guest users)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "itemCount": 3,
    "subtotal": 45.97,
    "deliveryFee": 5.00,
    "total": 50.97,
    "hasItems": true
  }
}
```

### 8. Merge Guest Cart with User Cart
```
POST /api/cart/merge
Headers: 
  - Authorization: Bearer {token} (required)
```

**Request Body:**
```json
{
  "sessionId": "guest_session_id"
}
```

## Frontend Integration

### 1. Session Management
For guest users, generate a unique session ID and include it in requests:

```javascript
// Generate session ID
const sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// Include in API calls
const headers = {
  'Content-Type': 'application/json',
  'x-session-id': sessionId
};
```

### 2. Adding Items to Cart
```javascript
const addToCart = async (product, selectedOptions = {}, specialRequirements = '') => {
  const response = await fetch('/api/cart/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
      // Include auth header if user is logged in
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({
      productId: product.id,
      quantity: 1,
      selectedOptions,
      specialRequirements,
      sessionId // Include in body as fallback
    })
  });
  
  const result = await response.json();
  return result.data;
};
```

### 3. Updating Cart Items
```javascript
const updateQuantity = async (itemId, quantity) => {
  const response = await fetch(`/api/cart/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({ quantity })
  });
  
  const result = await response.json();
  return result.data;
};
```

### 4. Cart Merging After Login
```javascript
const mergeCartAfterLogin = async (token, sessionId) => {
  const response = await fetch('/api/cart/merge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ sessionId })
  });
  
  const result = await response.json();
  return result.data;
};
```

## Key Features

### 1. **Option-Based Item Uniqueness**
Items with different `selectedOptions` are treated as separate cart items, exactly matching the frontend behavior.

### 2. **Price Consistency**
Prices are stored at the time of adding to cart (`priceAtTime`) to prevent price changes from affecting existing cart items.

### 3. **Automatic Calculations**
- Item totals are automatically calculated (price × quantity)
- Cart subtotal is sum of all item totals
- Delivery fee is automatically set based on order type
- Total is subtotal + delivery fee

### 4. **Session Support**
Full support for guest users with session-based carts that can be merged when they sign up or log in.

### 5. **Cart Persistence**
Carts automatically expire after 30 days and are cleaned up by MongoDB TTL indexes.

### 6. **Flexible Authentication**
Supports both authenticated users and guest sessions with seamless transitions.

## Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

Common error scenarios:
- Invalid product ID (404)
- Cart item not found (404)
- Invalid quantity (400)
- Missing session ID or authentication (400)
- Server errors (500)

## Testing

Use the provided Postman collection or test with curl:

```bash
# Add item to cart (guest user)
curl -X POST http://localhost:5000/api/cart/items \
  -H "Content-Type: application/json" \
  -H "x-session-id: guest_123456" \
  -d '{
    "productId": "product_id_here",
    "quantity": 2,
    "selectedOptions": {"size": "Large"},
    "specialRequirements": "Extra spicy"
  }'

# Get cart
curl -X GET http://localhost:5000/api/cart \
  -H "x-session-id: guest_123456"
```

This Cart API provides complete compatibility with the frontend cart implementation while adding robust backend features like persistence, user management, and data consistency. 