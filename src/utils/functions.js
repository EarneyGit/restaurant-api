export const getOrderCustomerDetails = (order) => {
  if (order.isGuestOrder) {
    return {
      firstName: order.orderCustomerDetails?.firstName,
      lastName: order.orderCustomerDetails?.lastName,
      email: order.orderCustomerDetails?.email,
      phone: order.orderCustomerDetails?.phone,
      address: order.orderCustomerDetails?.address,
      latitude: order.orderCustomerDetails?.latitude,
      longitude: order.orderCustomerDetails?.longitude,
    };
  }
  return order.user;
};