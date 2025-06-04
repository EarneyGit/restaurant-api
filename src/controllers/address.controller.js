const googleMapsService = require('../utils/googleMaps');

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

    // Add a note if using mock data
    const responseData = {
      success: true,
      data: result.data,
      message: 'Address retrieved successfully'
    };
    
    if (result.isMockData) {
      responseData.note = 'Using mock data because Google Maps API key is not configured';
    }

    res.status(200).json(responseData);

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

    // Add a note if using mock data
    const responseData = {
      success: true,
      data: result.data,
      message: 'Address retrieved successfully'
    };
    
    if (result.isMockData) {
      responseData.note = 'Using mock data because Google Maps API key is not configured';
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error in getAddressByPostcode:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
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

    const responseData = {
      success: true,
      data: result.results,
      message: `Processed ${result.results.length} postcodes`
    };

    // Add a note if using mock data
    if (result.hasMockData) {
      responseData.note = 'Using mock data because Google Maps API key is not configured';
    }

    res.status(200).json(responseData);

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
    const hasApiKey = !!process.env.GOOGLE_MAPS_API_KEY;
    
    res.status(200).json({
      success: true,
      data: {
        googleMapsApiConfigured: hasApiKey,
        supportedCountry: 'United Kingdom',
        features: [
          'Postcode to address conversion',
          'Address validation',
          'Batch processing',
          'Geocoding (lat/lng coordinates)'
        ]
      },
      message: hasApiKey 
        ? 'Google Maps API is configured and ready' 
        : 'Google Maps API key is not configured'
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
    const { from, to, unit } = req.body;

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

    // Calculate distance using the Google Maps service
    const result = googleMapsService.calculateDistance(from, to, unit || 'metric');

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
  validatePostcode,
  batchPostcodeToAddress,
  getApiStatus,
  calculateDistance
}; 