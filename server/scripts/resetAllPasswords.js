const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
require('dotenv').config();

// We need to establish a distinct connection for the script 
// rather than using connection.js because connection.js calls connectDB() automatically with a retry loop
const url = process.env.MONGO_URI || "mongodb+srv://chat_app_admin:harshita1234@cluster0.ofeoyfs.mongodb.net/?appName=Cluster0";

// Import the User model
const User = require('../models/Users');

const resetAllPasswords = async () => {
    console.log('\n=========================================');
    console.log('⚠️ WARNING: This will reset ALL user passwords');
    console.log('=========================================\n');

    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(url);
        console.log('✅ Connected to MongoDB successfully.');

        // Hash the new password "123456"
        const newPasswordRaw = "123456";
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(newPasswordRaw, salt);

        // Fetch current user count for logging
        const userCount = await User.countDocuments({});
        console.log(`Found ${userCount} users in the database.`);

        if (userCount === 0) {
            console.log('No users found to update. Exiting...');
            process.exit(0);
        }

        // Perform the update
        console.log(`Updating passwords to "${newPasswordRaw}" for all users...`);
        const result = await User.updateMany({}, { password: hashedPassword });

        console.log('\n=========================================');
        console.log('✅ SUCCESS');
        console.log(`Modified ${result.modifiedCount} out of ${result.matchedCount} users.`);
        console.log('=========================================\n');

    } catch (error) {
        console.error('❌ Error updating passwords:', error);
    } finally {
        // Always close the database connection
        await mongoose.connection.close();
        console.log('Database connection closed.');
        process.exit(0);
    }
};

resetAllPasswords();
