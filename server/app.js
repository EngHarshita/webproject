require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('./db/connection');

// Import models
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');

// Import Middleware
const authenticateToken = require('./middleware/auth');

// Import Routes
const conversationRoute = require('./routes/conversation');

const app = express();
const port = process.env.PORT || 5000;

// Cloudinary Configuration
let storage;
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name') {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'chat_app_uploads',
            resource_type: 'auto',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'zip']
        },
    });
} else {
    // Fallback to local storage if Cloudinary is not configured
    const fs = require('fs');
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir);
    }
    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/')
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, uniqueSuffix + '-' + file.originalname)
        }
    });
}

const upload = multer({ storage: storage });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const corsOptions = {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Use Routes
app.use('/api/conversation', conversationRoute);

// Server and Socket.io setup
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// APIs

// 1. Messages APIs
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }
        
        let fileUrl;
        // Check if it was uploaded to Cloudinary (will have an http url in path) or locally
        if (req.file.path.startsWith('http')) {
            fileUrl = req.file.path;
        } else {
            // Local file URL
            fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        res.status(200).json({ 
            fileUrl: fileUrl, 
            fileName: req.file.originalname,
            publicId: req.file.filename || req.file.originalname
        });
    } catch (error) {
        console.error('Error in POST /api/upload:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '', type = 'text', fileUrl = '', fileName = '', location = null } = req.body;
        
        const finalConversationId = conversationId || req.body.conversationID;
        const finalSenderId = senderId || req.body.senderID;
        const finalReceiverId = receiverId || req.body.receiverID || '';

        if (!finalSenderId || (type === 'text' && !message) && type !== 'image' && type !== 'document' && type !== 'location') {
            return res.status(400).send('Please fill all required fields');
        }

        let cId = finalConversationId;
        if ((!finalConversationId || finalConversationId === 'new') && finalReceiverId) {
            const newConversation = new Conversations({ members: [finalSenderId, finalReceiverId] });
            const savedConvo = await newConversation.save();
            cId = savedConvo._id;
        } else if (!finalConversationId || finalConversationId === 'new') {
            return res.status(400).send('Please provide conversationId or receiverId');
        }

        const newMessage = new Messages({ conversationId: cId, senderId: finalSenderId, message, type, fileUrl, fileName, location });
        await newMessage.save();
        res.status(200).json({ message: 'Message sent successfully', conversationId: cId });
    } catch (error) {
        console.error('Error in POST /api/message:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/message/delete-for-me', async (req, res) => {
    try {
        const { messageId, userId } = req.body;
        if (!messageId || !userId) return res.status(400).send('Message ID and User ID are required');

        await Messages.findByIdAndUpdate(messageId, {
            $addToSet: { deletedBy: userId }
        });

        res.status(200).send('Message deleted for you');
    } catch (error) {
        console.error('Error in DELETE FOR ME:', error);
        res.status(500).send('Server Error');
    }
});

app.get('/api/message/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { senderId } = req.query; // Who is asking?
        if (conversationId === 'new') return res.status(200).json([]);
        
        const query = { conversationId };
        if (senderId) {
            query.deletedBy = { $ne: senderId };
        }

        const messages = await Messages.find(query);
        const messageUserData = await Promise.all(messages.map(async (msg) => {
            const user = await Users.findById(msg.senderId);
            return { 
                user: { id: user?._id, email: user?.email, fullName: user?.fullName }, 
                message: msg.message,
                type: msg.type,
                fileUrl: msg.fileUrl,
                fileName: msg.fileName,
                location: msg.location,
                _id: msg._id
            };
        }));
        res.status(200).json(messageUserData);
    } catch (error) {
        console.error('Error in GET /api/message/:conversationId:', error);
        res.status(500).send('Server Error');
    }
});

// 2. Users API
app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const users = await Users.find({ _id: { $ne: userId } });
        const usersData = users.map((user) => ({
            user: { email: user.email, fullName: user.fullName, receiverId: user._id }
        }));
        res.status(200).json(usersData);
    } catch (error) {
        console.error('Error in GET /api/users/:userId:', error);
        res.status(500).send('Server Error');
    }
});

// 3. Conversations API (Missing endpoint for frontend)
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const conversations = await Conversations.find({ members: { $in: [userId] } });
        const conversationData = await Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member.toString() !== userId);
            const user = await Users.findById(receiverId);
            return {
                user: {
                    receiverId: user?._id,
                    email: user?.email,
                    fullName: user?.fullName
                },
                conversationId: conversation._id
            };
        }));
        res.status(200).json(conversationData);
    } catch (error) {
        console.error('Error in GET /api/conversations/:userId:', error);
        res.status(500).send('Server Error');
    }
});

// TEMPORARY DEV ROUTE - Only active in development mode
app.post('/api/dev/reset-passwords', async (req, res) => {
    // Security check: Only allow in development
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== undefined) {
        return res.status(403).json({ error: 'Blocked: This route is only available in development mode.' });
    }

    try {
        const newPassword = 'NewPassword123';
        const hashedPassword = await bcryptjs.hash(newPassword, 10);
        
        // Use updateMany for the API route as it's faster for a quick dev reset
        const result = await Users.updateMany({}, { $set: { password: hashedPassword, token: null } });
        
        res.status(200).json({ 
            message: 'All passwords reset successfully', 
            newPassword: newPassword,
            usersUpdated: result.modifiedCount,
            environment: process.env.NODE_ENV || 'development (default)'
        });
    } catch (error) {
        console.error('Dev Reset Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).send('Please fill all required fields');
        }

        const isAlreadyExist = await Users.findOne({ email });
        if (isAlreadyExist) {
            return res.status(400).send('User already exists');
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        const newUser = new Users({ fullName, email, password: hashedPassword });
        await newUser.save();
        res.status(200).send('User registered successfully');
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).send('Please fill all required fields');
        }

        const user = await Users.findOne({ email });
        if (!user) {
            return res.status(400).send('Email or password incorrect');
        }

        const isValid = await bcryptjs.compare(password, user.password);
        if (!isValid) {
            return res.status(400).send('Email or password incorrect');
        }

        const payload = { userId: user._id, email: user.email };
        const JWT_SECRET = process.env.JWT_SECRET || 'this_is_a_secret_key';

        jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }, async (err, token) => {
            if (err) return res.status(500).send('Error signing token');
            
            await Users.updateOne({ _id: user._id }, { $set: { token } });
            user.token = token;
            // Send back sanitized user object
            const userResponse = {
                id: user._id,
                _id: user._id,
                email: user.email,
                fullName: user.fullName,
                token: token
            };
            res.status(200).json({ user: userResponse, token });
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).send('Server Error');
    }
});

// Socket.io logic
let users = [];

io.on('connection', socket => {
    console.log('⚡ User connected:', socket.id);

    socket.on('addUser', userId => {
        if (userId) {
            // Remove old socket if user reconnected
            users = users.filter(user => user.userId !== userId);
            const user = { userId, socketId: socket.id };
            users.push(user);
            console.log(`👤 User ${userId} registered with socket ${socket.id}`);
            io.emit('getUsers', users);
        }
    });

    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId, type = 'text', fileUrl = '', fileName = '', location = null }) => {
        const receiver = users.find(user => user.userId === receiverId);
        const sender = users.find(user => user.userId === senderId);

        let userData = null;
        try {
            const user = await Users.findById(senderId);
            if (user) {
                userData = { id: user._id, fullName: user.fullName, email: user.email };
            }
        } catch (err) {
            console.error('Error fetching sender data for socket:', err);
        }

        const messageData = {
            senderId,
            message,
            conversationId,
            receiverId,
            type,
            fileUrl,
            fileName,
            location,
            user: userData,
            createdAt: new Date()
        };

        if (receiver) {
            io.to(receiver.socketId).emit('getMessage', messageData);
        }
        if (sender) {
            io.to(sender.socketId).emit('getMessage', messageData);
        }
    });

    // Typing Indicators
    socket.on('typing', ({ receiverId, senderId }) => {
        const receiver = users.find(user => user.userId === receiverId);
        if (receiver) {
            io.to(receiver.socketId).emit('displayTyping', { senderId });
        }
    });

    socket.on('stopTyping', ({ receiverId, senderId }) => {
        const receiver = users.find(user => user.userId === receiverId);
        if (receiver) {
            io.to(receiver.socketId).emit('hideTyping', { senderId });
        }
    });

    // WebRTC Signaling
    socket.on('callUser', ({ userToCall, signalData, from, name }) => {
        const receiver = users.find(user => user.userId === userToCall);
        if (receiver) {
            io.to(receiver.socketId).emit('callUser', { signal: signalData, from, name });
        }
    });

    socket.on('answerCall', (data) => {
        const receiver = users.find(user => user.userId === data.to);
        if (receiver) {
            io.to(receiver.socketId).emit('callAccepted', data.signal);
        }
    });

    socket.on('endCall', ({ to }) => {
        const receiver = users.find(user => user.userId === to);
        if (receiver) {
            io.to(receiver.socketId).emit('endCall');
        }
    });

    socket.on('disconnect', () => {
        console.log('🔥 User disconnected:', socket.id);
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
