const mongoose = require('mongoose');

const conversationSchema = mongoose.Schema({
    members: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Users',
        required: true,
        validate: {
            validator: function(v) {
                return v && v.length === 2 && v[0] !== null && v[1] !== null;
            },
            message: 'Members must contain exactly 2 valid user IDs'
        }
    }
}, { timestamps: true });

const Conversations = mongoose.model('Conversation', conversationSchema);
module.exports = Conversations;
