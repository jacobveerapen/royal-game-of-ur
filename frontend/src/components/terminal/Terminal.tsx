import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Terminal.css';

interface TerminalProps {
  width?: string;
  height?: string;
  maxOutputLines?: number;
}

export const Terminal: React.FC<TerminalProps> = ({ 
  width = '100%', 
  height = '100%',
  maxOutputLines = 500
}) => {
  const [output, setOutput] = useState<string[]>(['Welcome to the Royal Game of Ur Terminal', 'Connecting to the game server...']);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [useWebSocket, setUseWebSocket] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [attemptedHttp, setAttemptedHttp] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  
  const socketRef = useRef<WebSocket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<number | null>(null);
  
  // Initialize the terminal connection
  useEffect(() => {
    async function initTerminal() {
      try {
        if (isConnecting) return; // Prevent multiple connection attempts
        
        setIsConnecting(true);
        // Try WebSocket first
        console.log('Attempting WebSocket connection');
        setUseWebSocket(true);
        connectWebSocket();
        
        // Set a timeout to try HTTP fallback if WebSocket doesn't connect
        const wsTimeout = setTimeout(() => {
          // If not connected via WebSocket after 3 seconds, try HTTP
          if (!connected && !attemptedHttp) {
            console.log('WebSocket connection timeout, switching to HTTP fallback');
            setUseWebSocket(false);
            setAttemptedHttp(true);
            connectHttpFallback();
          }
        }, 3000);
        
        return () => {
          clearTimeout(wsTimeout);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
        };
      } catch (error) {
        console.error('Error initializing terminal:', error);
        setOutput(prev => [...prev, 'Error connecting to the game server. Please try again later.']);
      } finally {
        setIsConnecting(false);
      }
    }
    
    initTerminal();
    
    return () => {
      // Clean up
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      
      // Delete HTTP session if active
      if (sessionId && !useWebSocket) {
        axios.delete(`/api/terminal/${sessionId}`)
          .catch(error => console.error('Error cleaning up HTTP session:', error));
      }
    };
  }, []);
  
  // Function to trim output when it exceeds the maximum number of lines
  const trimOutput = (newOutput: string[]) => {
    if (newOutput.length > maxOutputLines) {
      return newOutput.slice(newOutput.length - maxOutputLines);
    }
    return newOutput;
  };
  
  // Connect via WebSocket
  const connectWebSocket = () => {
    try {
      // Use direct WebSocket URL to backend
      const wsUrl = 'ws://localhost:8000/terminal';
      console.log('Connecting to WebSocket at:', wsUrl);
      
      // Create a new WebSocket connection
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // Connection opened
      socket.addEventListener('open', () => {
        console.log('WebSocket connection established');
        setConnected(true);
        setIsConnecting(false);
        setAttemptedHttp(true); // Prevent further connection attempts
        setOutput(prev => [...prev, 'Connected to the game server. Type "help" for a list of commands.']);
      });
      
      // Listen for messages
      socket.addEventListener('message', (event) => {
        try {
          console.log('WebSocket message received:', event.data);
          const message = JSON.parse(event.data);
          
          if (message.type === 'output') {
            // Handle the output
            const content = message.content;
            
            // Check if it contains important game prompts
            const hasDicePrompt = content.includes("Press Enter to roll dice");
            const hasPiecePrompt = content.includes("Choose a piece") || content.includes("enter number");
            
            // Special handling for complete lines vs. prompts
            if (content.endsWith('\n')) {
              const lines = content.split('\n');
              // Add all non-empty lines
              for (let i = 0; i < lines.length - 1; i++) {
                if (lines[i]) {
                  setOutput(prev => trimOutput([...prev, lines[i]]));
                }
              }
            } else {
              // This is a prompt without a newline or a partial line
              setOutput(prev => trimOutput([...prev, content]));
            }
            
            // If this is a prompt that requires immediate attention, make it visible
            if (hasDicePrompt || hasPiecePrompt) {
              // Ensure the prompt is visible
              setAutoScroll(true); // Force scroll to bottom for important prompts
              setTimeout(() => {
                if (terminalEndRef.current) {
                  terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }
          } else if (message.type === 'error') {
            setOutput(prev => trimOutput([...prev, `Error: ${message.content}`]));
            setAutoScroll(true); // Scroll to errors
          } else if (message.type === 'exit') {
            setOutput(prev => trimOutput([...prev, `Game process exited with code ${message.exit_code}`]));
            setConnected(false);
            setAutoScroll(true); // Scroll to exit message
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Connection closed
      socket.addEventListener('close', () => {
        console.log('WebSocket connection closed');
        
        if (connected) {
          setConnected(false);
          setOutput(prev => [...prev, 'Disconnected from game server.']);
        } else if (!attemptedHttp) {
          // Only try HTTP fallback if we haven't tried it yet
          console.log('WebSocket connection failed, switching to HTTP fallback');
          setUseWebSocket(false);
          setAttemptedHttp(true);
          connectHttpFallback();
        }
        
        setIsConnecting(false);
      });
      
      // Connection error
      socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        
        if (!attemptedHttp) {
          // Only try HTTP fallback if we haven't tried it yet
          console.log('WebSocket error, switching to HTTP fallback');
          setUseWebSocket(false);
          setAttemptedHttp(true);
          connectHttpFallback();
        } else {
          setOutput(prev => [...prev, 'Error connecting to game server. Please try again later.']);
        }
        
        setIsConnecting(false);
      });
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setIsConnecting(false);
      
      if (!attemptedHttp) {
        // Only try HTTP fallback if we haven't tried it yet
        setUseWebSocket(false);
        setAttemptedHttp(true);
        connectHttpFallback();
      }
    }
  };
  
  // Connect via HTTP fallback
  const connectHttpFallback = async () => {
    if (isConnecting) return; // Prevent multiple connection attempts
    
    setIsConnecting(true);
    try {
      console.log('Connecting via HTTP fallback');
      setOutput(prev => [...prev, 'WebSocket connection failed, trying HTTP fallback...']);
      
      // Create a new HTTP terminal session
      const response = await axios.post('/api/terminal/create');
      const sid = response.data.session_id;
      setSessionId(sid);
      setConnected(true);
      setOutput(prev => [...prev, 'Connected to the game server via HTTP. Type "help" for a list of commands.']);
      
      // Start polling for output
      startPolling(sid);
    } catch (error) {
      console.error('Error connecting via HTTP:', error);
      setOutput(prev => [...prev, 'Error connecting to game server. Please try again later.']);
      setConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Start polling for output from the HTTP terminal
  const startPolling = (sid: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    // Keep track of seen lines to prevent duplicates
    const seenLines = new Set<string>();
    let lastPollTime = Date.now();
    
    // Poll every 500ms
    pollingRef.current = window.setInterval(async () => {
      if (!sid) return;
      
      try {
        const response = await axios.get(`/api/terminal/${sid}/output`);
        const { lines, has_more } = response.data;
        
        if (lines && lines.length > 0) {
          // Process and add new lines
          const newLines: string[] = [];
          for (const line of lines) {
            // Skip if empty or already seen recently
            if (!line.trim() || seenLines.has(line)) continue;
            
            // Add to seen set (with 10-second expiration)
            seenLines.add(line);
            setTimeout(() => seenLines.delete(line), 10000);
            
            newLines.push(line);
          }
          
          if (newLines.length > 0) {
            setOutput(prev => trimOutput([...prev, ...newLines]));
          }
        }
        
        // If process has exited
        if (!has_more) {
          setConnected(false);
          setOutput(prev => [...prev, 'Game process has exited.']);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
        }
        
        // Log slow polls that might indicate backend issues
        const pollTime = Date.now() - lastPollTime;
        if (pollTime > 1000) {
          console.warn(`Slow polling: ${pollTime}ms`);
        }
        lastPollTime = Date.now();
      } catch (error) {
        console.error('Error polling terminal output:', error);
        
        // Stop polling if the session is gone
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setConnected(false);
          setOutput(prev => [...prev, 'Terminal session has ended.']);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
        }
      }
    }, 500);
  };
  
  // Auto-scroll to bottom when output changes if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, autoScroll]);

  // Add scroll event listener to detect when user scrolls up manually
  useEffect(() => {
    const outputElement = outputRef.current;
    
    const handleScroll = () => {
      if (!outputElement) return;
      
      const { scrollTop, scrollHeight, clientHeight } = outputElement;
      // If we're near the bottom, enable auto-scroll, otherwise disable it
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isNearBottom);
    };
    
    if (outputElement) {
      outputElement.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (outputElement) {
        outputElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };
  
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const command = input.trim();
    setOutput(prev => trimOutput([...prev, `$ ${command || '<Enter>'}`]));
    setInput('');
    setAutoScroll(true); // Force scroll to bottom when user sends a command
    
    if (command === 'clear') {
      setOutput(['Terminal cleared']);
      return;
    }
    
    if (!connected) {
      setOutput(prev => [...prev, 'Not connected to the game server.']);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Always send a command, even if empty (for run_game.py "press enter to roll")
      if (useWebSocket && socketRef.current) {
        // Send command via WebSocket
        console.log('Sending command via WebSocket:', command || '<Enter>');
        socketRef.current.send(JSON.stringify({
          type: 'input',
          content: command || ''  // Send empty string if no command
        }));
      } else if (sessionId) {
        // Send command via HTTP
        console.log('Sending command via HTTP:', command || '<Enter>');
        await axios.post(`/api/terminal/${sessionId}/input`, {
          command: command || ''  // Send empty string if no command
        });
      }
    } catch (error) {
      console.error('Error sending command:', error);
      setOutput(prev => [...prev, 'Error sending command. Connection might be lost.']);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to scroll to the bottom of the terminal
  const scrollToBottom = () => {
    setAutoScroll(true);
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // For status display
  const getConnectionStatus = () => {
    if (isConnecting) return 'Connecting...';
    if (connected) {
      return useWebSocket ? 'Connected (WebSocket)' : 'Connected (HTTP)';
    }
    return 'Disconnected';
  };
  
  return (
    <div className="terminal-container" style={{ width, height }}>
      <div className="terminal-header">
        <div className="terminal-title">Game Terminal</div>
        <div className={`terminal-status ${connected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}`}>
          {getConnectionStatus()}
        </div>
      </div>
      <div 
        className="terminal-output" 
        ref={outputRef}
      >
        {output.map((line, i) => (
          <div key={i} className="terminal-line">{line}</div>
        ))}
        {isLoading && <div className="terminal-line loading">Processing...</div>}
        <div ref={terminalEndRef} />
      </div>
      {!autoScroll && (
        <button 
          className="scroll-to-bottom-button" 
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}
      <form onSubmit={handleFormSubmit} className="terminal-input-container">
        <span className="terminal-prompt">$</span>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          className="terminal-input"
          placeholder="Type command..."
          disabled={isLoading || !connected}
          autoFocus
        />
      </form>
    </div>
  );
}; 