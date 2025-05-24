# Branch-Based Access Control - Final Implementation

## Overview

This document outlines the complete implementation of branch-based access control for the restaurant management system. The system now supports two distinct applications:

1. **User Application**: For customers (guests and registered users)
2. **Admin Application**: For restaurant staff (admin, manager, staff)

## Key Principles

### Branch Selection Requirement
- **All users must select a branch** before accessing any data
- **Admin users**: Use their assigned `branchId` from user profile
- **Regular users/Guests**: Must provide `branchId` via query parameter or request body

### Role-Based Access Patterns
- **Admin Users** (`admin`, `manager`, `staff`): Access limited to their assigned branch
- **Regular Users** (`user` role): Can access any branch they select
- **Guest Users** (no authentication): Can access any branch they select

## Implementation Details

### 1. Order Management

#### Access Control Logic:
```javascript
// Admin users: Use their assigned branchId
if (isAdmin) {
  if (!req.user.branchId) {
    return error('Admin must be assigned to a branch');
  }
  targetBranchId = req.user.branchId;
  query.branchId = targetBranchId;
}
// Regular users/guests: Use branch from query/body
else {
  if (!req.query.branchId) {
    return error('Branch ID is required. Please select a branch.');
  }
  targetBranchId = req.query.branchId;
  query.branchId = targetBranchId;
}
```

#### Endpoints:
- `GET /api/orders` - Get orders (branch-filtered)
- `GET /api/orders/:id` - Get single order (branch-verified)
- `POST /api/orders` - Create order (branch-validated)
- `PUT /api/orders/:id` - Update order (admin only, branch-verified)
- `GET /api/orders/myorders` - Get user's orders (branch-filtered)
- `GET /api/orders/today` - Get today's orders (admin only)

#### Authentication:
- **Public with Optional Auth**: `GET`, `POST` operations
- **Protected**: `PUT`, `DELETE` operations (admin only)

### 2. Product Management

#### Access Control Logic:
- **Read Operations**: Public with branch filtering
- **Write Operations**: Admin only, limited to their branch

#### Endpoints:
- `GET /api/products` - Get products (branch-filtered)
- `GET /api/products/:id` - Get single product (branch-verified)
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only, branch-verified)
- `DELETE /api/products/:id` - Delete product (admin only, branch-verified)

#### Authentication:
- **Public with Optional Auth**: All `GET` operations
- **Protected**: `POST`, `PUT`, `DELETE` operations

### 3. Category Management

#### Access Control Logic:
- Same as products - public read, protected write
- All operations filtered by branch

#### Endpoints:
- `GET /api/categories` - Get categories (branch-filtered)
- `GET /api/categories/:id` - Get single category (branch-verified)
- `POST /api/categories` - Create category (admin only)
- `PUT /api/categories/:id` - Update category (admin only, branch-verified)
- `DELETE /api/categories/:id` - Delete category (admin only, branch-verified)

### 4. Attribute Management

#### Access Control Logic:
- Public read access with branch filtering
- Admin write access limited to their branch

#### Endpoints:
- `GET /api/attributes` - Get attributes (branch-filtered)
- `GET /api/attributes/:id` - Get single attribute (branch-verified)
- `POST /api/attributes` - Create attribute (admin only)
- `PUT /api/attributes/:id` - Update attribute (admin only, branch-verified)

## Authentication Middleware

### New `optionalAuth` Middleware
```javascript
// Allows both authenticated and unauthenticated access
// Sets req.user if valid token provided, null otherwise
const optionalAuth = async (req, res, next) => {
  // Check for token
  // If valid: populate req.user
  // If invalid/missing: set req.user = null
  // Always continue to next()
}
```

### Middleware Usage:
- **`optionalAuth`**: Public endpoints that support both auth/unauth users
- **`protect`**: Endpoints requiring authentication
- **`protect + admin`**: Admin-only endpoints

## API Usage Examples

### User Application (Frontend)

#### 1. Guest User Browsing Products:
```javascript
// User selects branch first
const branchId = "64a1b2c3d4e5f6789012345";

// Get products for selected branch
fetch(`/api/products?branchId=${branchId}`)
  .then(response => response.json())
  .then(data => console.log(data.data)); // Products from selected branch
```

#### 2. Authenticated User Placing Order:
```javascript
// User already selected branch
const branchId = "64a1b2c3d4e5f6789012345";

fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}` // Optional for guests
  },
  body: JSON.stringify({
    branchId: branchId,
    products: [
      {
        product: "64a1b2c3d4e5f6789012346",
        quantity: 2
      }
    ],
    deliveryMethod: "delivery"
  })
});
```

#### 3. User Viewing Their Orders:
```javascript
// Authenticated user
fetch(`/api/orders/myorders?branchId=${branchId}`, {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
```

### Admin Application (Backend)

#### 1. Admin Viewing Orders:
```javascript
// Admin token contains branchId in user profile
fetch('/api/orders', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
})
// Returns only orders from admin's assigned branch
```

#### 2. Admin Creating Product:
```javascript
fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    name: "New Product",
    price: 15.99,
    category: "64a1b2c3d4e5f6789012347"
    // branchId automatically set from admin's profile
  })
});
```

## Error Handling

### Common Error Responses:

#### 1. Missing Branch Selection:
```json
{
  "success": false,
  "message": "Branch ID is required. Please select a branch."
}
```

#### 2. Admin Without Branch Assignment:
```json
{
  "success": false,
  "message": "admin must be assigned to a branch"
}
```

#### 3. Cross-Branch Access Attempt:
```json
{
  "success": false,
  "message": "Not authorized to access this order"
}
```

#### 4. Product Not in Selected Branch:
```json
{
  "success": false,
  "message": "Product not found in the selected branch"
}
```

## Frontend Integration Guidelines

### User Application:

1. **Branch Selection Flow**:
   ```javascript
   // Step 1: Get available branches
   fetch('/api/branches')
   
   // Step 2: User selects branch
   const selectedBranchId = userSelection;
   
   // Step 3: Store branch selection
   localStorage.setItem('selectedBranchId', selectedBranchId);
   
   // Step 4: Use branch in all subsequent requests
   ```

2. **API Request Pattern**:
   ```javascript
   const branchId = localStorage.getItem('selectedBranchId');
   
   // For GET requests
   const url = `/api/products?branchId=${branchId}`;
   
   // For POST requests
   const body = {
     branchId: branchId,
     // ... other data
   };
   ```

### Admin Application:

1. **No Branch Selection Required**:
   - Admin's branch is determined from their profile
   - All requests automatically filtered by admin's branch

2. **API Request Pattern**:
   ```javascript
   // Simple requests - branch handled automatically
   fetch('/api/orders', {
     headers: {
       'Authorization': `Bearer ${adminToken}`
     }
   });
   ```

## Database Requirements

### User Schema Updates:
```javascript
// Admin users must have branchId
{
  _id: ObjectId,
  email: String,
  name: String,
  roleId: ObjectId, // References Role
  branchId: ObjectId, // Required for admin users
  // ... other fields
}
```

### Data Validation:
- All admin users must have `branchId` assigned
- All products, categories, attributes must have `branchId`
- Orders automatically get `branchId` from products or admin

## Security Features

### Branch Isolation:
- **Complete data separation** between branches
- **No cross-branch data access** for admin users
- **Automatic branch validation** for all operations

### Access Control:
- **Role-based permissions** with branch restrictions
- **Token-based authentication** with optional support
- **Automatic branch assignment** for admin operations

### Data Integrity:
- **Branch consistency validation** across related entities
- **Product-branch validation** during order creation
- **Automatic branch filtering** in all queries

## Testing Scenarios

### 1. User Application Tests:
```bash
# Test guest user browsing
curl "http://localhost:5000/api/products?branchId=BRANCH_ID"

# Test authenticated user ordering
curl -X POST "http://localhost:5000/api/orders" \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branchId":"BRANCH_ID","products":[...]}'

# Test missing branch ID
curl "http://localhost:5000/api/products"
# Should return: "Branch ID is required"
```

### 2. Admin Application Tests:
```bash
# Test admin viewing orders
curl "http://localhost:5000/api/orders" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Test admin creating product
curl -X POST "http://localhost:5000/api/products" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","price":10.99}'

# Test cross-branch access prevention
# Admin from Branch A trying to access Branch B data
curl "http://localhost:5000/api/orders?branchId=OTHER_BRANCH_ID" \
  -H "Authorization: Bearer ADMIN_TOKEN"
# Should return filtered results from admin's branch only
```

## Migration Checklist

### Before Deployment:
- [ ] Ensure all admin users have `branchId` assigned
- [ ] Verify all products have `branchId`
- [ ] Verify all categories have `branchId`
- [ ] Verify all attributes have `branchId`
- [ ] Update frontend to handle branch selection
- [ ] Test all API endpoints with branch filtering

### After Deployment:
- [ ] Monitor error logs for missing branch IDs
- [ ] Verify admin users can only access their branch data
- [ ] Test guest user flows with branch selection
- [ ] Validate order creation with branch consistency

## Benefits

### For Users:
- **Clear branch selection** before browsing
- **Consistent experience** within selected branch
- **Accurate product availability** per location

### For Admins:
- **Focused data view** for their branch only
- **Simplified management** without cross-branch confusion
- **Improved performance** with filtered queries

### For System:
- **Enhanced security** with branch isolation
- **Better scalability** with branch-based partitioning
- **Cleaner data architecture** with consistent filtering

## Future Enhancements

### Potential Improvements:
- **Multi-branch admin support** for franchise managers
- **Branch switching capability** for super admins
- **Branch-specific configurations** and settings
- **Advanced reporting** with branch comparisons
- **Branch-based caching strategies** for better performance 