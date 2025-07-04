const googleMapsService = require('../utils/googleMaps');
const axios = require('axios');

// @desc    Convert UK postcode to address
// @route   POST /api/address/postcode-to-address
// @access  Public (can be used for customer address lookup)
const postcodeToAddress = async (req, res) => {
  try {
    const { postcode } = req.body;

    if (!postcode) {
      return res.status(400).json({
        success: false,
        message: 'Postcode is required'
      });
    }

    // Validate postcode format
    if (!googleMapsService.validateUKPostcode(postcode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UK postcode format'
      });
    }

    // Get address from Google Maps API
    const result = await googleMapsService.postcodeToAddress(postcode);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
      message: 'Address retrieved successfully'
    });

  } catch (error) {
    console.error('Error in postcodeToAddress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Convert UK postcode to address (GET method for simple queries)
// @route   GET /api/address/postcode/:postcode
// @access  Public
const getAddressByPostcode = async (req, res) => {
  try {
    const { postcode } = req.params;

    if (!postcode) {
      return res.status(400).json({
        success: false,
        message: 'Postcode is required'
      });
    }

    // Validate postcode format
    if (!googleMapsService.validateUKPostcode(postcode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UK postcode format'
      });
    }

    // Get address from Google Maps API
    const result = await googleMapsService.postcodeToAddress(postcode);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
      message: 'Address retrieved successfully'
    });

  } catch (error) {
    console.error('Error in getAddressByPostcode:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get all addresses for a UK postcode using Ideal Postcodes API
// @route   GET /api/address/postcode1/:postcode
// @access  Public
const getAddressByPostcodeIdeal = async (req, res) => {
  try {
    const { postcode } = req.params;

    if (!postcode) {
      return res.status(400).json({
        success: false,
        message: 'Postcode is required'
      });
    }

    // Validate postcode format
    if (!googleMapsService.validateUKPostcode(postcode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UK postcode format'
      });
    }

    // Get API key from environment variables
    const apiKey = process.env.IDEAL_POSTCODES_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Ideal Postcodes API key is not configured'
      });
    }

    // Clean and format postcode
    const cleanPostcode = postcode.trim().toUpperCase().replace(/\s+/g, '');
    
    // Make API request to Ideal Postcodes
    const url = `https://api.ideal-postcodes.co.uk/v1/postcodes/${cleanPostcode}?api_key=${apiKey}`;
    
    const response = await axios.get(url);
    
    // Check if we got a successful response
    if (response.data && response.data.result) {
      return res.status(200).json({
        success: true,
        data: response.data.result,
        message: `Found ${response.data.result.length} addresses for postcode ${postcode}`
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'No addresses found for the provided postcode'
      });
    }

  } catch (error) {
    console.error('Error in getAddressByPostcodeIdeal:', error);
    
    // Handle specific API errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 404) {
        return res.status(404).json({
          success: false,
          message: 'No addresses found for the provided postcode'
        });
      } else if (status === 401 || status === 403) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key or unauthorized access to Ideal Postcodes API'
        });
      } else if (data && data.message) {
        return res.status(status).json({
          success: false,
          message: data.message
        });
      }
    }
    
    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Error fetching addresses from Ideal Postcodes API',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Validate UK postcode format
// @route   POST /api/address/validate-postcode
// @access  Public
const validatePostcode = async (req, res) => {
  try {
    const { postcode } = req.body;

    if (!postcode) {
      return res.status(400).json({
        success: false,
        message: 'Postcode is required'
      });
    }

    const isValid = googleMapsService.validateUKPostcode(postcode);

    res.status(200).json({
      success: true,
      data: {
        postcode: postcode.trim().toUpperCase(),
        isValid,
        message: isValid ? 'Valid UK postcode format' : 'Invalid UK postcode format'
      }
    });

  } catch (error) {
    console.error('Error in validatePostcode:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Convert multiple UK postcodes to addresses
// @route   POST /api/address/batch-postcode-to-address
// @access  Private (Admin only - for bulk operations)
const batchPostcodeToAddress = async (req, res) => {
  try {
    const { postcodes } = req.body;

    if (!postcodes || !Array.isArray(postcodes)) {
      return res.status(400).json({
        success: false,
        message: 'Postcodes array is required'
      });
    }

    if (postcodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one postcode is required'
      });
    }

    if (postcodes.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 postcodes allowed per batch request'
      });
    }

    // Validate all postcodes first
    const invalidPostcodes = postcodes.filter(postcode => 
      !googleMapsService.validateUKPostcode(postcode)
    );

    if (invalidPostcodes.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid postcode format found',
        invalidPostcodes
      });
    }

    // Process batch request
    const result = await googleMapsService.batchPostcodeToAddress(postcodes);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.results,
      message: `Processed ${result.results.length} postcodes`
    });

  } catch (error) {
    console.error('Error in batchPostcodeToAddress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Get API status and configuration
// @route   GET /api/address/status
// @access  Private (Admin only)
const getApiStatus = async (req, res) => {
  try {
    const hasGoogleApiKey = !!process.env.GOOGLE_MAPS_API_KEY;
    const hasIdealPostcodesApiKey = !!process.env.IDEAL_POSTCODES_API_KEY;
    
    res.status(200).json({
      success: true,
      data: {
        googleMapsApiConfigured: hasGoogleApiKey,
        idealPostcodesApiConfigured: hasIdealPostcodesApiKey,
        supportedCountry: 'United Kingdom',
        features: [
          'Postcode to address conversion',
          'Address validation',
          'Batch processing',
          'Geocoding (lat/lng coordinates)',
          'Distance calculation between coordinates',
          'Multiple addresses per postcode (Ideal Postcodes API)'
        ],
        distanceCalculationModes: [
          'driving',
          'walking',
          'bicycling',
          'transit'
        ],
        units: [
          'metric (kilometers)',
          'imperial (miles)'
        ]
      },
      message: hasGoogleApiKey && hasIdealPostcodesApiKey
        ? 'All APIs are configured and ready'
        : 'Some API keys are not configured'
    });

  } catch (error) {
    console.error('Error in getApiStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// @desc    Calculate distance between two coordinates
// @route   POST /api/address/distance
// @access  Public
const calculateDistance = async (req, res) => {
  try {
    const { from, to, unit, mode } = req.body;

    // Validate required parameters
    if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
      return res.status(400).json({
        success: false,
        message: 'Valid coordinates (lat, lng) are required for both from and to locations'
      });
    }

    // Validate unit if provided
    const validUnits = ['metric', 'imperial'];
    if (unit && !validUnits.includes(unit)) {
      return res.status(400).json({
        success: false,
        message: 'Unit must be either "metric" or "imperial"'
      });
    }

    // Validate mode if provided
    const validModes = ['driving', 'walking', 'bicycling', 'transit'];
    if (mode && !validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'Mode must be one of: driving, walking, bicycling, transit'
      });
    }

    // Calculate distance using the Google Maps service
    const result = await googleMapsService.calculateDistance(from, to, unit || 'metric', mode || 'driving');  

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
      message: 'Distance calculated successfully'
    });

  } catch (error) {
    console.error('Error in calculateDistance:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

module.exports = {
  postcodeToAddress,
  getAddressByPostcode,
  getAddressByPostcodeIdeal,
  validatePostcode,
  batchPostcodeToAddress,
  getApiStatus,
  calculateDistance
}; 