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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

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
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user:detail')));
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState({});
    const [message, setMessage] = useState('');
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [socket, setSocket] = useState(null);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const fileInputRef = useRef(null);
    const messageRef = useRef(null);

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

    useEffect(() => {
        const newSocket = io(BACKEND_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
        setSocket(newSocket);
    }, []);

    useEffect(() => {
        let id = user?.id || user?._id;
        socket?.emit('addUser', id);
        socket?.on('getUsers', users => {
            console.log('activeUsers', users);
        });
        socket?.on('getMessage', data => {
            setMessages(prev => {
                if (prev?.conversationId === data.conversationId) {
                    return {
                        ...prev,
                        messages: [...(prev.messages || []), { 
                            user: data.user, 
                            message: data.message,
                            type: data.type,
                            fileUrl: data.fileUrl,
                            fileName: data.fileName
                        }]
                    };
                }
                return prev;
            });
        });

        socket?.on("callUser", ({ from, name: callerName, signal }) => {
            setReceivingCall(true);
            setCaller(from);
            setCallerName(callerName);
            setCallerSignal(signal);
        });

        socket?.on("endCall", () => {
            setCallEnded(true);
            if (connectionRef.current) connectionRef.current.destroy();
            window.location.reload(); // Simple way to reset state for now
        });

        socket?.on('displayTyping', ({ senderId }) => {
            if (messages?.receiver?.receiverId === senderId) {
                setIsTyping(true);
            }
        });

        socket?.on('hideTyping', ({ senderId }) => {
            if (messages?.receiver?.receiverId === senderId) {
                setIsTyping(false);
            }
        });

        return () => {
             socket?.off('getMessage');
             socket?.off('callUser');
             socket?.off('endCall');
             socket?.off('displayTyping');
             socket?.off('hideTyping');
        }
    }, [socket, user]);

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
            let id = user?.id || user?._id;
            if (!id) return;

            // Fetch conversations and users in parallel
            const [convoRes, usersRes] = await Promise.all([
                fetch(`${BACKEND_URL}/api/conversations/${id}`),
                fetch(`${BACKEND_URL}/api/users/${id}`)
            ]);

            const convoData = await convoRes.json();
            const usersData = await usersRes.json();

            setConversations(convoData);
            setUsers(usersData);
        };
        fetchData();
    }, [user]);

    const fetchMessages = async (conversationId, receiver) => {
        if (conversationId === messages?.conversationId && receiver?.receiverId === messages?.receiver?.receiverId) return;
        
        let id = user?.id || user?._id;
        const res = await fetch(`${BACKEND_URL}/api/message/${conversationId}?senderId=${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const resData = await res.json();
        setMessages({ messages: resData, receiver, conversationId });
    };

    const [isSending, setIsSending] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${BACKEND_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            let type = 'document';
            if (file.type.startsWith('image/')) type = 'image';
            
            await sendMessage(null, type, data.fileUrl, data.fileName);
            setShowAttachmentMenu(false);
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    const sendSticker = async (stickerUrl) => {
        await sendMessage(null, 'sticker', stickerUrl);
        setShowStickerPicker(false);
        setShowAttachmentMenu(false);
    };

    const sendLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                await sendMessage(null, 'location', '', '', { latitude, longitude });
                setShowAttachmentMenu(false);
            }, (error) => {
                console.error("Error getting location:", error);
                alert("Could not get your location. Please enable location services.");
            });
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    };

    const deleteMessageForMe = async (messageId) => {
        let id = user?.id || user?._id;
        try {
            await fetch(`${BACKEND_URL}/api/message/delete-for-me`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    const sendMessage = async (e, type = 'text', fileUrl = '', fileName = '', location = null) => {
        if (type === 'text' && !message.trim()) return;
        if (isSending) return;
        setIsSending(true);
        let id = user?.id || user?._id;
        
        const payload = {
            senderId: id,
            receiverId: messages?.receiver?.receiverId,
            message: type === 'text' ? message : '',
            conversationId: messages?.conversationId,
            type,
            fileUrl,
            fileName,
            location
        };
        
        socket?.emit('sendMessage', payload);
        
        const res = await fetch(`${BACKEND_URL}/api/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        const resData = await res.json();
        
        if (!messages?.conversationId) {
            // New conversation created
             setMessages(prev => ({...prev, conversationId: resData.conversationId}));
             // Refresh conversations list to show the new one
             const refreshConversations = async () => {
                const res = await fetch(`${BACKEND_URL}/api/conversations/${id}`);
                const resData = await res.json();
                setConversations(resData);
            };
            refreshConversations();
        }
        if (type === 'text') setMessage('');
        setIsSending(false);
    };

    return (
        <div className='w-screen flex h-screen bg-background dark:bg-gray-900 text-black dark:text-white transition-colors duration-300'>
            
            {/* LEFT SIDEBAR (CONVERSATIONS) */}
            <div className='w-[25%] h-full bg-white dark:bg-gray-800 flex flex-col transition-colors duration-300 border-r dark:border-gray-700 shadow-sm'>
                <div className='flex items-center px-10 py-8'>
                    <div className='border-2 border-primary p-[2px] rounded-full shadow-sm'>
                        <img src={getAvatar(user?.id || user?._id)} width={60} height={60} alt="Profile" className='rounded-full'/>
                    </div>
                    <div className='ml-6'>
                        <h3 className='text-xl font-bold'>{user?.fullName || 'User Name'}</h3>
                        <p className='text-sm font-normal text-gray-500 dark:text-gray-400'>My Account</p>
                    </div>
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
                            conversations.filter(c => c.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())).map(({user, conversationId}, index) => {
                                return (
                                    <div key={index} className='group flex items-center py-4 border-b border-b-gray-100 dark:border-b-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all rounded-lg px-2 cursor-pointer' onClick={() => fetchMessages(conversationId, user)}>
                                        <div className='relative'>
                                            <img src={getAvatar(user?.receiverId)} width={50} height={50} alt="Profile" className='rounded-full border border-gray-200 object-cover w-[50px] h-[50px]'/>
                                            <div className='absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full'></div>
                                        </div>
                                        <div className='ml-4 flex-1'>
                                            <div className='flex justify-between items-center'>
                                                <h3 className='text-md font-semibold group-hover:text-primary transition-colors'>{user?.fullName}</h3>
                                                <span className='text-[10px] text-gray-400'>12:45 PM</span>
                                            </div>
                                            <p className='text-xs font-light text-gray-500 dark:text-gray-400 truncate w-32'>Available</p>
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
            <div className='w-[50%] h-full flex flex-col items-center transition-colors duration-300'>
                {
                    messages?.receiver?.fullName ? (
                        <>
                            <div className='w-[90%] bg-white dark:bg-gray-800 mt-10 rounded-full flex items-center px-10 py-3 shadow-md border dark:border-gray-700 transition-colors duration-300'>
                                <div className='cursor-pointer'><img src={getAvatar(messages?.receiver?.receiverId)} width={45} height={45} alt="Profile" className="rounded-full border border-gray-100 object-cover w-[45px] h-[45px]"/></div>
                                <div className='ml-6 flex-1'>
                                    <h3 className='text-md font-bold'>{messages?.receiver?.fullName}</h3>
                                    <p className='text-xs font-light text-green-500'>online</p>
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
                                    messages?.messages?.length > 0 ?
                                    messages.messages.map(({message, type, fileUrl, fileName, location, _id, user: {id}}, index) => {
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
                                             <div key={index} ref={messageRef} className={`max-w-[60%] relative group/msg ${isMine ? 'bg-primary text-white ml-auto rounded-tl-2xl' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 mr-auto rounded-tr-2xl'} rounded-b-2xl p-4 mb-4 shadow-sm text-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                                 {renderContent()}
                                                 
                                                 <div 
                                                     onClick={() => deleteMessageForMe(_id)}
                                                     className={`absolute top-2 ${isMine ? '-left-10' : '-right-10'} p-1.5 bg-white dark:bg-gray-700 text-gray-400 hover:text-red-500 rounded-full shadow-md opacity-0 group-hover/msg:opacity-100 transition-all cursor-pointer border dark:border-gray-600 scale-75 hover:scale-100`}
                                                     title="Delete for me"
                                                 >
                                                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                 </div>
                                             </div>
                                         )
                                    }) : <div className='text-center text-gray-400 mt-24 italic'>Send a message to start conversation!</div>
                                }
                            </div>

                            <div className='p-6 w-full flex items-center gap-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-lg relative'>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileUpload}
                                />
                                
                                <div className="relative">
                                    <div 
                                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} 
                                        className={`p-2 cursor-pointer rounded-full transition-all ${showAttachmentMenu ? 'bg-primary text-white scale-110' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
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
                        </>
                    ) : (
                        <div className='flex-1 flex flex-col items-center justify-center text-gray-400'>
                            <div className='w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            </div>
                            <p className='text-lg font-medium'>Select a contact to start chatting</p>
                        </div>
                    )
                }
            </div>

            {/* RIGHT SIDEBAR (ALL USERS) */}
            <div className='w-[25%] h-screen bg-white dark:bg-gray-800 flex flex-col transition-colors duration-300 border-l dark:border-gray-700 shadow-sm'>
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
                                            <div className='absolute bottom-0 right-0 w-3 h-3 bg-gray-300 border-2 border-white rounded-full'></div>
                                        </div>
                                        <div className='ml-4'>
                                            <h3 className='text-md font-semibold group-hover:text-primary transition-colors'>{user?.fullName}</h3>
                                            <p className='text-xs font-light text-gray-500 dark:text-gray-400'>Available</p>
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