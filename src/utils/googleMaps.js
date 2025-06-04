class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    this.mockData = {
      'SW1A 1AA': {
        formattedAddress: 'Buckingham Palace, London SW1A 1AA, UK',
        postcode: 'SW1A 1AA',
        streetNumber: '',
        streetName: 'Buckingham Palace',
        locality: 'Westminster',
        city: 'London',
        county: 'Greater London',
        country: 'United Kingdom',
        latitude: 51.501364,
        longitude: -0.14189,
        placeId: 'mock_place_id_buckingham_palace'
      },
      'SW1A 2AA': {
        formattedAddress: '10 Downing St, London SW1A 2AA, UK',
        postcode: 'SW1A 2AA',
        streetNumber: '10',
        streetName: 'Downing Street',
        locality: 'Westminster',
        city: 'London',
        county: 'Greater London',
        country: 'United Kingdom',
        latitude: 51.5034,
        longitude: -0.1276,
        placeId: 'mock_place_id_downing_street'
      }
    };
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
    try {
      if (!postcode || typeof postcode !== 'string') {
        throw new Error('Valid postcode is required');
      }

      // Clean and format postcode
      const cleanPostcode = postcode.trim().toUpperCase();
      
      // Basic UK postcode validation
      const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
      if (!ukPostcodeRegex.test(cleanPostcode)) {
        throw new Error('Invalid UK postcode format');
      }

      // If API key is not configured, use mock data
      if (!this.apiKey) {
        console.warn('Google Maps API key not configured, using mock data');
        
        // Format postcode with a space if it doesn't have one
        const formattedPostcode = cleanPostcode.replace(/^([A-Z]{1,2}[0-9][A-Z0-9]?)([0-9][A-Z]{2})$/i, '$1 $2');
        
        // Check if we have mock data for this postcode
        if (this.mockData[formattedPostcode]) {
          return {
            success: true,
            data: this.mockData[formattedPostcode]
          };
        }
        
        // Generate mock data for unknown postcodes
        const mockAddress = {
          formattedAddress: `Mock Address, ${formattedPostcode}, UK`,
          postcode: formattedPostcode,
          streetNumber: '123',
          streetName: 'Mock Street',
          locality: 'Mock Locality',
          city: 'Mock City',
          county: 'Mock County',
          country: 'United Kingdom',
          latitude: 51.5 + Math.random() * 0.1,
          longitude: -0.1 + Math.random() * 0.1,
          placeId: `mock_place_id_${formattedPostcode.replace(/\s+/g, '_').toLowerCase()}`
        };
        
        return {
          success: true,
          data: mockAddress,
          isMockData: true
        };
      }

      // Build API URL with parameters
      const params = new URLSearchParams({
        address: cleanPostcode,
        region: 'uk',
        components: 'country:GB',
        key: this.apiKey
      });

      const url = `${this.baseUrl}?${params}`;

      // Get fetch function
      const fetch = await this.getFetch();

      // Make API request
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Maps API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Check API response status
      if (data.status !== 'OK') {
        if (data.status === 'ZERO_RESULTS') {
          throw new Error('No results found for the provided postcode');
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          throw new Error('Google Maps API quota exceeded');
        } else if (data.status === 'REQUEST_DENIED') {
          throw new Error('Google Maps API request denied - check API key');
        } else {
          throw new Error(`Google Maps API error: ${data.status}`);
        }
      }

      if (!data.results || data.results.length === 0) {
        throw new Error('No address found for the provided postcode');
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

    const results = [];
    let hasMockData = false;
    
    // Process postcodes with a small delay to respect API rate limits
    for (const postcode of postcodes) {
      const result = await this.postcodeToAddress(postcode);
      
      // Track if any results are mock data
      if (result.isMockData) {
        hasMockData = true;
      }
      
      results.push({
        postcode,
        ...result
      });
      
      // Small delay to avoid hitting rate limits (only if using real API)
      if (this.apiKey) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      results,
      hasMockData
    };
  }

  /**
   * Calculate distance between two coordinates using the Haversine formula
   * @param {Object} from - Source coordinates {lat, lng}
   * @param {Object} to - Destination coordinates {lat, lng}
   * @param {string} unit - Unit of measurement ('metric' for kilometers, 'imperial' for miles)
   * @returns {Object} - Distance calculation result
   */
  calculateDistance(from, to, unit = 'metric') {
    try {
      if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
        throw new Error('Valid coordinates are required');
      }

      // Convert latitude and longitude from degrees to radians
      const lat1 = parseFloat(from.lat) * Math.PI / 180;
      const lon1 = parseFloat(from.lng) * Math.PI / 180;
      const lat2 = parseFloat(to.lat) * Math.PI / 180;
      const lon2 = parseFloat(to.lng) * Math.PI / 180;

      // Radius of the earth in kilometers or miles
      const R = unit === 'metric' ? 6371 : 3958.8;

      // Haversine formula
      const dLat = lat2 - lat1;
      const dLon = lon2 - lon1;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1) * Math.cos(lat2) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      return {
        success: true,
        data: {
          distance: parseFloat(distance.toFixed(2)),
          unit: unit === 'metric' ? 'kilometers' : 'miles',
          from: {
            lat: from.lat,
            lng: from.lng
          },
          to: {
            lat: to.lat,
            lng: to.lng
          }
        }
      };
    } catch (error) {
      console.error('Distance calculation error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new GoogleMapsService(); 