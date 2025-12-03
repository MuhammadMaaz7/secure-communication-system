import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageService } from '../services/messageService';
import { FileService } from '../services/fileService';
import socketService from '../services/socketService';
import api from '../services/api';

const Chat = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadUsers();
    
    const token = localStorage.getItem('authToken');
    socketService.connect(token);

    // Check for pending key exchanges every 3 seconds
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
        // Silently fail - this is just a background check
      }
    };

    // Check immediately and then every 3 seconds
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

  // Handle real-time events - register once on mount
  useEffect(() => {
    const handleMessage = async (data) => {
      console.log('Message notification:', data);
      
      // Mark message as delivered immediately when received
      if (data.messageId) {
        try {
          await MessageService.markAsDelivered(data.messageId);
        } catch (error) {
          console.error('Failed to mark message as delivered:', error);
        }
      }
      
      // Reload messages if viewing conversation with sender
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
      // Update message status in real-time
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
  }, []); // Empty dependency array - register once on mount

  useEffect(() => {
    // Handle incoming key exchange requests
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
      
      // Initialize online users
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
      
      // Mark received messages as read when viewing the conversation
      for (const msg of msgs) {
        if (msg.receiverId === user.userId && !msg.read) {
          // Mark as read (delivered status should already be set when message was received)
          await MessageService.markAsRead(msg._id);
        }
      }
      
      // Combine messages and files, then sort by timestamp
      const combined = [
        ...msgs.map(m => ({ ...m, type: 'message' })),
        ...filesList.map(f => ({ ...f, type: 'file' }))
      ];
      
      combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Separate back into messages and files for display
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
    setNewMessage(''); // Clear input immediately for better UX
    setSendingMessage(true);

    try {
      await MessageService.sendMessage(selectedUser._id, messageToSend);
      
      // Backend now handles WebSocket notification
      loadMessages(selectedUser._id);
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Restore message to input if send failed
      setNewMessage(messageToSend);
      
      // Show user-friendly error
      const errorMsg = error.message || 'Failed to send message';
      alert(`Error: ${errorMsg}`);
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
      
      // Notify receiver via WebSocket
      socketService.emit('file-uploaded', {
        receiverId: selectedUser._id,
        fileId: result.fileId,
        fileName: selectedFile.name,
      });
      
      alert(`File "${selectedFile.name}" uploaded successfully`);
      
      // Reload to show file
      loadMessages(selectedUser._id);
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <h3>E2EE Chat</h3>
          <p style={styles.username}>{user?.username}</p>
          <button onClick={logout} style={styles.logoutBtn}>Logout</button>
        </div>
        <div style={styles.userList}>
          <h4 style={styles.userListTitle}>Users</h4>
          {users.map((u) => (
            <div
              key={u._id}
              onClick={() => setSelectedUser(u)}
              style={{
                ...styles.userItem,
                ...(selectedUser?._id === u._id ? styles.userItemActive : {}),
              }}
            >
              <div style={styles.avatarContainer}>
                <div style={styles.avatar}>{u.username[0].toUpperCase()}</div>
                {onlineUsers.has(u._id) && <div style={styles.onlineIndicator} />}
              </div>
              <div style={styles.userInfo}>
                <span>{u.username}</span>
                {onlineUsers.has(u._id) && (
                  <span style={styles.onlineText}>online</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.chatArea}>
        {selectedUser ? (
          <>
            <div style={styles.chatHeader}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedUser.username}</h3>
                {onlineUsers.has(selectedUser._id) && (
                  <span style={styles.onlineStatus}>online</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.fileBtn}
                >
                  📎 Attach File
                </button>
                {selectedFile && (
                  <button onClick={uploadFile} style={styles.uploadBtn}>
                    Upload {selectedFile.name}
                  </button>
                )}
              </div>
            </div>

            <div style={styles.messagesContainer}>
              {loading && <div style={styles.loading}>Loading messages...</div>}
              
              {/* Combine and display messages and files in chronological order */}
              {[...messages, ...files]
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .map((item, idx) => (
                  <div
                    key={`${item.type}-${idx}`}
                    style={{
                      ...styles.message,
                      ...(item.senderId === user.userId
                        ? styles.messageSent
                        : styles.messageReceived),
                    }}
                  >
                    <div style={styles.messageContent}>
                      {item.type === 'message' ? (
                        <>
                          {item.text}
                          {!item.decrypted && (
                            <span style={styles.decryptError}> ⚠️</span>
                          )}
                        </>
                      ) : (
                        <>
                          📎 {item.fileName} ({Math.round(item.fileSize / 1024)}KB)
                          <button
                            onClick={() => FileService.downloadFile(item._id, item.senderId === user.userId ? item.receiverId : item.senderId)}
                            style={styles.downloadBtn}
                          >
                            Download
                          </button>
                        </>
                      )}
                    </div>
                    <div style={styles.messageTime}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                      {item.type === 'message' && item.senderId === user.userId && (
                        <span style={styles.messageStatus}>
                          {item.read ? (
                            <span style={styles.readStatus}>✓✓</span>
                          ) : item.delivered ? (
                            <span style={styles.deliveredStatus}>✓✓</span>
                          ) : (
                            <span style={styles.sentStatus}>✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} style={styles.inputArea}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={styles.input}
                disabled={sendingMessage}
              />
              <button 
                type="submit" 
                style={{
                  ...styles.sendBtn,
                  ...(sendingMessage ? styles.sendBtnDisabled : {})
                }}
                disabled={sendingMessage}
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </form>
            {sendingMessage && (
              <div style={styles.sendingIndicator}>
                Establishing secure connection...
              </div>
            )}
          </>
        ) : (
          <div style={styles.noChat}>
            <h3>Select a user to start chatting</h3>
            <p>All messages are end-to-end encrypted</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  sidebar: {
    width: '300px',
    backgroundColor: '#2c3e50',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #34495e',
  },
  username: {
    fontSize: '0.9rem',
    color: '#bdc3c7',
    margin: '0.5rem 0',
  },
  logoutBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '100%',
  },
  userList: {
    flex: 1,
    overflowY: 'auto',
  },
  userListTitle: {
    padding: '1rem',
    margin: 0,
    fontSize: '0.9rem',
    color: '#bdc3c7',
  },
  userItem: {
    padding: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    transition: 'background-color 0.2s',
  },
  userItemActive: {
    backgroundColor: '#34495e',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#3498db',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: '2px',
    right: '2px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#27ae60',
    border: '2px solid #2c3e50',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  onlineText: {
    fontSize: '0.75rem',
    color: '#27ae60',
  },
  onlineStatus: {
    fontSize: '0.85rem',
    color: '#27ae60',
    marginLeft: '0.5rem',
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
  },
  chatHeader: {
    padding: '1rem',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '0.5rem',
  },
  uploadBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    padding: '1rem',
  },
  message: {
    maxWidth: '70%',
    padding: '0.75rem',
    borderRadius: '8px',
    wordWrap: 'break-word',
  },
  messageSent: {
    alignSelf: 'flex-end',
    backgroundColor: '#3498db',
    color: 'white',
  },
  messageReceived: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecf0f1',
    color: '#2c3e50',
  },
  messageContent: {
    marginBottom: '0.25rem',
  },
  messageTime: {
    fontSize: '0.75rem',
    opacity: 0.7,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  messageStatus: {
    marginLeft: '4px',
    fontSize: '0.85rem',
  },
  sentStatus: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  deliveredStatus: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  readStatus: {
    color: '#00e5ff',
    fontWeight: 'bold',
    textShadow: '0 0 2px rgba(0, 0, 0, 0.3)',
  },
  decryptError: {
    color: '#e74c3c',
  },
  inputArea: {
    display: 'flex',
    padding: '1rem',
    borderTop: '1px solid #ddd',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  sendBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  sendBtnDisabled: {
    backgroundColor: '#95a5a6',
    cursor: 'not-allowed',
  },
  sendingIndicator: {
    position: 'absolute',
    bottom: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    color: 'white',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    fontSize: '0.9rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  noChat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#666',
  },
  downloadBtn: {
    marginLeft: '10px',
    padding: '4px 8px',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};

export default Chat;
