# Restaurant API Postman Collection

This directory contains multiple JSON files that together form a complete Postman collection for testing the Restaurant API.

## Files Included

1. `restaurant-api-postman-collection.json` - Auth and Category endpoints
2. `restaurant-api-postman-collection-products.json` - Product endpoints
3. `restaurant-api-postman-collection-orders.json` - Order endpoints
4. `restaurant-api-postman-collection-users-roles-branches.json` - User, Role, and Branch endpoints
5. `restaurant-api-postman-collection-reports-reservations.json` - Reports and Reservation endpoints

## Importing Instructions

### Method 1: Import Each File and Merge

1. Open Postman
2. Click on "Import" button in the top left corner
3. Choose "File" and select one of the JSON files
4. Repeat for each file
5. In the left sidebar, you can drag and drop folders between collections to organize them

### Method 2: Manual Merge and Import

1. Create a new JSON file combining all the "item" arrays from each file
2. Add proper JSON structure around it (matching the structure in `restaurant-api-postman-collection.json`)
3. Import the combined file

## Environment Variables

The collection uses the following environment variables:

- `baseUrl`: The base URL of your API (e.g., http://localhost:5000)
- `token`: Your authentication token (obtained after login)

### Setting Up Environment Variables

1. In Postman, click on "Environments" in the left sidebar
2. Click "Add" to create a new environment
3. Name it "Restaurant API"
4. Add the variables:
   - Name: `baseUrl`, Initial Value: `http://localhost:5000`, Current Value: `http://localhost:5000`
   - Name: `token`, Initial Value: (leave empty), Current Value: (leave empty)
5. Save the environment
6. Select the environment from the dropdown in the top right corner

## Using the Collection

1. First, use the "Login" request in the Auth folder to get your authentication token
2. The response will contain a token - copy it
3. Set the `token` environment variable to this value
4. Now you can use all authenticated endpoints

## Special Request Types

### Form Data Requests (with File Uploads)

Some requests like "Create Category" or "Create Product" use form-data and file uploads. For these:

1. Select the request
2. In the "Body" tab, ensure "form-data" is selected
3. For file fields (like "image"), click "Select Files" to choose a file from your system
4. Other fields are sent as text

### JSON Requests

Regular JSON requests have the body set as "raw" with JSON format. You can simply modify the JSON data in the request body.

## Note About Authorization

The collection includes authorization headers for endpoints that historically required them, even though current API implementation may not enforce authentication on all routes. 