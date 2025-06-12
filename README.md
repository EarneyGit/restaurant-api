# Restaurant Management API

A comprehensive RESTful API for restaurant management built with Express.js and MongoDB.

## Features

* User authentication and authorization
* Product and category management
* Order management and processing
* Reservation system
* Branch management
* Reporting and analytics

## Technologies Used

* Node.js
* Express.js
* MongoDB with Mongoose
* JWT for authentication
* bcrypt for password hashing

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me` - Get current user profile
- `GET /api/auth/logout` - Logout user

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get a single user (admin only)
- `POST /api/users` - Create a user (admin only)
- `PUT /api/users/:id` - Update a user (admin only)
- `DELETE /api/users/:id` - Delete a user (admin only)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get a single product
- `POST /api/products` - Create a product (admin only)
- `PUT /api/products/:id` - Update a product (admin only)
- `DELETE /api/products/:id` - Delete a product (admin only)
- `GET /api/products/popular` - Get popular products
- `GET /api/products/recommended` - Get recommended products

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get a single category
- `POST /api/categories` - Create a category (admin only)
- `PUT /api/categories/:id` - Update a category (admin only)
- `DELETE /api/categories/:id` - Delete a category (admin only)
- `GET /api/categories/:id/products` - Get products in a category

### Orders
- `GET /api/orders` - Get all orders (admin/manager only)
- `GET /api/orders/:id` - Get a single order
- `POST /api/orders` - Create a new order
- `PUT /api/orders/:id/status` - Update order status
- `PUT /api/orders/:id/payment` - Update payment status (admin/manager only)
- `GET /api/orders/myorders` - Get current user's orders

### Reservations
- `GET /api/reservations` - Get all reservations (admin/manager only)
- `GET /api/reservations/:id` - Get a single reservation
- `POST /api/reservations` - Create a new reservation
- `PUT /api/reservations/:id/status` - Update reservation status (admin/manager only)
- `PUT /api/reservations/:id/cancel` - Cancel a reservation
- `GET /api/reservations/myreservations` - Get current user's reservations

### Branches
- `GET /api/branches` - Get all branches
- `GET /api/branches/:id` - Get a single branch
- `POST /api/branches` - Create a branch (admin only)
- `PUT /api/branches/:id` - Update a branch (admin only)
- `DELETE /api/branches/:id` - Delete a branch (admin only)
- `GET /api/branches/radius/:zipcode/:distance` - Get branches within radius

### Reports
- `GET /api/reports/sales` - Get sales reports (admin/manager only)
- `GET /api/reports/products/top` - Get top selling products (admin/manager only)
- `GET /api/reports/customers` - Get customer statistics (admin only)
- `GET /api/reports/reservations` - Get reservation statistics (admin/manager only)

## Installation

1. Clone the repository
```
git clone https://github.com/EarneyGit/restaurant-api.git
cd restaurant-api
```

2. Install dependencies
```
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=mongodb://localhost:27017/restaurant
PORT=5000
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=30d
```

4. Run the server
```
npm run dev
```

## Usage

Make requests to the API endpoints using tools like Postman or any HTTP client.

## License

This project is licensed under the MIT License. 