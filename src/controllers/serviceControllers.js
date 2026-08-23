

export const bookService = async (req, res) => {
    res.status(201).json({ message: "Service booked successfully", bookingDetails: req.body });
};

export const getMyBookings = async (req, res) => {
    res.status(200).json({ bookings: [] });
};

export const updateBooking = async (req, res) => {
    res.status(200).json({ message: `Booking ${req.params.id} updated/cancelled` });
};
// Get all available services (Discovery)
export const getAllServices = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: "Services fetched successfully",
            data: [
                { id: 1, title: "AC Repair", category: "Home Services", rate: "LKR 2500/hr" },
                { id: 2, title: "Web Development", category: "IT", rate: "LKR 5000/hr" }
            ]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch services" });
    }
};

// Create a new service booking
export const createServiceBooking = async (req, res) => {
    try {
        const { serviceId, appointmentDate, notes } = req.body;
        // Mocking user ID from authMiddleware
        const buyerId = req.user.id; 

        res.status(201).json({
            success: true,
            message: "Service booking request placed",
            bookingDetails: { buyerId, serviceId, appointmentDate, status: "PENDING" }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Booking failed" });
    }
};

// Update Booking Status (Confirm/Cancel/Complete)
export const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // e.g., "CONFIRMED", "COMPLETED"

        res.status(200).json({
            success: true,
            message: `Booking ${id} status updated to ${status}`,
            data: { bookingId: id, newStatus: status }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Status update failed" });
    }
};

// Get specific service details
export const getServiceById = async (req, res) => {
    res.status(200).json({
        success: true,
        data: { id: req.params.id, title: "Sample Service", description: "Detailed info here" }
    });
};

// Get all services owned by a provider
export const getProviderServices = async (req, res) => {
    res.status(200).json({
        success: true,
        providerId: req.user.id,
        services: [{ id: 101, name: "Consultation" }]
    });

};
