const Conversations = require('../models/Conversations');
const Users = require('../models/Users');

// 1. Create a new conversation
const createConversation = async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        
        // Handle both camelCase (Id) and uppercase (ID) for robustness
        const finalSenderId = senderId || req.body.senderID;
        const finalReceiverId = receiverId || req.body.receiverID;

        if (!finalSenderId || !finalReceiverId) {
            return res.status(400).json({ error: 'senderId and receiverId are required' });
        }

        // Check if conversation already exists
        const existingConversation = await Conversations.findOne({
            members: { $all: [finalSenderId, finalReceiverId] }
        });

        if (existingConversation) {
            return res.status(200).json(existingConversation);
        }

        const newConversation = new Conversations({
            members: [finalSenderId, finalReceiverId]
        });

        const savedConversation = await newConversation.save();
        res.status(200).json(savedConversation);
    } catch (error) {
        console.error('Error in createConversation:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
};

// 2. Get conversations for a specific user
const getConversation = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const conversations = await Conversations.find({
            members: { $in: [userId] }
        });

        // Populate user details for each conversation
        const conversationData = await Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member.toString() !== userId);
            const user = await Users.findById(receiverId);
            
            // Fetch the last message for smart preview
            const MessagesModel = require('../models/Messages');
            const lastMessageObj = await MessagesModel.findOne({ conversationId: conversation._id })
                                      .sort({ createdAt: -1 })
                                      .select('message type createdAt');

            return {
                user: {
                    receiverId: user?._id,
                    email: user?.email,
                    fullName: user?.fullName
                },
                conversationId: conversation._id,
                lastMessage: lastMessageObj ? (lastMessageObj.type === 'text' ? lastMessageObj.message : `[${lastMessageObj.type}]`) : 'No messages yet',
                lastMessageTime: lastMessageObj ? lastMessageObj.createdAt : null
            };
        }));

        res.status(200).json(conversationData);
    } catch (error) {
        console.error('Error in getConversation:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
};

// 3. Find a specific conversation between two users
const findConversation = async (req, res) => {
    try {
        const { firstUserId, secondUserId } = req.params;

        if (!firstUserId || !secondUserId) {
            return res.status(400).json({ error: 'Both user IDs are required' });
        }

        const conversation = await Conversations.findOne({
            members: { $all: [firstUserId, secondUserId] }
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.status(200).json(conversation);
    } catch (error) {
        console.error('Error in findConversation:', error);
        res.status(500).json({ error: 'Server Error', details: error.message });
    }
};

module.exports = {
    createConversation,
    getConversation,
    findConversation
};
