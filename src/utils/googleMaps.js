class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
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
      if (!this.apiKey) {
        throw new Error('Google Maps API key is not configured');
      }

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

    return results;
  }
}

module.exports = new GoogleMapsService(); 