# TensorFlow-based Reinforcement Learning Bot for Royal Game of Ur

This module implements a Deep Q-Network (DQN) reinforcement learning agent for playing the Royal Game of Ur. The agent learns game strategies through self-play and can be trained to become a strong opponent.

## Architecture Overview

The implementation consists of the following components:

1. **State Representation**: Converts the game state into a tensor representation suitable for neural network input
2. **DQN Agent**: The core reinforcement learning algorithm that learns to predict Q-values for actions
3. **Training System**: Self-play mechanism for the agent to learn from playing against itself
4. **Play Interface**: Scripts to play against the trained agent

### State Representation

The game state is represented as a 3D tensor with shape (3, 8, 7), where:
- 3 rows and 8 columns represent the board layout
- 7 channels encode different aspects of the game state:
  - Player one pieces
  - Player two pieces
  - Rosette positions
  - Valid moves
  - Dice roll
  - Pieces in hand
  - Completed pieces

### Neural Network Architecture

The DQN uses a Convolutional Neural Network (CNN) with the following architecture:
- 2D Convolutional layers to process the board state
- Fully connected layers to make final decision
- Output layer provides Q-values for each possible action

### Reward Function

The agent receives rewards for:
- Winning the game (+10.0)
- Completing a piece (+1.0)
- Capturing an opponent's piece (+0.8)
- Landing on a rosette (+0.5)
- Moving a piece out of hand (+0.1)

Penalties are given for:
- Losing the game (-5.0)
- Not efficiently using high dice rolls (-0.1)

## Installation Requirements

Required packages:
- TensorFlow 2.15.0
- NumPy
- Matplotlib
- pandas
- tqdm

To install all dependencies:

```bash
pip install -r requirements.txt
```

## Training the Agent

To train the reinforcement learning agent:

```bash
python -m rl_agent.train
```

Optional arguments:
- `--episodes`: Number of episodes to train (default: 10000)
- `--save-interval`: Episodes between model saves (default: 500)
- `--plot-interval`: Episodes between metric plotting (default: 100)

The training process uses self-play, where the agent plays against itself and learns from experience. Training metrics are logged to TensorBoard and saved as plots in the `plots` directory.

## Playing Against the Trained Agent

After training, you can play against the agent using:

```bash
python -m rl_agent.play --model models/ur_dqn_model_final.h5
```

Optional arguments:
- `--model`: Path to the trained model file
- `--ai-first`: Let the AI play first (by default, human plays first)

## Integration with Existing Game

The agent can be integrated with the existing game implementation:

```bash
python run_game_with_ai.py --model models/ur_dqn_model_final.h5 --ai-player 2
```

Optional arguments:
- `--model`: Path to the trained model file
- `--ai-player`: Which player the AI should play as (1 or 2, default: 2)
- `--quiet`: Run in quiet mode (no output)

## Performance Considerations

The implementation is optimized for a MacBook Pro with 48GB unified memory. The DQN architecture and batch sizes are configured to provide a good balance between learning performance and hardware requirements.

## Adjustable Parameters

The agent's behavior can be customized by adjusting the following parameters:

- `learning_rate`: Controls how quickly the agent learns (default: 0.001)
- `discount_factor`: Determines how much future rewards are valued (default: 0.99)
- `epsilon_start`: Initial exploration rate (default: 1.0)
- `epsilon_min`: Minimum exploration rate (default: 0.01)
- `epsilon_decay`: Rate at which exploration decreases (default: 0.995)
- `replay_buffer_size`: Size of the experience replay buffer (default: 50000)

These parameters can be adjusted in `rl_agent/train.py` before training.

## How It Works

1. The agent observes the game state, encoded as a tensor
2. It uses its neural network to predict the Q-values for each possible action
3. During training, it follows an epsilon-greedy policy (balancing exploration and exploitation)
4. After each move, it calculates a reward based on the game outcome
5. The experiences are stored in a replay buffer and used to train the neural network
6. As training progresses, the agent improves its strategy by updating the Q-values based on observed rewards

The agent uses Double DQN, which helps prevent overestimation of Q-values and provides more stable learning. 