class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    this.routesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    this.directionsUrl = 'https://maps.googleapis.com/maps/api/directions/json';
    this.distanceMatrixUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
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
            error: 'Google Maps API request denied - check API key',
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
   * Calculate distance between two coordinates using Google Maps APIs
   * Tries multiple APIs in sequence: Routes API (v2) -> Directions API -> Distance Matrix API -> Mock calculation
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

      // Get fetch function
      const fetch = await this.getFetch();

      try {
        // First try the Routes API (v2)
        console.log("Attempting to use Routes API...");
        const result = await this.calculateDistanceWithRoutesAPI(fetch, from, to, unit, mode);
        return result;
      } catch (routesError) {
        console.log("Routes API failed, falling back to Directions API:", routesError.message);
        
        try {
          // If Routes API fails, try Directions API
          console.log("Attempting to use Directions API...");
          const result = await this.calculateDistanceWithDirectionsAPI(fetch, from, to, unit, mode);
          return result;
        } catch (directionsError) {
          console.log("Directions API failed, falling back to Distance Matrix API:", directionsError.message);
          
          try {
            // If Directions API fails, try Distance Matrix API
            console.log("Attempting to use Distance Matrix API...");
            const result = await this.calculateDistanceWithDistanceMatrixAPI(fetch, from, to, unit, mode);
            return result;
          } catch (distanceMatrixError) {
            console.log("All Google Maps APIs failed, using mock implementation:", distanceMatrixError.message);
            
            // If all APIs fail, use a mock implementation with the Haversine formula
            console.log("Using mock distance calculation (Haversine formula)...");
            return this.calculateDistanceWithHaversine(from, to, unit, mode);
          }
        }
      }
    } catch (error) {
      console.error('Google Maps API Error:', error.message);
      
      // Final fallback - use Haversine formula
      console.log("Using mock distance calculation as final fallback...");
      return this.calculateDistanceWithHaversine(from, to, unit, mode);
    }
  }
  
  /**
   * Calculate distance using the Routes API (v2)
   * @private
   */
  async calculateDistanceWithRoutesAPI(fetch, from, to, unit, mode) {
    // Convert travel mode to Routes API format
    let travelMode;
    switch (mode) {
      case 'driving':
        travelMode = 'DRIVE';
        break;
      case 'walking':
        travelMode = 'WALK';
        break;
      case 'bicycling':
        travelMode = 'BICYCLE';
        break;
      case 'transit':
        travelMode = 'TRANSIT';
        break;
      default:
        travelMode = 'DRIVE';
    }
    
    // Prepare request body for the Routes API
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: from.lat,
            longitude: from.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: to.lat,
            longitude: to.lng
          }
        }
      },
      travelMode: travelMode,
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false
      },
      languageCode: "en-US",
      units: unit === 'metric' ? "METRIC" : "IMPERIAL"
    };

    // Make API request with proper headers
    const response = await fetch(this.routesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs,routes.travelAdvisory'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Routes API Error:", errorText);
      
      // Check if the error is due to the API not being enabled
      if (errorText.includes("SERVICE_DISABLED") || errorText.includes("PERMISSION_DENIED")) {
        throw new Error("Routes API is not enabled for this project. Please enable it in the Google Cloud Console.");
      }
      
      throw new Error(`Google Maps Routes API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Routes API response:", data);

    // Check if routes were found
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found between the provided coordinates');
    }

    // Extract route information
    const route = data.routes[0];
    const distanceInMeters = route.distanceMeters;
    const durationInSeconds = parseInt(route.duration.replace('s', ''));
    
    // Format distance based on unit
    let distanceText;
    if (unit === 'metric') {
      const distanceInKm = distanceInMeters / 1000;
      distanceText = `${distanceInKm.toFixed(1)} km`;
    } else {
      const distanceInMiles = distanceInMeters / 1609.34;
      distanceText = `${distanceInMiles.toFixed(1)} mi`;
    }
    
    // Format duration
    let durationText;
    if (durationInSeconds < 60) {
      durationText = `${durationInSeconds} secs`;
    } else if (durationInSeconds < 3600) {
      const minutes = Math.floor(durationInSeconds / 60);
      durationText = `${minutes} mins`;
    } else {
      const hours = Math.floor(durationInSeconds / 3600);
      const minutes = Math.floor((durationInSeconds % 3600) / 60);
      durationText = `${hours} hour${hours > 1 ? 's' : ''} ${minutes} mins`;
    }

    // Get addresses from the legs
    let originAddress = '';
    let destinationAddress = '';
    
    if (route.legs && route.legs.length > 0) {
      const leg = route.legs[0];
      if (leg.startLocation) {
        originAddress = `${leg.startLocation.latitude},${leg.startLocation.longitude}`;
      }
      if (leg.endLocation) {
        destinationAddress = `${leg.endLocation.latitude},${leg.endLocation.longitude}`;
      }
    }

    // Format the response to match the legacy API format for compatibility
    return {
      success: true,
      data: {
        distance: {
          value: distanceInMeters, // Distance in meters
          text: distanceText       // Formatted distance (e.g., "5.2 km")
        },
        duration: {
          value: durationInSeconds, // Duration in seconds
          text: durationText        // Formatted duration (e.g., "10 mins")
        },
        from: {
          lat: from.lat,
          lng: from.lng,
          address: originAddress
        },
        to: {
          lat: to.lat,
          lng: to.lng,
          address: destinationAddress
        },
        unit: unit === 'metric' ? 'kilometers' : 'miles',
        mode: mode
      }
    };
  }
  
  /**
   * Calculate distance using the Directions API (fallback)
   * @private
   */
  async calculateDistanceWithDirectionsAPI(fetch, from, to, unit, mode) {
    // Format coordinates for the API
    const origin = `${from.lat},${from.lng}`;
    const destination = `${to.lat},${to.lng}`;
    
    // Build API URL with parameters
    const params = new URLSearchParams({
      origin,
      destination,
      mode: mode,
      units: unit === 'metric' ? 'metric' : 'imperial',
      key: this.apiKey
    });

    const url = `${this.directionsUrl}?${params}`;
    
    // Make API request
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Maps Directions API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Directions API response:", data);

    // Check API response status
    if (data.status !== 'OK') {
      let errorMessage = `Google Maps Directions API error: ${data.status}`;
      
      if (data.error_message) {
        errorMessage += ` - ${data.error_message}`;
      }
      
      // Add helpful instructions for common errors
      if (data.status === 'REQUEST_DENIED') {
        errorMessage += '. Please make sure the Directions API is enabled in your Google Cloud Console.';
      }
      
      throw new Error(errorMessage);
    }

    // Extract route information
    if (!data.routes || !data.routes[0] || !data.routes[0].legs || !data.routes[0].legs[0]) {
      throw new Error('No route found between the provided coordinates');
    }

    const leg = data.routes[0].legs[0];
    
    // Format the response to match the expected format
    return {
      success: true,
      data: {
        distance: {
          value: leg.distance.value, // Distance in meters
          text: leg.distance.text    // Formatted distance (e.g., "5.2 km")
        },
        duration: {
          value: leg.duration.value, // Duration in seconds
          text: leg.duration.text    // Formatted duration (e.g., "10 mins")
        },
        from: {
          lat: from.lat,
          lng: from.lng,
          address: leg.start_address
        },
        to: {
          lat: to.lat,
          lng: to.lng,
          address: leg.end_address
        },
        unit: unit === 'metric' ? 'kilometers' : 'miles',
        mode: mode
      }
    };
  }
  
  /**
   * Calculate distance using the Distance Matrix API (final fallback)
   * @private
   */
  async calculateDistanceWithDistanceMatrixAPI(fetch, from, to, unit, mode) {
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

    const url = `${this.distanceMatrixUrl}?${params}`;
    
    // Make API request
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Maps Distance Matrix API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Distance Matrix API response:", data);

    // Check API response status
    if (data.status !== 'OK') {
      let errorMessage = `Google Maps Distance Matrix API error: ${data.status}`;
      
      if (data.error_message) {
        errorMessage += ` - ${data.error_message}`;
      }
      
      throw new Error(errorMessage + ". Please enable at least one of these APIs in your Google Cloud Console: Routes API, Directions API, or Distance Matrix API.");
    }

    // Extract distance and duration from response
    if (!data.rows || !data.rows[0] || !data.rows[0].elements || !data.rows[0].elements[0]) {
      throw new Error('No route found between the provided coordinates');
    }

    const element = data.rows[0].elements[0];
    
    if (element.status !== 'OK') {
      throw new Error(`Route calculation failed: ${element.status}`);
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
        mode: mode,
        source: 'Distance Matrix API'
      }
    };
  }
  
  /**
   * Calculate distance using the Haversine formula (as the crow flies)
   * This is a mock implementation that doesn't require API access
   * @private
   */
  calculateDistanceWithHaversine(from, to, unit = 'metric', mode = 'driving') {
    // Implementation of the Haversine formula to calculate distance between two points
    const R = 6371e3; // Earth's radius in meters
    const φ1 = this.toRadians(from.lat);
    const φ2 = this.toRadians(to.lat);
    const Δφ = this.toRadians(to.lat - from.lat);
    const Δλ = this.toRadians(to.lng - from.lng);

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    // Distance in meters (as the crow flies)
    const distanceInMeters = R * c;
    
    // Apply a multiplier based on mode to simulate real-world routes
    // These are rough estimates as real routes are longer than straight lines
    let routeMultiplier;
    switch (mode) {
      case 'driving':
        routeMultiplier = 1.3; // Roads are typically 30% longer than direct path
        break;
      case 'walking':
        routeMultiplier = 1.4; // Walking paths can be even longer
        break;
      case 'bicycling':
        routeMultiplier = 1.35; // Bike paths are somewhere in between
        break;
      case 'transit':
        routeMultiplier = 1.5; // Public transit often takes longer routes
        break;
      default:
        routeMultiplier = 1.3;
    }
    
    const adjustedDistanceInMeters = distanceInMeters * routeMultiplier;
    
    // Format distance based on unit
    let distanceText;
    if (unit === 'metric') {
      const distanceInKm = adjustedDistanceInMeters / 1000;
      distanceText = `${distanceInKm.toFixed(1)} km`;
    } else {
      const distanceInMiles = adjustedDistanceInMeters / 1609.34;
      distanceText = `${distanceInMiles.toFixed(1)} mi`;
    }
    
    // Estimate duration based on mode and distance
    // These are very rough estimates of average speeds
    let speedMetersPerSecond;
    switch (mode) {
      case 'driving':
        speedMetersPerSecond = 13.9; // ~50 km/h or ~31 mph
        break;
      case 'walking':
        speedMetersPerSecond = 1.4; // ~5 km/h or ~3.1 mph
        break;
      case 'bicycling':
        speedMetersPerSecond = 4.2; // ~15 km/h or ~9.3 mph
        break;
      case 'transit':
        speedMetersPerSecond = 8.3; // ~30 km/h or ~18.6 mph
        break;
      default:
        speedMetersPerSecond = 13.9;
    }
    
    const durationInSeconds = Math.round(adjustedDistanceInMeters / speedMetersPerSecond);
    
    // Format duration
    let durationText;
    if (durationInSeconds < 60) {
      durationText = `${durationInSeconds} secs`;
    } else if (durationInSeconds < 3600) {
      const minutes = Math.floor(durationInSeconds / 60);
      durationText = `${minutes} mins`;
    } else {
      const hours = Math.floor(durationInSeconds / 3600);
      const minutes = Math.floor((durationInSeconds % 3600) / 60);
      durationText = `${hours} hour${hours > 1 ? 's' : ''} ${minutes} mins`;
    }

    // Format the response to match the API format
    return {
      success: true,
      data: {
        distance: {
          value: Math.round(adjustedDistanceInMeters), // Distance in meters
          text: distanceText       // Formatted distance (e.g., "5.2 km")
        },
        duration: {
          value: durationInSeconds, // Duration in seconds
          text: durationText        // Formatted duration (e.g., "10 mins")
        },
        from: {
          lat: from.lat,
          lng: from.lng,
          address: `${from.lat},${from.lng}`
        },
        to: {
          lat: to.lat,
          lng: to.lng,
          address: `${to.lat},${to.lng}`
        },
        unit: unit === 'metric' ? 'kilometers' : 'miles',
        mode: mode,
        source: 'Mock calculation (Haversine formula)',
        note: 'This is an estimated distance calculation as Google Maps APIs are not enabled. For accurate results, please enable the Routes API in your Google Cloud Console.'
      }
    };
  }
  
  /**
   * Convert degrees to radians
   * @private
   */
  toRadians(degrees) {
    return degrees * Math.PI / 180;
  }
}

module.exports = new GoogleMapsService(); 