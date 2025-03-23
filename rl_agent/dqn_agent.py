"""
Deep Q-Network (DQN) agent for learning to play the Royal Game of Ur.
"""
import os
import random
import datetime
import numpy as np
import tensorflow as tf
from collections import deque

# Enable mixed precision for faster training on supported hardware
try:
    policy = tf.keras.mixed_precision.Policy('mixed_float16')
    tf.keras.mixed_precision.set_global_policy(policy)
    print("Using mixed precision policy:", policy.name)
except:
    print("Mixed precision not supported, using default precision")

from backend.ur_game.game import Game
from backend.ur_game.game.board import Player, Piece
from rl_agent.state_representation import StateRepresentation

class ReplayBuffer:
    """
    Experience replay buffer for storing and sampling experiences.
    """
    def __init__(self, capacity=10000):
        self.buffer = deque(maxlen=capacity)
    
    def add(self, state, action, reward, next_state, done):
        """Add an experience to the buffer."""
        self.buffer.append((state, action, reward, next_state, done))
    
    def sample(self, batch_size):
        """Sample a batch of experiences from the buffer."""
        if batch_size > len(self.buffer):
            batch_size = len(self.buffer)
        
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        
        return (
            np.array(states), 
            np.array(actions), 
            np.array(rewards, dtype=np.float32), 
            np.array(next_states),
            np.array(dones, dtype=np.float32)
        )
    
    def __len__(self):
        return len(self.buffer)


class DQNAgent:
    """
    Deep Q-Network agent for learning to play the Royal Game of Ur through reinforcement learning.
    """
    def __init__(
        self,
        state_shape,
        action_size,
        learning_rate=0.001,
        discount_factor=0.99,
        epsilon_start=1.0,
        epsilon_min=0.1,
        epsilon_decay=0.995,
        update_target_frequency=1000,
        batch_size=64,
        replay_buffer_size=10000,
        double_dqn=True
    ):
        """
        Initialize the DQN agent.
        
        Args:
            state_shape: Shape of the state representation.
            action_size: Number of possible actions.
            learning_rate: Learning rate for the neural network.
            discount_factor: Discount factor for future rewards.
            epsilon_start: Initial exploration rate.
            epsilon_min: Minimum exploration rate.
            epsilon_decay: Rate at which epsilon decays after each episode.
            update_target_frequency: How often to update the target network.
            batch_size: Batch size for training.
            replay_buffer_size: Size of the replay buffer.
            double_dqn: Whether to use Double DQN algorithm.
        """
        self.state_shape = state_shape
        self.action_size = action_size
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.epsilon = epsilon_start
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay
        self.update_target_frequency = update_target_frequency
        self.batch_size = batch_size
        self.double_dqn = double_dqn
        
        # Create replay buffer
        self.replay_buffer = ReplayBuffer(replay_buffer_size)
        
        # Initialize primary and target networks
        self.primary_network = self._build_model()
        self.target_network = self._build_model()
        self.update_target_network()
        
        # Metrics for training visualization
        self.loss_history = []
        self.reward_history = []
        self.win_history = []
        self.epsilon_history = []
        self.q_value_history = []
        
        # Training step counter
        self.train_step_counter = 0
        
        # For logging
        current_time = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        self.log_dir = f"logs/dqn/{current_time}"
        self.summary_writer = tf.summary.create_file_writer(self.log_dir)

    def _build_model(self):
        """
        Build the neural network model.
        
        Returns:
            A Keras model.
        """
        inputs = tf.keras.layers.Input(shape=self.state_shape)
        
        # Convolutional layers to process the board state
        x = tf.keras.layers.Conv2D(64, (2, 2), padding='same', activation='relu')(inputs)
        x = tf.keras.layers.Conv2D(128, (2, 2), padding='same', activation='relu')(x)
        
        # Flatten and add fully connected layers
        x = tf.keras.layers.Flatten()(x)
        x = tf.keras.layers.Dense(256, activation='relu')(x)
        x = tf.keras.layers.Dropout(0.2)(x)
        x = tf.keras.layers.Dense(128, activation='relu')(x)
        
        # Output layer with linear activation for Q-values
        outputs = tf.keras.layers.Dense(self.action_size, activation='linear')(x)
        
        model = tf.keras.models.Model(inputs=inputs, outputs=outputs)
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=self.learning_rate),
            loss='mse'
        )
        
        return model

    def update_target_network(self):
        """Update the target network weights to match the primary network."""
        self.target_network.set_weights(self.primary_network.get_weights())

    def select_action(self, state, valid_pieces):
        """
        Select an action using epsilon-greedy policy.
        
        Args:
            state: The current state representation.
            valid_pieces: List of valid pieces that can be moved.
            
        Returns:
            The selected piece index.
        """
        # No valid moves available
        if not valid_pieces:
            return None
            
        # Ensure state is shaped correctly (add batch dimension if needed)
        if len(state.shape) == 3:
            state = np.expand_dims(state, axis=0)
        
        # Explore: choose a random valid piece
        if np.random.rand() <= self.epsilon:
            return np.random.choice(len(valid_pieces))
        
        # Exploit: choose the piece with highest Q-value
        q_values = self.primary_network.predict(state, verbose=0)[0]
        
        # Filter to only consider valid actions (pieces that can be moved)
        valid_actions = [i for i in range(len(valid_pieces))]
        
        # Get the Q-values for valid actions only
        valid_q_values = [q_values[i] for i in valid_actions]
        
        # Choose the action with highest Q-value among valid actions
        return valid_actions[np.argmax(valid_q_values)]

    def train(self):
        """
        Train the agent using experiences from the replay buffer.
        """
        if len(self.replay_buffer) < self.batch_size:
            return 0  # Not enough samples for training
        
        # Sample a batch of experiences
        states, actions, rewards, next_states, dones = self.replay_buffer.sample(self.batch_size)
        
        # Compute target Q-values
        if self.double_dqn:
            # Double DQN: use primary network to select actions, target network to evaluate
            next_actions = np.argmax(self.primary_network.predict(next_states, verbose=0), axis=1)
            next_q_values = self.target_network.predict(next_states, verbose=0)
            next_q_values = next_q_values[np.arange(self.batch_size), next_actions]
        else:
            # Standard DQN: use max Q-value from target network
            next_q_values = np.max(self.target_network.predict(next_states, verbose=0), axis=1)
        
        # Compute target values (reward + discounted future reward)
        targets = rewards + (1 - dones) * self.discount_factor * next_q_values
        
        # Get current Q-values from primary network
        current_q = self.primary_network.predict(states, verbose=0)
        
        # Update only the Q-values for the actions taken
        for i in range(self.batch_size):
            current_q[i][actions[i]] = targets[i]
        
        # Perform gradient descent step
        history = self.primary_network.fit(
            states, current_q, 
            epochs=1, verbose=0, 
            batch_size=self.batch_size
        )
        
        loss = history.history['loss'][0]
        self.loss_history.append(loss)
        
        # Update target network periodically
        self.train_step_counter += 1
        if self.train_step_counter % self.update_target_frequency == 0:
            self.update_target_network()
            
        # Log metrics
        with self.summary_writer.as_default():
            tf.summary.scalar('training/loss', loss, step=self.train_step_counter)
            tf.summary.scalar('training/epsilon', self.epsilon, step=self.train_step_counter)
            
        return loss

    def decay_epsilon(self):
        """Decay the exploration rate."""
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
            self.epsilon_history.append(self.epsilon)

    def save_model(self, filepath):
        """Save the model to disk."""
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        self.primary_network.save(filepath)
        
    def load_model(self, filepath):
        """Load the model from disk."""
        self.primary_network = tf.keras.models.load_model(filepath)
        self.update_target_network()


class UrDQNAgent:
    """
    Specialized DQN agent for playing the Royal Game of Ur.
    This class handles the interface between the game and the DQN agent.
    """
    def __init__(self, **kwargs):
        """
        Initialize the agent.
        
        Args:
            **kwargs: Arguments to pass to the DQN agent.
        """
        # The action space is the maximum number of pieces per player (7)
        self.action_size = 7
        
        # Create the DQN agent
        self.dqn = DQNAgent(
            state_shape=StateRepresentation.get_state_shape(),
            action_size=self.action_size,
            **kwargs
        )
        
        # For tracking rewards
        self.cumulative_reward = 0
        self.episode_rewards = []
        
    def get_move(self, game: Game) -> Piece:
        """
        Select a piece to move based on the current game state.
        
        Args:
            game: The Game object containing the current state.
            
        Returns:
            The selected Piece object, or None if no valid moves are available.
        """
        # Get valid moves
        valid_pieces = list(game.get_valid_moves())
        if not valid_pieces:
            return None
        
        # Get state representation
        state = StateRepresentation.get_state(game)
        
        # Select action (index into valid_pieces list)
        action_index = self.dqn.select_action(state, valid_pieces)
        
        if action_index is None:
            return None
            
        return valid_pieces[action_index]
    
    def calculate_reward(self, game: Game, old_state, new_state, moved_piece=None, move_result=None):
        """
        Calculate the reward for a move.
        
        Args:
            game: The Game object.
            old_state: Game state before the move.
            new_state: Game state after the move.
            moved_piece: The piece that was moved.
            move_result: Result of the move (True if landed on rosette).
            
        Returns:
            The calculated reward.
        """
        reward = 0
        
        # If the game is over and we won
        if game.game_over and game.winner == game.current_player:
            reward += 10.0  # Big reward for winning
            return reward
        
        # If the game is over and we lost
        if game.game_over and game.winner != game.current_player:
            reward -= 5.0  # Penalty for losing
            return reward
            
        # Basic rewards
        player = game.current_player
        opponent = Player.TWO if player == Player.ONE else Player.ONE
        
        # Reward for moving a piece out of hand
        if moved_piece and moved_piece in old_state.board.pieces_in_hand[player] and moved_piece not in new_state.board.pieces_in_hand[player]:
            reward += 0.1
            
        # Reward for completing a piece
        old_completed = sum(1 for p in old_state.board.pieces[player] if p.completed)
        new_completed = sum(1 for p in new_state.board.pieces[player] if p.completed)
        
        if new_completed > old_completed:
            reward += 1.0  # Significant reward for completing a piece
            
        # Reward for landing on a rosette (getting an extra turn)
        if move_result:
            reward += 0.5
            
        # Reward for capturing an opponent piece
        old_opponent_hand = len(old_state.board.pieces_in_hand[opponent])
        new_opponent_hand = len(new_state.board.pieces_in_hand[opponent])
        
        if new_opponent_hand > old_opponent_hand:
            reward += 0.8  # Reward for capturing
            
        # Small penalty for not using a high dice roll efficiently
        if game.dice_result >= 3 and moved_piece and moved_piece in new_state.board.pieces_in_hand[player]:
            reward -= 0.1
            
        return reward
    
    def record_experience(self, state, action_index, reward, next_state, done):
        """
        Record an experience in the replay buffer.
        
        Args:
            state: The state before the action.
            action_index: The index of the action taken.
            reward: The reward received.
            next_state: The state after the action.
            done: Whether the episode is done.
        """
        self.dqn.replay_buffer.add(state, action_index, reward, next_state, done)
        self.cumulative_reward += reward
        
    def train(self):
        """Train the agent on a batch of experiences."""
        return self.dqn.train()
        
    def end_episode(self, won=False):
        """
        End the current episode, update metrics, and decay epsilon.
        
        Args:
            won: Whether the agent won the episode.
        """
        self.episode_rewards.append(self.cumulative_reward)
        self.dqn.win_history.append(1 if won else 0)
        self.dqn.reward_history.append(self.cumulative_reward)
        
        # Log metrics
        with self.dqn.summary_writer.as_default():
            episode = len(self.episode_rewards)
            tf.summary.scalar('episode/reward', self.cumulative_reward, step=episode)
            tf.summary.scalar('episode/win', 1 if won else 0, step=episode)
            
        # Reset cumulative reward for next episode
        self.cumulative_reward = 0
        
        # Decay exploration rate
        self.dqn.decay_epsilon()
        
    def save(self, filepath):
        """Save the model to disk."""
        self.dqn.save_model(filepath)
        
    def load(self, filepath):
        """Load the model from disk."""
        self.dqn.load_model(filepath) 