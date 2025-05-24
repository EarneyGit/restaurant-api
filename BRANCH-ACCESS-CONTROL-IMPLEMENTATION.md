# Branch-Based Access Control Implementation

## Overview

This document outlines the implementation of branch-based access control for the restaurant management system. The changes ensure that admin users can only access and modify data belonging to their assigned branch.

## Modules Updated

### 1. Order Management

#### Changes Made:
- **Get All Orders (`GET /api/orders`)**: Now filters orders by admin's branchId
- **Get Single Order (`GET /api/orders/:id`)**: Verifies order belongs to admin's branch
- **Update Order (`PUT /api/orders/:id`)**: Ensures only orders from admin's branch can be updated
- **Authentication**: Added `protect` middleware to all order routes except creation (for guest orders)

#### Access Control Rules:
- **Regular Users**: Can only see their own orders
- **Admin/Manager/Staff**: Can only see orders from their assigned branch
- **Super Admin**: Can access orders from any branch (if implemented)

#### Route Protection:
```javascript
router.get('/myorders', protect, getMyOrders);
router.get('/today', protect, getTodayOrders);
router.post('/', createOrder); // Public for guest orders
router.put('/:id', protect, updateOrder);
router.delete('/:id', protect, admin, deleteOrder);
router.get('/', protect, getOrders);
router.get('/:id', protect, getOrder);
```

### 2. Product Management

#### Changes Made:
- **Create Product (`POST /api/products`)**: Auto-assigns admin's branchId, prevents cross-branch creation
- **Update Product (`PUT /api/products/:id`)**: Verifies product belongs to admin's branch
- **Delete Product (`DELETE /api/products/:id`)**: Ensures only products from admin's branch can be deleted
- **Get Products**: Remains public for customer access

#### Access Control Rules:
- **Read Operations**: Public (customers need to view products)
- **Write Operations**: Protected (admin can only modify products from their branch)
- **Branch Assignment**: Automatically set from authenticated admin's branchId

#### Route Protection:
```javascript
// Public routes (read operations)
router.get('/popular', getPopularProducts);
router.get('/recommended', getRecommendedProducts);
router.get('/stock/status', getStockStatus);
router.get('/', getProducts);
router.get('/:id', getProduct);

// Protected routes (write operations)
router.put('/stock/bulk-update', protect, admin, bulkUpdateStock);
router.post('/', protect, admin, upload.array('images', 10), createProduct);
router.put('/:id', protect, admin, upload.array('images', 10), updateProduct);
router.delete('/:id', protect, admin, deleteProduct);
```

### 3. Category Management

#### Changes Made:
- **Create Category (`POST /api/categories`)**: Auto-assigns admin's branchId, prevents cross-branch creation
- **Update Category (`PUT /api/categories/:id`)**: Verifies category belongs to admin's branch
- **Delete Category (`DELETE /api/categories/:id`)**: Ensures only categories from admin's branch can be deleted
- **Get Categories**: Remains public for customer access

#### Access Control Rules:
- **Read Operations**: Public (customers need to view categories)
- **Write Operations**: Protected (admin can only modify categories from their branch)
- **Staff Restrictions**: Staff cannot delete categories (only managers and admins)

#### Route Protection:
```javascript
// Public routes (read operations)
router.get('/', getCategories);
router.get('/counts', getCategoryProductCounts);
router.get('/:id', getCategory);
router.get('/:id/products', getCategoryProducts);

// Protected routes (write operations)
router.post('/', protect, admin, uploadSingle, createCategory);
router.put('/:id', protect, admin, uploadSingle, updateCategory);
router.delete('/:id', protect, admin, deleteCategory);
```

### 4. Attribute Management

#### Existing Implementation:
- Already has proper branch-based access control
- Admin users can only manage attributes from their branch
- Proper authentication middleware in place

## Implementation Details

### Controller Updates

#### Order Controller (`src/controllers/order.controller.js`):
```javascript
// Get user role and apply branch filtering
const userRole = req.user && req.user.roleId ? req.user.roleId.slug : null;

// For manager/staff/admin, only show orders from their branch
if (userRole === 'manager' || userRole === 'staff' || userRole === 'admin') {
  if (!req.user.branchId) {
    return res.status(400).json({
      success: false,
      message: `${userRole} must be assigned to a branch`
    });
  }
  query.branchId = req.user.branchId;
}
```

#### Product Controller (`src/controllers/product.controller.js`):
```javascript
// Set branchId from authenticated user if not provided
if (!req.body.branchId && (userRole === 'manager' || userRole === 'staff' || userRole === 'admin')) {
  req.body.branchId = req.user.branchId;
}

// For manager/staff/admin, ensure they're creating for their branch
if ((userRole === 'manager' || userRole === 'staff' || userRole === 'admin') && 
    req.body.branchId.toString() !== req.user.branchId.toString()) {
  return res.status(403).json({
    success: false,
    message: 'Not authorized to create products for other branches'
  });
}
```

#### Category Controller (`src/controllers/category.controller.js`):
```javascript
// For manager/staff/admin, check if category belongs to their branch
if ((userRole === 'manager' || userRole === 'staff' || userRole === 'admin') && 
    category.branchId && 
    req.user.branchId && 
    category.branchId.toString() !== req.user.branchId.toString()) {
  return res.status(403).json({
    success: false,
    message: 'Not authorized to update this category'
  });
}
```

### Route Protection

#### Authentication Middleware:
- `protect`: Verifies JWT token and populates `req.user`
- `admin`: Ensures user has admin privileges
- Combined usage: `protect, admin` for admin-only operations

#### Public vs Protected Routes:
- **Public**: Read operations for customer access
- **Protected**: Write operations requiring authentication
- **Admin-only**: Operations requiring admin privileges

## Security Features

### Branch Isolation:
- Admins cannot access data from other branches
- Automatic branchId assignment from user profile
- Validation prevents cross-branch data manipulation

### Role-Based Access:
- **Regular Users**: Own data only
- **Staff**: Branch data, limited operations
- **Manager**: Branch data, most operations
- **Admin**: Branch data, all operations
- **Super Admin**: All branches (if implemented)

### Error Handling:
- Clear error messages for unauthorized access
- Proper HTTP status codes (403 for forbidden, 401 for unauthorized)
- Validation of branch assignments

## API Documentation Updates

### Postman Collection:
- Updated with authentication headers for protected routes
- Added descriptions explaining access control
- Maintained public access for read operations

### Example Usage:

#### Creating a Product (Admin):
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Product",
    "price": 15.99,
    "category": "CATEGORY_ID"
  }'
```

#### Getting Orders (Admin):
```bash
curl -X GET http://localhost:5000/api/orders \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Testing

### Test Scenarios:
1. **Admin Access**: Verify admin can only access their branch data
2. **Cross-Branch Prevention**: Ensure admins cannot modify other branch data
3. **Public Access**: Confirm customers can still view products/categories
4. **Authentication**: Test protected routes require valid tokens

### Test Commands:
```bash
# Test admin order access
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:5000/api/orders

# Test public product access
curl http://localhost:5000/api/products

# Test unauthorized access
curl -X PUT http://localhost:5000/api/products/PRODUCT_ID
```

## Migration Notes

### Existing Data:
- Ensure all admin users have branchId assigned
- Verify all products/categories have proper branchId
- Update any existing API integrations

### Frontend Updates Required:
- Add authentication headers to admin operations
- Handle 403 errors for unauthorized access
- Update admin interfaces to show branch-specific data

## Benefits

### Security:
- Prevents data leakage between branches
- Ensures proper access control
- Maintains data integrity

### User Experience:
- Admins see only relevant data
- Faster queries (filtered by branch)
- Clear error messages

### Scalability:
- Supports multi-branch operations
- Easy to add new branches
- Maintainable access control system

## Future Enhancements

### Potential Improvements:
- Super admin role for cross-branch access
- Branch-specific permissions
- Audit logging for admin actions
- Branch switching for multi-branch admins 