# Google Maps API Integration Documentation

## Overview

This documentation covers the Google Maps API integration for converting UK postcodes to addresses. The system uses Google's Geocoding API to provide accurate address information for UK locations.

## Setup

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the **Geocoding API**
4. Create credentials (API Key)
5. Restrict the API key to your domain/IP for security

### 2. Environment Configuration

Add your Google Maps API key to your environment variables:

```bash
# .env file
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 3. API Endpoints

Base URL: `http://localhost:5000/api/addresses`

## API Endpoints

### 1. Convert Postcode to Address (POST)

**Endpoint:** `POST /api/addresses/postcode-to-address`
**Access:** Public
**Description:** Convert a UK postcode to full address details

**Request Body:**
```json
{
  "postcode": "SW1A 1AA"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "formattedAddress": "Buckingham Palace, London SW1A 1AA, UK",
    "postcode": "SW1A 1AA",
    "streetNumber": "",
    "streetName": "Buckingham Palace",
    "locality": "London",
    "city": "London",
    "county": "Greater London",
    "country": "United Kingdom",
    "latitude": 51.501364,
    "longitude": -0.14189,
    "placeId": "ChIJtV5bzSAFdkgRpwLZFPWrJgo",
    "streetAddress": "Buckingham Palace"
  },
  "message": "Address retrieved successfully"
}
```

### 2. Convert Postcode to Address (GET)

**Endpoint:** `GET /api/addresses/postcode/:postcode`
**Access:** Public
**Description:** Convert a UK postcode to address using GET method

**Example:**
```
GET /api/addresses/postcode/M1%201AA
```

**Response:** Same as POST method above

### 3. Validate Postcode Format

**Endpoint:** `POST /api/addresses/validate-postcode`
**Access:** Public
**Description:** Validate UK postcode format without making API call

**Request Body:**
```json
{
  "postcode": "EH1 1YZ"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "postcode": "EH1 1YZ",
    "isValid": true,
    "message": "Valid UK postcode format"
  }
}
```

### 4. Batch Postcode Conversion

**Endpoint:** `POST /api/addresses/batch-postcode-to-address`
**Access:** Private (Admin only)
**Description:** Convert multiple postcodes to addresses (max 10 per request)

**Request Body:**
```json
{
  "postcodes": ["SW1A 1AA", "M1 1AA", "EH1 1YZ"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "postcode": "SW1A 1AA",
      "success": true,
      "data": {
        "formattedAddress": "Buckingham Palace, London SW1A 1AA, UK",
        // ... full address data
      }
    },
    // ... more results
  ],
  "message": "Processed 3 postcodes"
}
```

### 5. API Status

**Endpoint:** `GET /api/addresses/status`
**Access:** Private (Admin only)
**Description:** Check Google Maps API configuration status

**Response:**
```json
{
  "success": true,
  "data": {
    "googleMapsApiConfigured": true,
    "supportedCountry": "United Kingdom",
    "features": [
      "Postcode to address conversion",
      "Address validation",
      "Batch processing",
      "Geocoding (lat/lng coordinates)"
    ]
  },
  "message": "Google Maps API is configured and ready"
}
```

## Address Data Structure

The API returns comprehensive address information:

```javascript
{
  formattedAddress: "Full formatted address from Google",
  postcode: "Original postcode (cleaned)",
  streetNumber: "House/building number",
  streetName: "Street name",
  locality: "Local area/district",
  city: "City/town",
  county: "County/administrative area",
  country: "United Kingdom",
  latitude: 51.501364,
  longitude: -0.14189,
  placeId: "Google Places ID",
  streetAddress: "Combined street number + name"
}
```

## Error Handling

### Common Error Responses

**Invalid Postcode Format:**
```json
{
  "success": false,
  "message": "Invalid UK postcode format"
}
```

**API Key Not Configured:**
```json
{
  "success": false,
  "message": "Google Maps API key is not configured"
}
```

**No Results Found:**
```json
{
  "success": false,
  "message": "No results found for the provided postcode"
}
```

**API Quota Exceeded:**
```json
{
  "success": false,
  "message": "Google Maps API quota exceeded"
}
```

## UK Postcode Validation

The system validates UK postcodes using this regex pattern:
```javascript
/^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i
```

**Valid Examples:**
- `SW1A 1AA`
- `M1 1AA`
- `EH1 1YZ`
- `G1 1AA`
- `B331AA` (without space)

**Invalid Examples:**
- `INVALID123`
- `12345`
- `ABC DEF`

## Testing

### Manual Testing

1. Start the server:
```bash
cd restaurant-api
npm start
```

2. Run the test file:
```bash
node test-google-maps.js
```

### Example Test Postcodes

| Postcode | Location |
|----------|----------|
| SW1A 1AA | Buckingham Palace, London |
| M1 1AA   | Manchester City Centre |
| EH1 1YZ  | Edinburgh City Centre |
| G1 1AA   | Glasgow City Centre |
| B1 1AA   | Birmingham City Centre |

### Using cURL

**Test postcode conversion:**
```bash
curl -X POST http://localhost:5000/api/addresses/postcode-to-address \
  -H "Content-Type: application/json" \
  -d '{"postcode": "SW1A 1AA"}'
```

**Test postcode validation:**
```bash
curl -X POST http://localhost:5000/api/addresses/validate-postcode \
  -H "Content-Type: application/json" \
  -d '{"postcode": "EH1 1YZ"}'
```

## Rate Limiting

- Google Maps API has usage quotas
- Batch requests are limited to 10 postcodes per request
- Small delays (100ms) are added between batch requests
- Consider implementing caching for frequently requested postcodes

## Security Considerations

1. **API Key Security:**
   - Store API key in environment variables
   - Restrict API key to your domain/IP
   - Monitor API usage in Google Cloud Console

2. **Input Validation:**
   - All postcodes are validated before API calls
   - Sanitized and formatted consistently

3. **Error Handling:**
   - Detailed error messages for debugging
   - Generic error messages in production

## Integration Examples

### Frontend Integration

```javascript
// Fetch address from postcode
async function getAddressFromPostcode(postcode) {
  try {
    const response = await fetch('/api/addresses/postcode-to-address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ postcode })
    });
    
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error fetching address:', error);
    throw error;
  }
}

// Usage
getAddressFromPostcode('SW1A 1AA')
  .then(address => {
    console.log('Address:', address.formattedAddress);
    console.log('City:', address.city);
    console.log('County:', address.county);
  })
  .catch(error => {
    console.error('Failed to get address:', error.message);
  });
```

### Backend Integration

```javascript
const googleMapsService = require('./utils/googleMaps');

// Use in other controllers
async function validateCustomerAddress(postcode) {
  const result = await googleMapsService.postcodeToAddress(postcode);
  
  if (result.success) {
    return {
      isValid: true,
      address: result.data
    };
  } else {
    return {
      isValid: false,
      error: result.error
    };
  }
}
```

## Troubleshooting

### Common Issues

1. **"API key not configured" error:**
   - Check `.env` file has `GOOGLE_MAPS_API_KEY`
   - Restart the server after adding the key

2. **"Request denied" error:**
   - Verify API key is correct
   - Check if Geocoding API is enabled in Google Cloud Console
   - Verify API key restrictions

3. **"No results found" error:**
   - Check postcode format is valid
   - Try a different postcode
   - Verify the postcode exists

4. **"Quota exceeded" error:**
   - Check Google Cloud Console for usage limits
   - Consider upgrading your Google Cloud plan
   - Implement caching to reduce API calls

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

This will show detailed error messages and API responses.

## Cost Optimization

1. **Caching:** Implement Redis/MongoDB caching for frequently requested postcodes
2. **Validation:** Always validate postcode format before making API calls
3. **Batch Processing:** Use batch endpoints for multiple postcodes
4. **Monitoring:** Track API usage in Google Cloud Console

## Future Enhancements

1. **Caching Layer:** Add Redis caching for frequently requested postcodes
2. **Alternative APIs:** Integrate UK-specific postcode APIs as fallback
3. **Address Autocomplete:** Add Google Places Autocomplete for better UX
4. **Delivery Zones:** Calculate delivery zones based on coordinates
5. **Distance Calculation:** Add distance calculation between addresses 