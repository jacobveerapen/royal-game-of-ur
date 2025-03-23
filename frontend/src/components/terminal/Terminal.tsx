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
      // Use relative WebSocket URL to use the Vite proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/terminal`;
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
            
            // Process the content line by line to preserve exact formatting
            const lines = content.split('\n');
            
            // If there are multiple lines, add each one separately to preserve exact formatting
            if (lines.length > 1) {
              for (let i = 0; i < lines.length; i++) {
                // Don't skip empty lines to preserve exact formatting
                if (i < lines.length - 1 || lines[i].length > 0) {
                  setOutput(prev => trimOutput([...prev, lines[i]]));
                }
              }
            } else if (content.length > 0) {
              // Add single line content
              setOutput(prev => trimOutput([...prev, content]));
            }
            
            // Always scroll to bottom for game content to ensure all prompts are visible
            setAutoScroll(true);
            setTimeout(() => {
              if (terminalEndRef.current) {
                terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 50);
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
    
    // Keep track of last poll time for performance monitoring
    let lastPollTime = Date.now();
    
    // Keep track of last seen lines to prevent duplicates
    const processedLines = new Set<string>();
    
    // Track duplicate consecutive lines
    let lastOutputSize = 0;
    
    // Poll every 300ms for more responsive updates
    pollingRef.current = window.setInterval(async () => {
      if (!sid) return;
      
      try {
        const response = await axios.get(`/api/terminal/${sid}/output`);
        const { lines, has_more } = response.data;
        
        if (lines && lines.length > 0) {
          // Check if we're getting the exact same response as last time
          const responseKey = JSON.stringify(lines);
          if (lines.length === lastOutputSize && processedLines.has(responseKey)) {
            // This is a duplicate response, skip it
            return;
          }
          
          // Keep track of this response to avoid duplicates
          processedLines.add(responseKey);
          lastOutputSize = lines.length;
          
          // Limit the size of our tracking set to avoid memory issues
          if (processedLines.size > 20) {
            // Convert to array, remove oldest entries, convert back to set
            const processedArray = Array.from(processedLines);
            processedLines.clear();
            processedArray.slice(-10).forEach(item => processedLines.add(item));
          }
          
          // Create a batch update to avoid multiple state updates
          const newLines: string[] = [];
          
          // Check if lines contain prompt responses that were already shown
          for (const line of lines) {
            // Add each line to our batch
            newLines.push(line);
          }
          
          // Update state once with all new lines
          if (newLines.length > 0) {
            setOutput(prev => {
              // Check for duplicates at the end of the output
              const combinedOutput = [...prev, ...newLines];
              
              // Remove exact consecutive duplicates
              const deduplicatedOutput = combinedOutput.filter(
                (line, index, arr) => index === 0 || line !== arr[index - 1]
              );
              
              return trimOutput(deduplicatedOutput);
            });
            
            // Always scroll to bottom to ensure prompts are visible
            setAutoScroll(true);
            setTimeout(() => {
              if (terminalEndRef.current) {
                terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 50);
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
    }, 300); // Faster polling for more responsive updates
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
  
  // Function to determine the CSS class for a terminal line based on content
  const getLineClass = (line: string) => {
    // Base class
    let className = "terminal-line";
    
    // Check for prompt lines
    if (line.includes("Press Enter to roll dice") || 
        line.includes("Choose a piece to move") || 
        line.includes("You rolled:") || 
        line.includes("Available pieces") ||
        line.includes("enter number")) {
      className += " terminal-prompt-line";
    }
    // Check for board visualization lines
    else if (line.includes("|")) {
      className += " terminal-board-line";
    }
    // Check for game header lines
    else if (line.includes("Royal Game of Ur") || 
             line.includes("Current Player:") ||
             line.includes("Pieces in hand") ||
             line.includes("Completed pieces")) {
      className += " terminal-header-line";
    }
    // Check for game ending lines
    else if (line.includes("Game Over") || line.includes("wins!")) {
      className += " terminal-ending-line";
    }
    
    return className;
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
          <div key={i} className={getLineClass(line)}>{line}</div>
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