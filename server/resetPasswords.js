/**
 * DEVELOPMENT ONLY: Password Reset Script
 * Resets all user passwords to 'NewPassword123'
 * 
 * IMPORTANT: Run a database backup before executing this script.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Configuration
const NEW_PASSWORD = 'NewPassword123';
const MONGODB_URI = "mongodb+srv://chat_app_admin:harshita1234@cluster0.ofeoyfs.mongodb.net/?appName=Cluster0";

// Define User Schema (minimal required for reset)
const userSchema = new mongoose.Schema({
    password: { type: String, required: true },
    token: { type: String }
});

const User = mongoose.model('User', userSchema);

async function resetPasswords() {
    try {
        console.log('--- PASSWORD RESET START ---');
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully.');

        console.log('Fetching all users...');
        const users = await User.find({});
        console.log(`Found ${users.length} users.`);

        if (users.length === 0) {
            console.log('No users to update.');
            process.exit(0);
        }

        console.log('Hashing new password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);

        console.log('Updating users...');
        
        /**
         * Why use a loop instead of updateMany?
         * Although updateMany is faster, using a loop with individual saves 
         * ensures that if any Mongoose middleware (pre-save hooks) is added 
         * in the future, it will be correctly triggered. 
         * In this script, we also clear the session token to force re-login.
         */
        let updatedCount = 0;
        for (const user of users) {
            user.password = hashedPassword;
            user.token = null; // Clear JWT token for security
            await user.save();
            updatedCount++;
            process.stdout.write(`Progress: ${updatedCount}/${users.length}\r`);
        }

        console.log(`\nSuccess! ${updatedCount} users reset.`);
        console.log(`New Password for all: ${NEW_PASSWORD}`);
        
    } catch (error) {
        console.error('Reset failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed.');
        console.log('--- PASSWORD RESET END ---');
        process.exit(0);
    }
}

// Confirmation check
console.log('WARNING: This will reset ALL passwords in the database.');
console.log('Ensure you have a backup of your cluster.');
resetPasswords();
