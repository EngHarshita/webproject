const mongoose = require('mongoose');

const messageSchema = mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: false
    },
    type: {
        type: String,
        default: 'text' // 'text', 'image', 'sticker', 'document'
    },
    fileUrl: {
        type: String,
        required: false
    },
    fileName: {
        type: String,
        required: false
    },
    location: {
        latitude: Number,
        longitude: Number
    },
    deletedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isPinned: {
        type: Boolean,
        default: false
    },
    reactions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String
    }]
});

const Messages = mongoose.model('Message', messageSchema);
module.exports = Messages;
