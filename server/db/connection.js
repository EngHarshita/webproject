require('dotenv').config();
const mongoose = require('mongoose');

const url = process.env.MONGO_URI || "mongodb+srv://chat_app_admin:harshita1234@cluster0.ofeoyfs.mongodb.net/?appName=Cluster0";

const connectDB = async () => {
    try {
        await mongoose.connect(url, {
            // Mongoose 6+ always uses these options by default, 
            // but keeping it here for clarity or custom config if needed
        });
        console.log('✅ Connected to MongoDB Atlas');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

connectDB();

module.exports = mongoose.connection;