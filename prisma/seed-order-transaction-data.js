const orderTransactionSeedData = {
  deliveryProviders: [
    {
      providerName: "City Express Delivery",
      contactPerson: "Nimal Perera",
      email: "cityexpress@example.com",
      phone: "0771234567",
      serviceArea: "Colombo, Gampaha",
      baseFee: 350.0,
      status: "active",
      updatedAt: new Date()
    },
    {
      providerName: "Lanka Quick Couriers",
      contactPerson: "Sanduni Silva",
      email: "lankaquick@example.com",
      phone: "0769876543",
      serviceArea: "Kandy, Kurunegala",
      baseFee: 450.0,
      status: "active",
      updatedAt: new Date()
    }
  ],

  orders: [
    {
      userId: 1,
      orderNumber: "DCC-ORD-0001",
      totalAmount: 7350.0,
      deliveryFee: 350.0,
      paymentMethod: "PayHere",
      paymentStatus: "paid",
      orderStatus: "confirmed",
      deliveryAddress: "No. 15, Galle Road, Colombo 03",
      notes: "Please deliver between 9 AM and 5 PM.",
      updatedAt: new Date()
    },
    {
      userId: 1,
      orderNumber: "DCC-ORD-0002",
      totalAmount: 4250.0,
      deliveryFee: 450.0,
      paymentMethod: "COD",
      paymentStatus: "pending",
      orderStatus: "placed",
      deliveryAddress: "No. 22, Peradeniya Road, Kandy",
      notes: "Call before delivery.",
      updatedAt: new Date()
    }
  ],

  orderItems: [
    {
      orderId: 1,
      listingId: 1,
      sellerId: 1,
      quantity: 2,
      unitPrice: 2500.0,
      subtotal: 5000.0,
      itemStatus: "confirmed",
      updatedAt: new Date()
    },
    {
      orderId: 1,
      listingId: 2,
      sellerId: 1,
      quantity: 1,
      unitPrice: 2000.0,
      subtotal: 2000.0,
      itemStatus: "confirmed",
      updatedAt: new Date()
    },
    {
      orderId: 2,
      listingId: 1,
      sellerId: 1,
      quantity: 1,
      unitPrice: 3800.0,
      subtotal: 3800.0,
      itemStatus: "placed",
      updatedAt: new Date()
    }
  ],

  transactions: [
    {
      orderId: 1,
      transactionReference: "TXN-PH-0001",
      paymentGateway: "PayHere",
      amount: 7350.0,
      currency: "LKR",
      status: "paid",
      gatewayResponse: {
        gateway: "PayHere",
        message: "Payment successful"
      },
      paidAt: new Date(),
      updatedAt: new Date()
    },
    {
      orderId: 2,
      transactionReference: "TXN-COD-0002",
      paymentGateway: "COD",
      amount: 4250.0,
      currency: "LKR",
      status: "pending",
      gatewayResponse: null,
      paidAt: null,
      updatedAt: new Date()
    }
  ],

  deliveries: [
    {
      orderId: 1,
      deliveryProviderId: 1,
      trackingNumber: "DCC-TRK-0001",
      pickupAddress: "Seller Store, Colombo 04",
      deliveryAddress: "No. 15, Galle Road, Colombo 03",
      deliveryStatus: "assigned",
      assignedAt: new Date(),
      pickedUpAt: null,
      deliveredAt: null,
      updatedAt: new Date()
    },
    {
      orderId: 2,
      deliveryProviderId: 2,
      trackingNumber: "DCC-TRK-0002",
      pickupAddress: "Seller Store, Kandy",
      deliveryAddress: "No. 22, Peradeniya Road, Kandy",
      deliveryStatus: "pending",
      assignedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      updatedAt: new Date()
    }
  ]
};

module.exports = orderTransactionSeedData;
