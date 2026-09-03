const express = require('express');
const router = express.Router();
const sellerOrderController = require('../controllers/sellerOrderController');
const { authenticateSeller } = require('../middleware/authMiddleware');

// Get all orders for seller (List page eka)
router.get('/', authenticateSeller, sellerOrderController.getSellerOrders);

// Get single order item details (Details page eka)
router.get('/:itemId', authenticateSeller, sellerOrderController.getOrderItemDetails);

// Update order item status (Confirm, Reject, etc.)
router.patch('/:itemId/status', authenticateSeller, sellerOrderController.updateItemStatus);

module.exports = router;