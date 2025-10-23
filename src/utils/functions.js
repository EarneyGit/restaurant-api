const getOrderCustomerDetails = (order = {}) => {
  const details = order.orderCustomerDetails || {};
  return {
    firstName: details.firstName || "",
    lastName: details.lastName || "",
    email: details.email || "",
    phone: details.phone || "",
    address: details.address || "",
    latitude: details.latitude || null,
    longitude: details.longitude || null,
  };
};

const toFixed = (value, decimalPlaces = 2) => {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.00";
  return num.toFixed(decimalPlaces);
};

const formatCurrency = (amount) => `£${toFixed(amount, 2)}`;

module.exports = {
  getOrderCustomerDetails,
  toFixed,
  formatCurrency,
};
