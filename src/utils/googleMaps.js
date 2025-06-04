class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    this.routesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  }

  /**
   * Dynamic import for node-fetch (ES module)
   */
  async getFetch() {
    const { default: fetch } = await import('node-fetch');
    return fetch;
  }

  /**
   * Convert UK postcode to address using Google Maps Geocoding API
   * @param {string} postcode - UK postcode
   * @returns {Promise<Object>} - Address details
   */
  async postcodeToAddress(postcode) {
    console.log(`postcodeToAddress: ${this.apiKey}`);
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'Google Maps API key is not configured. Please add a valid API key to your environment variables.'
        };
      }

      if (!postcode || typeof postcode !== 'string') {
        return {
          success: false,
          error: 'Valid postcode is required'
        };
      }

      // Clean and format postcode
      const cleanPostcode = postcode.trim().toUpperCase();
      
      // Basic UK postcode validation
      const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
      if (!ukPostcodeRegex.test(cleanPostcode)) {
        return {
          success: false,
          error: 'Invalid UK postcode format'
        };
      }

      // Build API URL with parameters
      const params = new URLSearchParams({
        address: cleanPostcode,
        region: 'uk',
        components: 'country:GB',
        key: this.apiKey
      });

      const url = `${this.geocodeUrl}?${params}`;

      // Get fetch function
      const fetch = await this.getFetch();

      // Make API request
      const response = await fetch(url);
      
      if (!response.ok) {
        return {
          success: false,
          error: `Google Maps API request failed: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();

      // Check API response status
      if (data.status !== 'OK') {
        if (data.status === 'ZERO_RESULTS') {
          return {
            success: false,
            error: 'No results found for the provided postcode'
          };
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          return {
            success: false,
            error: 'Google Maps API quota exceeded'
          };
        } else if (data.status === 'REQUEST_DENIED') {
          return {
            success: false,
            error: 'Google Maps API request denied - check API key'
          };
        } else {
          return {
            success: false,
            error: `Google Maps API error: ${data.status}`
          };
        }
      }

      if (!data.results || data.results.length === 0) {
        return {
          success: false,
          error: 'No address found for the provided postcode'
        };
      }

      // Extract address components from the first result
      const result = data.results[0];
      const addressComponents = result.address_components;
      
      // Parse address components
      const addressData = {
        formattedAddress: result.formatted_address,
        postcode: cleanPostcode,
        streetNumber: '',
        streetName: '',
        locality: '',
        city: '',
        county: '',
        country: 'United Kingdom',
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        placeId: result.place_id
      };

      // Extract specific components
      addressComponents.forEach(component => {
        const types = component.types;
        
        if (types.includes('street_number')) {
          addressData.streetNumber = component.long_name;
        } else if (types.includes('route')) {
          addressData.streetName = component.long_name;
        } else if (types.includes('locality')) {
          addressData.locality = component.long_name;
        } else if (types.includes('postal_town')) {
          addressData.city = component.long_name;
        } else if (types.includes('administrative_area_level_2')) {
          addressData.county = component.long_name;
        } else if (types.includes('country')) {
          addressData.country = component.long_name;
        }
      });

      // Build street address
      const streetParts = [addressData.streetNumber, addressData.streetName].filter(Boolean);
      addressData.streetAddress = streetParts.join(' ');

      // Use locality as city if city is empty
      if (!addressData.city && addressData.locality) {
        addressData.city = addressData.locality;
      }

      return {
        success: true,
        data: addressData
      };

    } catch (error) {
      console.error('Google Maps API Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate UK postcode format
   * @param {string} postcode - Postcode to validate
   * @returns {boolean} - True if valid UK postcode format
   */
  validateUKPostcode(postcode) {
    if (!postcode || typeof postcode !== 'string') {
      return false;
    }

    const cleanPostcode = postcode.trim().toUpperCase();
    const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
    return ukPostcodeRegex.test(cleanPostcode);
  }

  /**
   * Get multiple addresses for multiple postcodes
   * @param {string[]} postcodes - Array of UK postcodes
   * @returns {Promise<Object[]>} - Array of address results
   */
  async batchPostcodeToAddress(postcodes) {
    if (!Array.isArray(postcodes)) {
      throw new Error('Postcodes must be an array');
    }

    if (!this.apiKey) {
      return {
        success: false,
        error: 'Google Maps API key is not configured. Please add a valid API key to your environment variables.'
      };
    }

    const results = [];
    
    // Process postcodes with a small delay to respect API rate limits
    for (const postcode of postcodes) {
      const result = await this.postcodeToAddress(postcode);
      results.push({
        postcode,
        ...result
      });
      
      // Small delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: true,
      results
    };
  }

  /**
   * Calculate distance between two coordinates using Google Maps Distance Matrix API
   * @param {Object} from - Source coordinates {lat, lng}
   * @param {Object} to - Destination coordinates {lat, lng}
   * @param {string} unit - Unit of measurement ('metric' for kilometers, 'imperial' for miles)
   * @param {string} mode - Travel mode ('driving', 'walking', 'bicycling', 'transit')
   * @returns {Object} - Distance calculation result
   */
  async calculateDistance(from, to, unit = 'metric', mode = 'driving') {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'Google Maps API key is not configured. Please add a valid API key to your environment variables.'
        };
      }

      if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
        return {
          success: false,
          error: 'Valid coordinates are required'
        };
      }

      // Try the Distance Matrix API first (legacy API)
      const distanceMatrixUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
      
      // Format coordinates for the API
      const origins = `${from.lat},${from.lng}`;
      const destinations = `${to.lat},${to.lng}`;
      
      // Build API URL with parameters
      const params = new URLSearchParams({
        origins,
        destinations,
        mode: mode,
        units: unit === 'metric' ? 'metric' : 'imperial',
        key: this.apiKey
      });

      const url = `${distanceMatrixUrl}?${params}`;

      // Get fetch function
      const fetch = await this.getFetch();

      // Make API request
      const response = await fetch(url);
      
      if (!response.ok) {
        return {
          success: false,
          error: `Google Maps API request failed: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log("Distance Matrix API response:", data);

      // Check API response status
      if (data.status !== 'OK') {
        return {
          success: false,
          error: `Google Maps Distance Matrix API error: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}`
        };
      }

      // Extract distance and duration from response
      if (!data.rows || !data.rows[0] || !data.rows[0].elements || !data.rows[0].elements[0]) {
        return {
          success: false,
          error: 'No route found between the provided coordinates'
        };
      }

      const element = data.rows[0].elements[0];
      
      if (element.status !== 'OK') {
        return {
          success: false,
          error: `Route calculation failed: ${element.status}`
        };
      }

      // Format the response
      return {
        success: true,
        data: {
          distance: {
            value: element.distance.value, // Distance in meters
            text: element.distance.text    // Formatted distance (e.g., "5.2 km")
          },
          duration: {
            value: element.duration.value, // Duration in seconds
            text: element.duration.text    // Formatted duration (e.g., "10 mins")
          },
          from: {
            lat: from.lat,
            lng: from.lng,
            address: data.origin_addresses[0]
          },
          to: {
            lat: to.lat,
            lng: to.lng,
            address: data.destination_addresses[0]
          },
          unit: unit === 'metric' ? 'kilometers' : 'miles',
          mode: mode
        }
      };
    } catch (error) {
      console.error('Google Maps API Error:', error.message);
      return {
        success: false,
        error: `Google Maps API Error: ${error.message}`
      };
    }
  }
}

module.exports = new GoogleMapsService(); 