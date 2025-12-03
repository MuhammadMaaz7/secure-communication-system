import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MessageService } from '../services/messageService';
import { FileService } from '../services/fileService';
import socketService from '../services/socketService';
import api from '../services/api';
import Toast from './Toast';

const Chat = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [sendingMessage, setSendingMessage] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    loadUsers();
    
    const token = localStorage.getItem('authToken');
    socketService.connect(token);

    const checkPendingExchanges = async () => {
      try {
        const response = await api.get('/key-exchange/pending');
        if (response.data.pendingExchanges && response.data.pendingExchanges.length > 0) {
          for (const exchange of response.data.pendingExchanges) {
            await handleKeyExchangeRequest({
              sessionId: exchange.sessionId,
              initiatorId: exchange.initiatorId._id,
              initiatorPublicKey: exchange.initiatorPublicKey,
              initiatorSignature: exchange.initiatorSignature,
            });
          }
        }
      } catch (error) {
        // Silently fail
      }
    };

    checkPendingExchanges();
    const interval = setInterval(checkPendingExchanges, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadMessages(selectedUser._id);
    }
  }, [selectedUser]);

  useEffect(() => {
    const handleMessage = async (data) => {
      console.log('Message notification:', data);
      
      if (data.messageId) {
        try {
          await MessageService.markAsDelivered(data.messageId);
        } catch (error) {
          console.error('Failed to mark message as delivered:', error);
        }
      }
      
      setSelectedUser(currentUser => {
        if (currentUser && data.senderId === currentUser._id) {
          loadMessages(currentUser._id);
        }
        return currentUser;
      });
    };

    const handleUserStatus = (data) => {
      console.log('User status update received:', data);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (data.status === 'online') {
          console.log(`Adding user ${data.userId} to online users`);
          newSet.add(data.userId);
        } else {
          console.log(`Removing user ${data.userId} from online users`);
          newSet.delete(data.userId);
        }
        console.log('Updated online users:', Array.from(newSet));
        return newSet;
      });
    };

    const handleFileNotification = (data) => {
      console.log('File notification:', data);
      setSelectedUser(currentUser => {
        if (currentUser && data.senderId === currentUser._id) {
          loadMessages(currentUser._id);
        }
        return currentUser;
      });
    };

    const handleMessageStatusUpdate = (data) => {
      console.log('Message status update:', data);
      setMessages(prev => prev.map(msg => 
        msg._id === data.messageId 
          ? { ...msg, [data.status]: true, ...(data.status === 'read' ? { delivered: true } : {}) }
          : msg
      ));
    };

    socketService.on('message-received', handleMessage);
    socketService.on('user-status', handleUserStatus);
    socketService.on('file-notification', handleFileNotification);
    socketService.on('message-status-update', handleMessageStatusUpdate);

    return () => {
      socketService.off('message-received', handleMessage);
      socketService.off('user-status', handleUserStatus);
      socketService.off('file-notification', handleFileNotification);
      socketService.off('message-status-update', handleMessageStatusUpdate);
    };
  }, []);

  useEffect(() => {
    socketService.on('key-exchange-notification', handleKeyExchangeRequest);
    return () => {
      socketService.off('key-exchange-notification', handleKeyExchangeRequest);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users/list');
      setUsers(response.data.users);
      
      const online = new Set();
      response.data.users.forEach(u => {
        if (u.online) {
          online.add(u._id);
        }
      });
      setOnlineUsers(online);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMessages = async (userId) => {
    try {
      setLoading(true);
      const msgs = await MessageService.getMessages(userId);
      const filesList = await FileService.getFiles(userId);
      
      for (const msg of msgs) {
        if (msg.receiverId === user.userId && !msg.read) {
          await MessageService.markAsRead(msg._id);
        }
      }
      
      const combined = [
        ...msgs.map(m => ({ ...m, type: 'message' })),
        ...filesList.map(f => ({ ...f, type: 'file' }))
      ];
      
      combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      setMessages(combined.filter(item => item.type === 'message'));
      setFiles(combined.filter(item => item.type === 'file'));
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyExchangeRequest = async (data) => {
    console.log('Received key exchange request:', data);
    try {
      const { KeyExchangeProtocol } = await import('../services/keyExchange');
      await KeyExchangeProtocol.respondToKeyExchange(
        data.sessionId,
        data.initiatorId,
        data.initiatorPublicKey,
        data.initiatorSignature
      );
      console.log('Key exchange response sent successfully');
    } catch (error) {
      console.error('Failed to respond to key exchange:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || sendingMessage) return;

    const messageToSend = newMessage;
    setNewMessage('');
    setSendingMessage(true);

    try {
      await MessageService.sendMessage(selectedUser._id, messageToSend);
      loadMessages(selectedUser._id);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageToSend);
      
      const errorMsg = error.message || 'Failed to send message';
      showToast(errorMsg, 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile || !selectedUser) return;

    try {
      setLoading(true);
      const result = await FileService.uploadFile(selectedUser._id, selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      socketService.emit('file-uploaded', {
        receiverId: selectedUser._id,
        fileId: result.fileId,
        fileName: selectedFile.name,
      });
      
      showToast(`File "${selectedFile.name}" uploaded successfully`, 'success');
      loadMessages(selectedUser._id);
    } catch (error) {
      console.error('Failed to upload file:', error);
      showToast('Failed to upload file: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-white border-r border-gray-200 flex flex-col shadow-lg transition-all duration-300`}>
        {/* Header */}
        <div className={`${sidebarOpen ? 'p-6' : 'p-4'} bg-gradient-to-br from-primary-600 to-primary-700 text-white transition-all duration-300`}>
          {sidebarOpen ? (
            <div className="space-y-4">
              {/* Brand */}
              <div>
                <h2 className="text-2xl font-bold mb-1">SecureChat</h2>
                <p className="text-primary-100 text-xs">End-to-end encrypted</p>
              </div>
              
              {/* User Profile */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/20">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-xl font-bold ring-2 ring-white/30">
                  {user?.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white truncate">{user?.username}</p>
                  <p className="text-xs text-primary-100">Your account</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-xl font-bold ring-2 ring-white/30">
                {user?.username[0].toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          <div className={`${sidebarOpen ? 'p-4' : 'p-2'} transition-all duration-300`}>
            {sidebarOpen && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Contacts
              </h3>
            )}
            <div className={`${sidebarOpen ? 'space-y-1' : 'space-y-2'}`}>
              {users.map((u) => (
                <button
                  key={u._id}
                  onClick={() => setSelectedUser(u)}
                  title={!sidebarOpen ? u.username : ''}
                  className={`w-full ${sidebarOpen ? 'p-3' : 'p-2'} rounded-xl flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'} transition-all duration-200 ${
                    selectedUser?._id === u._id
                      ? 'bg-primary-50 border-2 border-primary-500 shadow-sm'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {u.username[0].toUpperCase()}
                    </div>
                    {onlineUsers.has(u._id) && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  {sidebarOpen && (
                    <div className="flex-1 text-left overflow-hidden">
                      <p className="font-semibold text-gray-900 truncate">{u.username}</p>
                      <p className="text-xs text-gray-500">
                        {onlineUsers.has(u._id) ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Settings & Logout Buttons */}
        <div className={`${sidebarOpen ? 'p-4' : 'p-2'} border-t border-gray-200 transition-all duration-300 space-y-2`}>
          <button
            onClick={() => navigate('/settings')}
            title={!sidebarOpen ? 'Settings' : ''}
            className={`w-full ${sidebarOpen ? 'py-2.5 px-4' : 'py-2.5 px-2'} bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 flex items-center ${sidebarOpen ? 'justify-center gap-2' : 'justify-center'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {sidebarOpen && <span>Settings</span>}
          </button>
          
          <button
            onClick={logout}
            title={!sidebarOpen ? 'Logout' : ''}
            className={`w-full ${sidebarOpen ? 'py-2.5 px-4' : 'py-2.5 px-2'} bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200 shadow-sm flex items-center ${sidebarOpen ? 'justify-center gap-2' : 'justify-center'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                {/* Hamburger Menu */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  aria-label="Toggle sidebar"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                      {selectedUser.username[0].toUpperCase()}
                    </div>
                    {onlineUsers.has(selectedUser._id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{selectedUser.username}</h3>
                    <p className="text-xs text-gray-500">
                      {onlineUsers.has(selectedUser._id) ? '🟢 Online' : '⚫ Offline'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    📎 Attach
                  </button>
                  {selectedFile && (
                    <button
                      onClick={uploadFile}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200 shadow-sm"
                    >
                      Upload {selectedFile.name}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-gray-50 to-white">
              {loading && (
                <div className="text-center py-8">
                  <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-500 mt-2">Loading messages...</p>
                </div>
              )}
              
              {[...messages, ...files]
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .map((item, idx) => (
                  <div
                    key={`${item.type}-${idx}`}
                    className={`flex ${item.senderId === user.userId ? 'justify-end' : 'justify-start'} animate-[slide-up_0.3s_ease-out]`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-3 rounded-2xl shadow-sm ${
                        item.senderId === user.userId
                          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      <div className="break-words">
                        {item.type === 'message' ? (
                          <>
                            <p className="text-sm leading-relaxed">{item.text}</p>
                            {!item.decrypted && (
                              <span className="text-red-300 text-xs"> ⚠️ Decryption failed</span>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">📎</span>
                            <div className="flex-1">
                              <p className="font-medium">{item.fileName}</p>
                              <p className="text-xs opacity-70">{Math.round(item.fileSize / 1024)}KB</p>
                            </div>
                            <button
                              onClick={() => FileService.downloadFile(item._id, item.senderId === user.userId ? item.receiverId : item.senderId)}
                              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              Download
                            </button>
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1 text-xs ${
                        item.senderId === user.userId ? 'text-primary-100' : 'text-gray-500'
                      }`}>
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {item.type === 'message' && item.senderId === user.userId && (
                          <span className="ml-1">
                            {item.read ? (
                              <span className="text-cyan-300 font-bold drop-shadow-sm">✓✓</span>
                            ) : item.delivered ? (
                              <span className="opacity-70">✓✓</span>
                            ) : (
                              <span className="opacity-70">✓</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
              {sendingMessage && (
                <div className="mb-3 px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg text-primary-700 text-sm flex items-center gap-2 animate-[fade-in_0.3s_ease-in-out]">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Establishing secure connection...</span>
                </div>
              )}
              <form onSubmit={sendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  disabled={sendingMessage}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessage.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {sendingMessage ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Send'
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Welcome to SecureChat</h3>
            <p className="text-gray-500 max-w-md">
              Select a contact from the sidebar to start a secure, end-to-end encrypted conversation
            </p>
            <div className="mt-8 text-sm text-gray-400">
              <p>All messages are encrypted</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Chat;
