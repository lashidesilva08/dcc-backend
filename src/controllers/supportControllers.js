export const submitInquiry = async (req, res) => {
    try {
        res.status(201).json({ message: "Support inquiry submitted successfully." });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getAllTickets = async (req, res) => {
    try {
        res.status(200).json({ message: "All support tickets retrieved for admin." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};