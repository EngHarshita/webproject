const router = require('express').Router();
const {
    createConversation,
    getConversation,
    findConversation
} = require('../controllers/conversationController');

// POST /api/conversation - Create a new conversation
router.post('/', createConversation);

// GET /api/conversation/:userId - Get all conversations for a user
router.get('/:userId', getConversation);

// GET /api/conversation/find/:firstUserId/:secondUserId - Find conversation between two users
router.get('/find/:firstUserId/:secondUserId', findConversation);

module.exports = router;
