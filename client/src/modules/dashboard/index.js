import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import avatarDefault from '../../assets/3d-illustration-human-avatar-profile/avatar.jpg';

const AVATARS = [
    avatarDefault,
    "https://img.freepik.com/free-psd/3d-illustration-person-with-sunglasses_23-2149436188.jpg",
    "https://img.freepik.com/free-psd/3d-render-avatar-character_23-2150611734.jpg",
    "https://img.freepik.com/free-psd/3d-illustration-person-with-pink-hair_23-2149436186.jpg",
    "https://img.freepik.com/free-psd/3d-render-avatar-character_23-2150611740.jpg",
    "https://img.freepik.com/free-psd/3d-illustration-person-with-glasses_23-2149436185.jpg",
    "https://img.freepik.com/free-psd/3d-render-avatar-character_23-2150611746.jpg",
    "https://img.freepik.com/free-psd/3d-illustration-person-with-long-hair_23-2149436192.jpg"
];

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // Add TURN servers here if you have them
        // {
        //     urls: "turn:your-turn-server.com",
        //     username: "your-username",
        //     credential: "your-password"
        // }
    ]
};

const getAvatar = (id) => {
    if (!id) return AVATARS[0];
    // Simple hash function to pick an avatar based on ID
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATARS[hash % AVATARS.length];
};

const Dashboard = () => {
    const [user, setUser] = useState(() => {
        try {
            const detail = localStorage.getItem('user:detail');
            const token = localStorage.getItem('user:token');
            if (detail && token) {
                const parsed = JSON.parse(detail);
                return { ...parsed, token };
            }
            return null;
        } catch (e) {
            console.error("Failed to parse user detail", e);
            return null;
        }
    });
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState({});
    const [message, setMessage] = useState('');
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [socket, setSocket] = useState(null);
    // FIX: Separate online users (from socket) from the full users list (from API)
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(null); // stores messageId
    const [isUploading, setIsUploading] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [quickReplies, setQuickReplies] = useState([]);
    const fileInputRef = useRef(null);
    const messageRef = useRef(null);
    const attachmentMenuRef = useRef(null);
    // FIX: Use a ref for user inside socket callbacks to avoid stale closure
    // without needing to re-register listeners every time user state changes
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    // FIX: isUserOnline now checks onlineUsers (socket-driven) not the API users list
    const isUserOnline = (id) => onlineUsers.some(u => u.userId?.toString() === id?.toString());

    const analyzeQuickReplies = (msg) => {
        if (!msg) return [];
        const text = msg.toLowerCase();
        if (text.includes('hi') || text.includes('hello')) return ['Hello!', 'Hi there!', 'Hey!'];
        if (text.includes('how are')) return ['I am good!', 'Doing great!', 'All good!'];
        if (text.includes('?')) return ['Yes', 'No', 'Let me check'];
        return ['👍 Okay', 'Thanks!', 'Got it'];
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
                setShowAttachmentMenu(false);
                setShowStickerPicker(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Video Call States
    const [stream, setStream] = useState(null);
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState("");
    const [callerName, setCallerName] = useState("");
    const [callerSignal, setCallerSignal] = useState();
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [isCalling, setIsCalling] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUser, setTypingUser] = useState(null);

    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();

    const STICKERS = [
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f618/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f4af/512.gif",
        "https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif",
    ];

    const REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

    useEffect(() => {
        const newSocket = io(BACKEND_URL, {
            transports: ['websocket', 'polling'], // Added polling fallback
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });
        
        newSocket.on('connect_error', (err) => {
            console.warn('Socket connection error:', err.message);
        });
        
        setSocket(newSocket);
        
        return () => {
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!socket) return;
        let id = userRef.current?.id?.toString() || userRef.current?._id?.toString();
        if (id) socket.emit('addUser', id);

        // FIX: getUsers now updates the onlineUsers state for live status dots
        const handleGetUsers = (activeUsers) => {
            setOnlineUsers(activeUsers);
        };

        // FIX: getMessage no longer duplicates — it replaces the temp_ optimistic msg
        // if one exists for this conversation, otherwise appends normally
        const handleGetMessage = (data) => {
            setMessages(prev => {
                if (prev?.conversationId?.toString() !== data.conversationId?.toString()) return prev;

                const currentUser = userRef.current;
                const myId = currentUser?.id?.toString() || currentUser?._id?.toString();

                // If this is my own message echoed back, skip it entirely
                // (we already added it optimistically)
                if (data.user?.id?.toString() === myId) return prev;

                // Prevent genuine duplicates from receiver side
                const isDuplicate = prev.messages?.some(msg =>
                    msg._id === data._id ||
                    (!msg._id?.startsWith?.('temp_') &&
                     msg.message === data.message &&
                     msg.user?.id?.toString() === data.user?.id?.toString() &&
                     Math.abs(new Date(msg.createdAt) - new Date(data.createdAt)) < 2000)
                );
                if (isDuplicate) return prev;

                // Generate AI quick replies for incoming messages
                if (data.type === 'text') {
                    setQuickReplies(analyzeQuickReplies(data.message));
                }

                return {
                    ...prev,
                    messages: [...(prev.messages || []), {
                        user: data.user,
                        message: data.message,
                        type: data.type,
                        fileUrl: data.fileUrl,
                        fileName: data.fileName,
                        createdAt: data.createdAt,
                        _id: data._id,
                        isPinned: false
                    }]
                };
            });
        };

        const handleCallUser = ({ from, name: callerName, signal }) => {
            setReceivingCall(true);
            setCaller(from);
            setCallerName(callerName);
            setCallerSignal(signal);
        };

        const handleMessageReaction = ({ messageId, userId, emoji }) => {
            setMessages(prev => {
                if (!prev.messages) return prev;
                return {
                    ...prev,
                    messages: prev.messages.map(msg => {
                        if (msg._id === messageId) {
                            const reactions = [...(msg.reactions || [])];
                            const existingIndex = reactions.findIndex(r => (r.userId?.toString() === userId?.toString()) || (r.userId?._id?.toString() === userId?.toString()));
                            if (existingIndex !== -1) {
                                if (reactions[existingIndex].emoji === emoji) {
                                    reactions.splice(existingIndex, 1);
                                } else {
                                    reactions[existingIndex].emoji = emoji;
                                }
                            } else {
                                reactions.push({ userId, emoji });
                            }
                            return { ...msg, reactions };
                        }
                        return msg;
                    })
                };
            });
        };

        const handleEndCall = () => {
            setCallEnded(true);
            if (connectionRef.current) connectionRef.current.destroy();
            window.location.reload();
        };

        const handleDisplayTyping = ({ senderId }) => {
            setMessages(prev => {
                if (prev?.receiver?.receiverId?.toString() === senderId?.toString()) {
                    setIsTyping(true);
                }
                return prev;
            });
        };

        const handleHideTyping = ({ senderId }) => {
            setMessages(prev => {
                if (prev?.receiver?.receiverId?.toString() === senderId?.toString()) {
                    setIsTyping(false);
                }
                return prev;
            });
        };

        socket.on('getUsers', handleGetUsers);
        socket.on('getMessage', handleGetMessage);
        socket.on('callUser', handleCallUser);
        socket.on('endCall', handleEndCall);
        socket.on('displayTyping', handleDisplayTyping);
        socket.on('hideTyping', handleHideTyping);
        socket.on('messageReaction', handleMessageReaction);

        return () => {
            socket.off('getUsers', handleGetUsers);
            socket.off('getMessage', handleGetMessage);
            socket.off('callUser', handleCallUser);
            socket.off('endCall', handleEndCall);
            socket.off('displayTyping', handleDisplayTyping);
            socket.off('hideTyping', handleHideTyping);
            socket.off('messageReaction', handleMessageReaction);
        };
    // FIX: Depend only on socket — user changes are handled via userRef to prevent
    // re-registering listeners (which caused duplicate message delivery)
    }, [socket]);
    const callUser = (id) => {
        setIsCalling(true);
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
            setStream(currentStream);
            if (myVideo.current) myVideo.current.srcObject = currentStream;

            const peer = new Peer({ 
                initiator: true, 
                trickle: false, 
                stream: currentStream,
                config: ICE_SERVERS
            });

            peer.on("signal", (data) => {
                socket.emit("callUser", {
                    userToCall: id,
                    signalData: data,
                    from: user?.id || user?._id,
                    name: user?.fullName,
                });
            });

            peer.on("stream", (currentStream) => {
                if (userVideo.current) userVideo.current.srcObject = currentStream;
            });

            socket.on("callAccepted", (signal) => {
                setCallAccepted(true);
                peer.signal(signal);
            });

            connectionRef.current = peer;
        });
    };

    const answerCall = () => {
        setCallAccepted(true);
        setReceivingCall(false);
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
            setStream(currentStream);
            if (myVideo.current) myVideo.current.srcObject = currentStream;

            const peer = new Peer({ 
                initiator: false, 
                trickle: false, 
                stream: currentStream,
                config: ICE_SERVERS
            });

            peer.on("signal", (data) => {
                socket.emit("answerCall", { signal: data, to: caller });
            });

            peer.on("stream", (currentStream) => {
                if (userVideo.current) userVideo.current.srcObject = currentStream;
            });

            peer.signal(callerSignal);
            connectionRef.current = peer;
        });
    };

    const leaveCall = () => {
        setCallEnded(true);
        socket.emit("endCall", { to: messages?.receiver?.receiverId || caller });
        if (connectionRef.current) connectionRef.current.destroy();
        window.location.reload();
    };

    useEffect(() => {
        messageRef?.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages?.messages]);

    useEffect(() => {
        const fetchData = async () => {
            let id = user?.id?.toString() || user?._id?.toString();
            if (!id) return;

            try {
                const [convoRes, usersRes] = await Promise.all([
                    fetch(`${BACKEND_URL}/api/conversations/${id}`, { headers: { 'Authorization': `Bearer ${user?.token}` } }),
                    fetch(`${BACKEND_URL}/api/users/${id}`, { headers: { 'Authorization': `Bearer ${user?.token}` } })
                ]);

                const convoData = convoRes.ok ? await convoRes.json() : [];
                const usersData = usersRes.ok ? await usersRes.json() : [];

                setConversations(convoData);
                setUsers(usersData);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, [user]);

    const fetchMessages = async (conversationId, receiver) => {
        const recvId = receiver?.receiverId?.toString();
        if (conversationId === messages?.conversationId && recvId === messages?.receiver?.receiverId?.toString()) return;
        
        let id = user?.id?.toString() || user?._id?.toString();
        // Optimistically clear current messages to show loading/switch state immediately
        setMessages({ messages: [], receiver, conversationId });
        
        setIsLoadingMessages(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/message/${conversationId}?senderId=${id}`, {
                headers: { 'Authorization': `Bearer ${user?.token}` }
            });
            const resData = res.ok ? await res.json() : [];
            setMessages({ messages: resData, receiver, conversationId });
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    const [isSending, setIsSending] = useState(false);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setShowAttachmentMenu(false);
        setPreviewFile(file);
    };

    const confirmUploadFile = async () => {
        if (!previewFile) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', previewFile);

        try {
            const res = await fetch(`${BACKEND_URL}/api/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user?.token}` },
                body: formData
            });
            const data = await res.json();
            
            let type = 'document';
            if (previewFile.type.startsWith('image/')) type = 'image';
            
            await sendMessage(null, type, data.fileUrl, data.fileName);
            setPreviewFile(null);
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const sendSticker = async (stickerUrl) => {
        await sendMessage(null, 'sticker', stickerUrl);
        setShowStickerPicker(false);
        setShowAttachmentMenu(false);
    };

    const sendLocation = () => {
        if (navigator.geolocation) {
            setShowAttachmentMenu(false);
            setIsLocating(true);
            navigator.geolocation.getCurrentPosition(async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    await sendMessage(null, 'location', '', '', { latitude, longitude });
                } catch (error) {
                    console.error("Failed to send location message:", error);
                } finally {
                    setIsLocating(false);
                }
            }, (error) => {
                console.error("Error getting location:", error);
                alert("Could not get your location. Please enable location services.");
                setIsLocating(false);
            }, { timeout: 10000 });
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    };

    const deleteMessageForMe = async (messageId) => {
        let id = user?.id || user?._id;
        try {
            await fetch(`${BACKEND_URL}/api/message/delete-for-me`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
                body: JSON.stringify({ messageId, userId: id })
            });
            // Update local state
            setMessages(prev => ({
                ...prev,
                messages: prev.messages.filter(msg => msg._id !== messageId)
            }));
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    const togglePinMessage = async (messageId) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/message/pin/${messageId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${user?.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(prev => ({
                    ...prev,
                    messages: prev.messages.map(msg => msg._id === messageId ? { ...msg, isPinned: data.isPinned } : msg)
                }));
            }
        } catch (error) {
            console.error("Pin failed:", error);
        }
    };

    const reactToMessage = async (messageId, emoji) => {
        let myId = user?.id || user?._id;
        let receiverId = messages?.receiver?.receiverId;
        
        // Optimistic update
        handleMessageReaction({ messageId, userId: myId, emoji });
        setShowReactionPicker(null);

        socket?.emit('reactMessage', { messageId, userId: myId, emoji, receiverId });

        try {
            await fetch(`${BACKEND_URL}/api/message/react/${messageId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
                body: JSON.stringify({ userId: myId, emoji })
            });
        } catch (error) {
            console.error("Reaction failed:", error);
        }
    };

    const sendMessage = async (e, type = 'text', fileUrl = '', fileName = '', location = null) => {
        if (type === 'text' && !message.trim()) return;
        if (isSending) return;
        setIsSending(true);
        let id = user?.id?.toString() || user?._id?.toString();
        let receiverId = messages?.receiver?.receiverId?.toString();
        
        const payload = {
            senderId: id,
            receiverId: receiverId,
            message: type === 'text' ? message : '',
            conversationId: messages?.conversationId,
            type,
            fileUrl,
            fileName,
            location
        };

        // Optimistic update — show message immediately in UI
        const optimisticMsg = {
            user: { id, email: user?.email, fullName: user?.fullName },
            message: payload.message,
            type,
            fileUrl,
            fileName,
            location,
            _id: `temp_${Date.now()}`
        };
        setMessages(prev => ({
            ...prev,
            messages: [...(prev.messages || []), optimisticMsg]
        }));
        if (type === 'text') setMessage('');
        
        socket?.emit('sendMessage', payload);
        
        try {
            const res = await fetch(`${BACKEND_URL}/api/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                console.warn('Failed to persist message to DB');
                return;
            }
            const resData = await res.json();
            
            if (!messages?.conversationId && resData?.conversationId) {
                setMessages(prev => ({...prev, conversationId: resData.conversationId}));
                try {
                    const convoRes = await fetch(`${BACKEND_URL}/api/conversations/${id}`, {
                        headers: { 'Authorization': `Bearer ${user?.token}` }
                    });
                    if (convoRes.ok) setConversations(await convoRes.json());
                } catch (error) {
                    console.error("Error refreshing conversations:", error);
                }
            }
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className='w-screen flex h-screen bg-background dark:bg-gray-900 text-black dark:text-white transition-colors duration-300'>
            
            {/* LEFT SIDEBAR (CONVERSATIONS) */}
            <div className={`fixed md:relative z-40 ${showSidebar ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-[80%] sm:w-[50%] md:w-1/3 lg:w-1/4 h-full bg-white dark:bg-gray-800 flex flex-col transition-transform duration-300 border-r dark:border-gray-700 shadow-xl md:shadow-sm`}>
                <div className='flex items-center px-6 md:px-10 py-6 md:py-8 justify-between'>
                    <div className='flex items-center'>
                        <div className='border-2 border-primary p-[2px] rounded-full shadow-sm'>
                            <img src={getAvatar(user?.id || user?._id)} width={50} height={50} alt="Profile" className='rounded-full'/>
                        </div>
                        <div className='ml-4'>
                            <h3 className='text-lg font-bold'>{user?.fullName || 'User Name'}</h3>
                            <p className='text-xs font-normal text-gray-500 dark:text-gray-400'>My Account</p>
                        </div>
                    </div>
                    <button className='md:hidden p-2 text-gray-500' onClick={() => setShowSidebar(false)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div className='px-10 mt-4 flex-1 flex flex-col min-h-0'>
                    <div className='relative mb-6'>
                        <input 
                            type="text" 
                            placeholder="Search name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className='w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-full text-sm focus:ring-2 focus:ring-primary outline-none transition-all'
                        />
                        <div className='absolute left-3 top-2.5 text-gray-400'>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                    </div>

                    <div className='text-primary text-lg font-semibold mb-6 border-b pb-2 dark:border-gray-700'>Messages</div>
                    <div className='flex-1 overflow-y-auto pr-2 custom-scrollbar'>
                        {
                            conversations.filter(c => c.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ?
                            conversations.filter(c => c.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())).map((conversationData, index) => {
                                const { user, conversationId, lastMessage, lastMessageTime } = conversationData;
                                return (
                                    <div key={index} className='group flex items-center py-4 border-b border-b-gray-100 dark:border-b-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all rounded-lg px-2 cursor-pointer' onClick={() => { fetchMessages(conversationId, user); setShowSidebar(false); }}>
                                        <div className='relative'>
                                            <img src={getAvatar(user?.receiverId)} width={50} height={50} alt="Profile" className='rounded-full border border-gray-200 object-cover w-[50px] h-[50px]'/>
                                            {isUserOnline(user?.receiverId) && <div className='absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full'></div>}
                                        </div>
                                        <div className='ml-4 flex-1 min-w-0'>
                                            <div className='flex justify-between items-center'>
                                                <h3 className='text-md font-semibold group-hover:text-primary transition-colors truncate'>{user?.fullName}</h3>
                                                {lastMessageTime && <span className='text-[10px] text-gray-400 whitespace-nowrap ml-2'>{new Date(lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                            </div>
                                            <p className={`text-xs font-light truncate ${isUserOnline(user?.receiverId) ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>{lastMessage || (isUserOnline(user?.receiverId) ? 'Online' : 'Offline')}</p>
                                        </div>
                                    </div>
                                )
                            }) : <div className='text-center text-gray-400 mt-10 italic'>No Conversations</div>
                        }
                    </div>
                </div>
                
                <div className='p-6 mt-auto'>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }} className='w-full py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium'>Logout</button>
                </div>
            </div>

            {/* CHAT SECTION */}
            <div className='w-full md:w-2/3 lg:w-1/2 h-full flex flex-col items-center transition-colors duration-300 relative'>
                {
                    messages?.receiver?.fullName ? (
                        <>
                            <div className='w-[95%] md:w-[90%] bg-white dark:bg-gray-800 mt-4 md:mt-10 rounded-full flex items-center px-6 md:px-10 py-3 shadow-md border dark:border-gray-700 transition-colors duration-300 z-20'>
                                <button className='mr-4 md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full' onClick={() => setShowSidebar(true)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                </button>
                                <div className='cursor-pointer'><img src={getAvatar(messages?.receiver?.receiverId)} width={45} height={45} alt="Profile" className="rounded-full border border-gray-100 object-cover w-[40px] h-[40px] md:w-[45px] md:h-[45px]"/></div>
                                <div className='ml-6 flex-1'>
                                    <h3 className='text-md font-bold'>{messages?.receiver?.fullName}</h3>
                                    <p className='text-xs font-light text-green-500'>
                                        {isTyping ? <span className="animate-pulse italic">typing...</span> : 'online'}
                                    </p>
                                </div>
                                <div className='flex items-center gap-6'>
                                    <div className='cursor-pointer text-gray-400 hover:text-primary transition-colors' onClick={() => callUser(messages?.receiver?.receiverId)}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                    </div>
                                    <div className='cursor-pointer text-gray-400 hover:text-primary transition-colors'>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    </div>
                                </div>
                            </div>

                            <div className='flex-1 w-full overflow-y-auto px-10 py-6 custom-scrollbar'>
                                {
                                    isLoadingMessages ? (
                                        <div className='flex items-center justify-center h-full'>
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        </div>
                                    ) : messages?.messages?.length > 0 ?
                                    messages.messages.map(({message, type, fileUrl, fileName, location, _id, isPinned, reactions, user: {id}}, index) => {
                                        let loggedInUserId = user?.id || user?._id;
                                        const isMine = loggedInUserId === id;
                                        
                                        const renderContent = () => {
                                            if (type === 'image') {
                                                return <img src={fileUrl} alt="Sent" className='max-w-full rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-opacity' onClick={() => window.open(fileUrl, '_blank')}/>;
                                            } else if (type === 'sticker') {
                                                return <img src={fileUrl} alt="Sticker" className='w-32 h-32 object-contain'/>;
                                            } else if (type === 'location') {
                                                const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
                                                return (
                                                    <div className='flex flex-col gap-2 p-1 cursor-pointer group' onClick={() => window.open(mapUrl, '_blank')}>
                                                        <div className='relative overflow-hidden rounded-lg'>
                                                            <img src={`https://maps.googleapis.com/maps/api/staticmap?center=${location.latitude},${location.longitude}&zoom=15&size=400x200&markers=color:red%7C${location.latitude},${location.longitude}&key=YOUR_API_KEY`} 
                                                                 alt="Location" 
                                                                 className='w-full h-32 object-cover transition-transform group-hover:scale-105'
                                                                 onError={(e) => {
                                                                     e.target.onerror = null;
                                                                     e.target.src = 'https://www.google.com/maps/vt/pb=!1m4!1m3!1i15!2i16384!3i16384!2m3!1e0!2sm!3i388085103!3m8!2sen!3sus!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m1!1f2';
                                                                 }}
                                                            />
                                                            <div className='absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'>
                                                                <span className='bg-white/90 text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg'>VIEW ON MAP</span>
                                                            </div>
                                                        </div>
                                                        <div className='flex items-center gap-2 px-1'>
                                                            <div className='p-1.5 bg-red-100 text-red-600 rounded-lg'>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                            </div>
                                                            <span className='text-xs font-semibold'>Current Location</span>
                                                        </div>
                                                    </div>
                                                );
                                            } else if (type === 'document') {
                                                return (
                                                    <div className='flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded-lg cursor-pointer hover:bg-black/10 transition-colors' onClick={() => window.open(fileUrl, '_blank')}>
                                                        <div className='p-2 bg-primary/20 rounded-lg'>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                        </div>
                                                        <div className='flex-1 min-w-0'>
                                                            <p className='text-xs font-medium truncate'>{fileName || 'Document'}</p>
                                                            <p className='text-[10px] opacity-60 uppercase'>Download</p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return <p>{message}</p>;
                                        };

                                        return (
                                             <div key={index} ref={messageRef} className={`max-w-[60%] relative group/msg ${isMine ? 'bg-primary text-white ml-auto rounded-tl-2xl' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 mr-auto rounded-tr-2xl'} ${isPinned ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-black dark:text-white' : ''} rounded-b-2xl p-4 mb-4 shadow-sm text-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                                 {isPinned && <div className="absolute -top-3 right-4 bg-yellow-400 rounded-full p-1 shadow-md z-10"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></div>}
                                                 {renderContent()}
                                                 
                                                 <div className={`absolute top-2 ${isMine ? '-left-20' : '-right-20'} flex gap-1 opacity-0 group-hover/msg:opacity-100 transition-all scale-75 hover:scale-100`}>
                                                    <div 
                                                        onClick={() => togglePinMessage(_id)}
                                                        className={`p-1.5 ${isPinned ? 'bg-yellow-100 text-yellow-600' : 'bg-white dark:bg-gray-700 text-gray-400 hover:text-yellow-500'} rounded-full shadow-md cursor-pointer border dark:border-gray-600`}
                                                        title={isPinned ? "Unpin message" : "Pin message"}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                                    </div>
                                                    <div 
                                                        onClick={() => deleteMessageForMe(_id)}
                                                        className={`p-1.5 bg-white dark:bg-gray-700 text-gray-400 hover:text-red-500 rounded-full shadow-md cursor-pointer border dark:border-gray-600`}
                                                        title="Delete for me"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    </div>
                                                    <div 
                                                        onClick={() => setShowReactionPicker(showReactionPicker === _id ? null : _id)}
                                                        className={`p-1.5 bg-white dark:bg-gray-700 text-gray-400 hover:text-primary rounded-full shadow-md cursor-pointer border dark:border-gray-600`}
                                                        title="React"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"></path><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                                                    </div>
                                                 </div>

                                                 {showReactionPicker === _id && (
                                                     <div className={`absolute ${isMine ? 'right-full mr-2' : 'left-full ml-2'} -top-8 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-full shadow-xl p-1 flex gap-1 z-50 animate-in zoom-in-50 duration-200`}>
                                                         {REACTION_EMOJIS.map(emoji => (
                                                             <div 
                                                                 key={emoji} 
                                                                 onClick={() => reactToMessage(_id, emoji)}
                                                                 className="hover:scale-125 transition-transform cursor-pointer p-1.5 text-lg"
                                                             >
                                                                 {emoji}
                                                             </div>
                                                         ))}
                                                     </div>
                                                 )}

                                                 {reactions && reactions.length > 0 && (
                                                     <div className={`absolute -bottom-3 ${isMine ? 'left-2' : 'right-2'} flex -space-x-1`}>
                                                         {Array.from(new Set(reactions.map(r => r.emoji))).map(emoji => (
                                                             <div key={emoji} className="bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-full px-1.5 py-0.5 shadow-sm text-[10px]">
                                                                 {emoji} <span className="text-[8px] opacity-60">{reactions.filter(r => r.emoji === emoji).length}</span>
                                                             </div>
                                                         ))}
                                                     </div>
                                                 )}
                                             </div>
                                         )
                                    }) : <div className='text-center text-gray-400 mt-24 italic'>Send a message to start conversation!</div>
                                }
                            </div>

                            <div className='flex flex-col w-full bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-lg relative'>
                                {previewFile && (
                                    <div className="absolute bottom-full left-0 w-full p-4 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700 flex items-center justify-between z-10">
                                        <div className="flex items-center gap-4">
                                            {previewFile.type.startsWith('image/') ? (
                                                <img src={URL.createObjectURL(previewFile)} alt="preview" className="w-16 h-16 object-cover rounded-lg shadow-sm" />
                                            ) : (
                                                <div className="w-16 h-16 bg-primary/20 flex items-center justify-center rounded-lg text-primary">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold truncate w-48">{previewFile.name}</span>
                                                <span className="text-xs text-gray-500">{(previewFile.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setPreviewFile(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded-full transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                            <button onClick={confirmUploadFile} disabled={isUploading} className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50">
                                                {isUploading ? 'Sending...' : 'Send'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {quickReplies.length > 0 && !previewFile && (
                                    <div className="flex gap-2 px-6 py-2 overflow-x-auto custom-scrollbar border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 self-center mr-2">Suggestions:</span>
                                        {quickReplies.map((reply, i) => (
                                            <div 
                                                key={i} 
                                                onClick={() => { setMessage(reply); setQuickReplies([]); }}
                                                className="px-3 py-1 bg-white dark:bg-gray-700 border border-primary/20 dark:border-primary/50 text-primary rounded-full text-xs cursor-pointer hover:bg-primary hover:text-white transition-colors whitespace-nowrap"
                                            >
                                                {reply}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className='p-6 w-full flex items-center gap-4 relative'>
                                    <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileUpload}
                                />
                                
                                <div className="relative" ref={attachmentMenuRef}>
                                    <div 
                                        onClick={() => { if (!isUploading && !isLocating) setShowAttachmentMenu(!showAttachmentMenu) }} 
                                        className={`p-2 cursor-pointer rounded-full transition-all ${showAttachmentMenu ? 'bg-primary text-white scale-110' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'} ${isUploading || isLocating ? 'animate-pulse opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isUploading || isLocating ? (
                                            <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                        )}
                                    </div>

                                    {showAttachmentMenu && (
                                        <div className="absolute bottom-16 left-0 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-2xl p-3 flex flex-col gap-2 min-w-[180px] animate-in slide-in-from-bottom-4 duration-200 z-50">
                                            <div 
                                                onClick={() => { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); }}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-colors group"
                                            >
                                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
                                                </div>
                                                <span className="text-sm font-medium">Image</span>
                                            </div>
                                            <div 
                                                onClick={() => { setShowStickerPicker(!showStickerPicker); }}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-colors group"
                                            >
                                                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-lg group-hover:scale-110 transition-transform">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path><path d="m9 12 2 2 4-4"></path></svg>
                                                </div>
                                                <span className="text-sm font-medium">Stickers</span>
                                            </div>
                                            <div 
                                                onClick={() => { fileInputRef.current.accept = "*/*"; fileInputRef.current.click(); }}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-colors group"
                                            >
                                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                </div>
                                                <span className="text-sm font-medium">Document</span>
                                            </div>
                                            <div 
                                                onClick={sendLocation}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-colors group"
                                            >
                                                <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg group-hover:scale-110 transition-transform">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                </div>
                                                <span className="text-sm font-medium">Location</span>
                                            </div>
                                        </div>
                                    )}

                                    {showStickerPicker && (
                                        <div className="absolute bottom-16 left-48 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-2xl p-4 w-[280px] animate-in zoom-in-95 duration-200 z-50">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-bold">Choose Sticker</h4>
                                                <div onClick={() => setShowStickerPicker(false)} className="cursor-pointer hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-3 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                                {STICKERS.map((url, i) => (
                                                    <div key={i} onClick={() => sendSticker(url)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-transform hover:scale-110 active:scale-90">
                                                        <img src={url} alt="sticker" className="w-full h-full object-contain" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <input 
                                    placeholder='Type a message...' 
                                    value={message}
                                    onChange={(e) => {
                                        setMessage(e.target.value);
                                        if (socket && messages?.receiver?.receiverId) {
                                            socket.emit('typing', { 
                                                receiverId: messages.receiver.receiverId, 
                                                senderId: user?.id || user?._id 
                                            });
                                            
                                            // Stop typing after 3 seconds of inactivity
                                            if (window.typingTimeout) clearTimeout(window.typingTimeout);
                                            window.typingTimeout = setTimeout(() => {
                                                socket.emit('stopTyping', { 
                                                    receiverId: messages.receiver.receiverId, 
                                                    senderId: user?.id || user?._id 
                                                });
                                            }, 3000);
                                        }
                                    }}
                                    onKeyDown={(e) => {if(e.key === 'Enter') sendMessage()}}
                                    className='flex-1 p-3 px-6 bg-gray-100 dark:bg-gray-700 rounded-full outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm'
                                />
                                <div onClick={sendMessage} className='p-3 cursor-pointer bg-primary text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-md'>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                </div>
                            </div>
                            </div>
                        </>
                    ) : (
                        <div className='flex-1 flex flex-col items-center justify-center text-gray-400'>
                            <button className='mb-6 md:hidden px-6 py-2 bg-primary text-white rounded-full flex items-center gap-2 shadow-md' onClick={() => setShowSidebar(true)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                View Contacts
                            </button>
                            <div className='w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            </div>
                            <p className='text-lg font-medium'>Select a contact to start chatting</p>
                        </div>
                    )
                }
            </div>

            {/* RIGHT SIDEBAR (ALL USERS) */}
            <div className='hidden lg:flex w-1/4 h-screen bg-white dark:bg-gray-800 flex-col transition-colors duration-300 border-l dark:border-gray-700 shadow-sm'>
                <div className='px-10 mt-10 flex-1 flex flex-col min-h-0'>
                    <div className='text-primary text-lg font-semibold mb-6 border-b pb-2 dark:border-gray-700'>People</div>
                    <div className='flex-1 overflow-y-auto pr-2 custom-scrollbar'>
                        {
                            users.length > 0 ?
                            users.map(({user}, index) => {
                                return (
                                    <div key={index} className='group flex items-center py-4 border-b border-b-gray-100 dark:border-b-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all rounded-lg px-2 cursor-pointer' onClick={() => fetchMessages('new', user)}>
                                        <div className='relative'>
                                            <img src={getAvatar(user?.receiverId)} width={50} height={50} alt="Profile" className='rounded-full border border-gray-200 object-cover w-[50px] h-[50px]'/>
                                            <div className={`absolute bottom-0 right-0 w-3 h-3 ${isUserOnline(user?.receiverId) ? 'bg-green-500' : 'bg-gray-300'} border-2 border-white rounded-full`}></div>
                                        </div>
                                        <div className='ml-4'>
                                            <h3 className='text-md font-semibold group-hover:text-primary transition-colors'>{user?.fullName}</h3>
                                            <p className={`text-xs font-light ${isUserOnline(user?.receiverId) ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>{isUserOnline(user?.receiverId) ? 'Online' : 'Offline'}</p>
                                        </div>
                                    </div>
                                )
                            }) : <div className='text-center text-gray-400 mt-10 italic'>No Users Found</div>
                        }
                    </div>
                </div>
            </div>

            {/* VIDEO CALL MODAL */}
            {(isCalling || receivingCall || callAccepted) && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4">
                    <div className="relative w-full max-w-4xl bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col h-[80vh]">
                        {/* Header */}
                        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full border-2 border-primary overflow-hidden">
                                    <img src={getAvatar(messages?.receiver?.receiverId || caller)} alt="caller" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">{callAccepted ? (messages?.receiver?.fullName || callerName) : (receivingCall ? callerName : 'Calling...')}</h3>
                                    <p className="text-white/60 text-xs flex items-center gap-2">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                        {callAccepted ? 'Secure connection active' : 'Connecting...'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Video Area */}
                        <div className="flex-1 relative flex items-center justify-center bg-gray-950">
                            {/* User Video (Remote) */}
                            {callAccepted && !callEnded ? (
                                <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center gap-6">
                                    <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center animate-bounce">
                                        <img src={getAvatar(messages?.receiver?.receiverId || caller)} alt="avatar" className="w-24 h-24 rounded-full opacity-50" />
                                    </div>
                                    <p className="text-white/40 text-sm italic">Waiting for response...</p>
                                </div>
                            )}

                            {/* My Video (Local) - PiP Style */}
                            <div className="absolute bottom-6 right-6 w-48 h-32 bg-black rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl z-20">
                                {stream && <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover" />}
                                {!stream && (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="p-8 bg-gray-900 flex justify-center items-center gap-8">
                            {receivingCall && !callAccepted ? (
                                <>
                                    <button 
                                        onClick={answerCall}
                                        className="group flex flex-col items-center gap-2"
                                    >
                                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30 hover:bg-green-600 transition-all hover:scale-110 active:scale-95">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                        </div>
                                        <span className="text-xs text-white/60 font-medium uppercase tracking-wider">Answer</span>
                                    </button>
                                    <button 
                                        onClick={leaveCall}
                                        className="group flex flex-col items-center gap-2"
                                    >
                                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-110 active:scale-95">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </div>
                                        <span className="text-xs text-white/60 font-medium uppercase tracking-wider">Decline</span>
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={leaveCall}
                                    className="group flex flex-col items-center gap-2"
                                >
                                    <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-110 active:scale-95">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    </div>
                                    <span className="text-xs text-white/60 font-medium uppercase tracking-wider">End Call</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Dashboard;