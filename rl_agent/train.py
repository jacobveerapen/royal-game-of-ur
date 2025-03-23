"""
Training script for the Royal Game of Ur reinforcement learning agent.
Uses self-play to train the agent.
"""
import os
import time
import numpy as np
import matplotlib.pyplot as plt
from tqdm import tqdm
import tensorflow as tf
import copy
import multiprocessing

# Configure TensorFlow to use multiple cores
num_cores = multiprocessing.cpu_count()
print(f"Using {num_cores} CPU cores for training")
tf.config.threading.set_intra_op_parallelism_threads(num_cores)
tf.config.threading.set_inter_op_parallelism_threads(num_cores)

# Check if GPU is available and enable memory growth to avoid allocation errors
try:
    physical_devices = tf.config.list_physical_devices('GPU')
    if len(physical_devices) > 0:
        print(f"Found {len(physical_devices)} GPU(s)")
        for device in physical_devices:
            tf.config.experimental.set_memory_growth(device, True)
            print(f"Enabled memory growth for {device}")
    else:
        print("No GPU found, using CPU for training")
except:
    print("Error configuring GPU, falling back to CPU")

from backend.ur_game.game import Game
from backend.ur_game.game.board import Player, Piece
from rl_agent.dqn_agent import UrDQNAgent
from rl_agent.state_representation import StateRepresentation

def plot_training_metrics(agent, save_path="training_metrics.png"):
    """
    Plot training metrics for visualization.
    
    Args:
        agent: The UrDQNAgent being trained.
        save_path: Path to save the plot.
    """
    # Create figure with subplots
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle("Training Metrics", fontsize=16)
    
    # Plot rewards
    axes[0, 0].plot(agent.episode_rewards)
    axes[0, 0].set_title("Episode Rewards")
    axes[0, 0].set_xlabel("Episode")
    axes[0, 0].set_ylabel("Reward")
    
    # Plot win rate (moving average)
    if agent.dqn.win_history:
        window_size = min(100, len(agent.dqn.win_history))
        win_rate = np.convolve(agent.dqn.win_history, np.ones(window_size)/window_size, mode='valid')
        axes[0, 1].plot(win_rate)
        axes[0, 1].set_title(f"Win Rate (Moving Avg, window={window_size})")
        axes[0, 1].set_xlabel("Episode")
        axes[0, 1].set_ylabel("Win Rate")
        axes[0, 1].set_ylim([0, 1])
    
    # Plot loss
    if agent.dqn.loss_history:
        axes[1, 0].plot(agent.dqn.loss_history)
        axes[1, 0].set_title("Training Loss")
        axes[1, 0].set_xlabel("Training Step")
        axes[1, 0].set_ylabel("Loss")
    
    # Plot epsilon
    if agent.dqn.epsilon_history:
        axes[1, 1].plot(agent.dqn.epsilon_history)
        axes[1, 1].set_title("Exploration Rate (Epsilon)")
        axes[1, 1].set_xlabel("Episode")
        axes[1, 1].set_ylabel("Epsilon")
        axes[1, 1].set_ylim([0, 1])
    
    # Adjust layout and save
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig(save_path)
    plt.close()

def self_play_episode(agent1, agent2=None, training=True, render=False):
    """
    Run a self-play training episode.
    
    Args:
        agent1: The primary agent (UrDQNAgent).
        agent2: Optional second agent. If None, agent1 plays against itself.
        training: Whether to train the agent during this episode.
        render: Whether to render the game state during play.
        
    Returns:
        Tuple of (winner, num_turns)
    """
    # If agent2 is None, use agent1 for both players
    if agent2 is None:
        agent2 = agent1
    
    # Initialize game
    game = Game()
    turn_count = 0
    
    # Store states and actions for experience replay
    states = {}
    actions = {}
    moved_pieces = {}
    
    # Main game loop
    while not game.game_over:
        turn_count += 1
        
        # Determine current agent
        current_agent = agent1 if game.current_player == Player.ONE else agent2
        
        # Roll dice
        dice_roll = game.roll_dice()
        
        if dice_roll == 0:
            game.next_turn()
            continue
        
        # Get valid moves
        valid_moves = game.get_valid_moves()
        if not valid_moves:
            game.next_turn()
            continue
        
        # Convert game state to neural network input
        state = StateRepresentation.get_state(game)
        
        # Store state before move
        old_state = copy.deepcopy(game)
        
        # Get agent's move
        valid_pieces = list(valid_moves)
        if game.current_player == Player.ONE or agent2 is agent1:
            # Agent1 is making a move
            action_index = agent1.dqn.select_action(state, valid_pieces)
            selected_piece = valid_pieces[action_index]
            
            # Store state and action for later training
            states[game.current_player] = state
            actions[game.current_player] = action_index
            moved_pieces[game.current_player] = selected_piece
        else:
            # Agent2 is making a move
            action_index = agent2.dqn.select_action(state, valid_pieces)
            selected_piece = valid_pieces[action_index]
            
            # Store state and action if agent2 is also training
            if agent2 is not agent1:
                states[game.current_player] = state
                actions[game.current_player] = action_index
                moved_pieces[game.current_player] = selected_piece
        
        # Make the move
        move_result = game.make_move(selected_piece)
        
        # Debug: render the game state if requested
        if render and turn_count % 5 == 0:
            print(f"\nTurn {turn_count}, Player {game.current_player.name}")
            print(f"Dice Roll: {dice_roll}")
            print(f"Selected Piece: {selected_piece}")
            print(game.board)
        
        # Calculate reward for the move
        if game.current_player in states:
            reward = current_agent.calculate_reward(
                game, old_state, game, 
                moved_pieces[game.current_player], 
                move_result
            )
            
            # Get next state
            next_state = StateRepresentation.get_state(game)
            
            # Record experience for training
            if training:
                current_agent.record_experience(
                    states[game.current_player],
                    actions[game.current_player],
                    reward,
                    next_state,
                    game.game_over
                )
                
                # Train on this experience
                if turn_count % 10 == 0:
                    current_agent.train()
        
        # If didn't land on rosette, next player's turn
        if not move_result:
            game.next_turn()
    
    # End of game - calculate final rewards
    if agent1 is agent2:
        # If self-play, update the agent based on who won
        agent1.end_episode(won=(game.winner == Player.ONE))
    else:
        # If playing against another agent, update each agent separately
        agent1.end_episode(won=(game.winner == Player.ONE))
        if agent2 is not None:
            agent2.end_episode(won=(game.winner == Player.TWO))
    
    return game.winner, turn_count

def train(
    num_episodes=10000,
    save_interval=500,
    plot_interval=100,
    eval_interval=500,
    models_dir="models",
    verbose=True,
    batch_size=128
):
    """
    Train the agent using self-play.
    
    Args:
        num_episodes: Number of episodes to train for.
        save_interval: How often to save the model.
        plot_interval: How often to plot training metrics.
        eval_interval: How often to evaluate the agent.
        models_dir: Directory to save models.
        verbose: Whether to print progress.
        batch_size: Batch size for training (larger = faster but more memory).
    """
    # Create directories
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs("plots", exist_ok=True)
    
    # Create agent
    agent = UrDQNAgent(
        learning_rate=0.001,
        discount_factor=0.99,
        epsilon_start=1.0,
        epsilon_min=0.01,
        epsilon_decay=0.995,
        update_target_frequency=500,
        batch_size=batch_size,
        replay_buffer_size=50000,
        double_dqn=True
    )
    
    # Training loop
    start_time = time.time()
    progress_bar = tqdm(range(1, num_episodes + 1), desc="Training", unit="episode")
    
    eval_win_rates = []
    for episode in progress_bar:
        # Self-play episode
        winner, num_turns = self_play_episode(agent, training=True)
        
        # Update progress bar
        if verbose:
            progress_bar.set_postfix({
                "epsilon": f"{agent.dqn.epsilon:.4f}",
                "buffer": len(agent.dqn.replay_buffer),
                "reward": f"{agent.episode_rewards[-1]:.2f}" if agent.episode_rewards else "N/A",
                "winner": winner.name if winner else "N/A",
                "turns": num_turns
            })
        
        # Save model periodically
        if episode % save_interval == 0:
            model_path = os.path.join(models_dir, f"ur_dqn_model_episode_{episode}.h5")
            agent.save(model_path)
            if verbose:
                print(f"\nModel saved to {model_path}")
        
        # Plot metrics periodically
        if episode % plot_interval == 0:
            plot_path = f"plots/training_metrics_episode_{episode}.png"
            plot_training_metrics(agent, save_path=plot_path)
            if verbose:
                print(f"\nPlot saved to {plot_path}")
        
        # Evaluate agent periodically against a version with lower exploration
        if episode % eval_interval == 0:
            eval_agent = UrDQNAgent(epsilon_start=0.05, epsilon_min=0.01)
            eval_agent.dqn.primary_network.set_weights(agent.dqn.primary_network.get_weights())
            
            wins = 0
            eval_episodes = 100
            for _ in range(eval_episodes):
                eval_winner, _ = self_play_episode(agent, eval_agent, training=False)
                if eval_winner == Player.ONE:  # Our main agent is Player ONE
                    wins += 1
            
            win_rate = wins / eval_episodes
            eval_win_rates.append(win_rate)
            
            if verbose:
                print(f"\nEvaluation: Win rate {win_rate:.2f} after {episode} episodes")
            
            # Save a plot of evaluation win rates
            plt.figure(figsize=(10, 6))
            plt.plot(range(eval_interval, episode + 1, eval_interval), eval_win_rates)
            plt.title("Evaluation Win Rate")
            plt.xlabel("Episode")
            plt.ylabel("Win Rate")
            plt.ylim([0, 1])
            plt.savefig("plots/eval_win_rate.png")
            plt.close()
    
    # Save final model
    final_model_path = os.path.join(models_dir, "ur_dqn_model_final.h5")
    agent.save(final_model_path)
    
    # Final performance metrics
    total_time = time.time() - start_time
    if verbose:
        print(f"\nTraining completed in {total_time:.2f} seconds")
        print(f"Final model saved to {final_model_path}")
    
    return agent

if __name__ == "__main__":
    train(num_episodes=10000, verbose=True) 