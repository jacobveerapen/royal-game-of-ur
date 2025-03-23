#!/usr/bin/env python3
"""
Demo script for the Royal Game of Ur Reinforcement Learning agent.
Shows how to train, evaluate, and play against the agent.
"""
import argparse
import os
import time
import numpy as np
import matplotlib.pyplot as plt
from backend.ur_game.game import Game
from backend.ur_game.game.board import Player

from rl_agent.dqn_agent import UrDQNAgent
from rl_agent.state_representation import StateRepresentation
from rl_agent.train import train, self_play_episode
from rl_agent.play import play_game

def demo_quick_train(episodes=100, verbose=True):
    """Run a quick training demo with few episodes."""
    if verbose:
        print("\n===== QUICK TRAINING DEMO =====")
        print(f"Training for {episodes} episodes... This may take a few minutes.")
    
    # Run training with fewer episodes for demo purposes
    agent = train(num_episodes=episodes, save_interval=50, plot_interval=50, verbose=verbose)
    
    if verbose:
        print("\nTraining complete!")
        print("Model saved to models/ur_dqn_model_final.h5")
        print("Training plots saved to plots/ directory")

def demo_visualize_state():
    """Visualize the state representation."""
    print("\n===== STATE REPRESENTATION DEMO =====")
    
    # Create a game and make some moves
    game = Game()
    game.roll_dice()
    valid_moves = game.get_valid_moves()
    
    if valid_moves:
        game.make_move(list(valid_moves)[0])
    
    # Get the state representation
    state = StateRepresentation.get_state(game)
    
    # Print the dimensions
    print(f"State shape: {state.shape}")
    
    # Visualize channels
    channel_names = [
        "Player One Pieces", 
        "Player Two Pieces", 
        "Rosettes", 
        "Valid Moves", 
        "Dice Roll", 
        "Hand Pieces", 
        "Completed Pieces"
    ]
    
    fig, axes = plt.subplots(3, 3, figsize=(15, 12))
    fig.suptitle("State Representation Channels", fontsize=16)
    
    for i, name in enumerate(channel_names):
        ax = axes[i // 3, i % 3]
        im = ax.imshow(state[:, :, i], cmap='viridis')
        ax.set_title(name)
        fig.colorbar(im, ax=ax)
    
    # Hide the unused subplot
    axes[2, 1].axis('off')
    axes[2, 2].axis('off')
    
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig("state_visualization.png")
    print("State visualization saved to state_visualization.png")
    
    # Show current board state for reference
    print("\nCurrent Game Board:")
    print(game.board)

def demo_agent_vs_random(model_path=None, episodes=100):
    """Test the agent against a random player."""
    print("\n===== AGENT VS RANDOM PLAYER DEMO =====")
    
    # Create agents
    if model_path and os.path.exists(model_path):
        # Load trained agent
        print(f"Loading model from {model_path}")
        agent1 = UrDQNAgent(epsilon_start=0.05)
        agent1.load(model_path)
    else:
        # Create new agent with some exploration
        print("Using untrained agent with epsilon=0.1")
        agent1 = UrDQNAgent(epsilon_start=0.1)
    
    # Random agent (high exploration)
    agent2 = UrDQNAgent(epsilon_start=1.0)
    
    # Play games
    print(f"Playing {episodes} games against random player...")
    wins = 0
    
    for i in range(episodes):
        winner, turns = self_play_episode(agent1, agent2, training=False)
        if winner == Player.ONE:  # Agent 1 wins
            wins += 1
        
        # Progress update
        if (i + 1) % 10 == 0:
            print(f"Progress: {i+1}/{episodes} games, Win rate: {wins/(i+1):.2f}")
    
    win_rate = wins / episodes
    print(f"\nResults after {episodes} games:")
    print(f"Trained agent win rate: {win_rate:.2f}")
    print(f"Average random player win rate: {1-win_rate:.2f}")

def main():
    parser = argparse.ArgumentParser(description="Demo script for Royal Game of Ur RL agent")
    parser.add_argument("--demo", type=str, choices=["train", "play", "visualize", "evaluate"], 
                      default="play", help="Which demo to run")
    parser.add_argument("--model", type=str, default=None, 
                      help="Path to a trained model file (for play and evaluate demos)")
    parser.add_argument("--episodes", type=int, default=100, 
                      help="Number of episodes (for train and evaluate demos)")
    
    args = parser.parse_args()
    
    if args.demo == "train":
        demo_quick_train(args.episodes)
    elif args.demo == "play":
        print("\n===== PLAY AGAINST AI DEMO =====")
        play_game(args.model)
    elif args.demo == "visualize":
        demo_visualize_state()
    elif args.demo == "evaluate":
        demo_agent_vs_random(args.model, args.episodes)

if __name__ == "__main__":
    main() 