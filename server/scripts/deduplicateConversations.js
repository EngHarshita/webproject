const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://chat_app_admin:harshita1234@cluster0.ofeoyfs.mongodb.net/?appName=Cluster0').then(async () => {
    const Conversations = require('../models/Conversations');
    const Messages = require('../models/Messages');
    const all = await Conversations.find({});
    
    console.log('Total conversations before cleanup:', all.length);
    
    // Group by sorted member pair
    const seen = {};
    const toDelete = [];
    
    for (const conv of all) {
        const key = [...conv.members].map(m => m.toString()).sort().join('_');
        if (seen[key]) {
            // This is a duplicate — keep the one with more messages
            const existingMsgCount = await Messages.countDocuments({ conversationId: seen[key]._id });
            const thisMsgCount = await Messages.countDocuments({ conversationId: conv._id });
            
            if (thisMsgCount > existingMsgCount) {
                console.log('Removing duplicate (fewer msgs):', seen[key]._id, '(' + existingMsgCount + ' msgs)');
                toDelete.push(seen[key]._id);
                seen[key] = conv;
            } else {
                console.log('Removing duplicate (fewer msgs):', conv._id, '(' + thisMsgCount + ' msgs)');
                toDelete.push(conv._id);
            }
        } else {
            seen[key] = conv;
        }
    }
    
    if (toDelete.length === 0) {
        console.log('No duplicates found.');
    } else {
        console.log('Deleting', toDelete.length, 'duplicate conversations...');
        await Conversations.deleteMany({ _id: { $in: toDelete } });
        const remaining = await Conversations.countDocuments({});
        console.log('✅ Done. Remaining conversations:', remaining);
    }
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
