export const getOrderCustomerDetails = (order) => {
  return {
    firstName: order.orderCustomerDetails?.firstName,
    lastName: order.orderCustomerDetails?.lastName,
    email: order.orderCustomerDetails?.email,
    phone: order.orderCustomerDetails?.phone,
    address: order.orderCustomerDetails?.address,
    latitude: order.orderCustomerDetails?.latitude,
    longitude: order.orderCustomerDetails?.longitude,
  };
};

// to fixed  decimal places
export const toFixed = (value, decimalPlaces = 2) => {
  if (isNaN(value)) {
    return "0.00";
  }
  return Number(value).toFixed(decimalPlaces);
};
