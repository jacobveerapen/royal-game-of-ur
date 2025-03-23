"""
Parallel training script for the Royal Game of Ur reinforcement learning agent.
Speeds up training by using multiple processes.
"""
import os
import time
import multiprocessing
import numpy as np
import tensorflow as tf
from tqdm import tqdm

from rl_agent.dqn_agent import UrDQNAgent
from rl_agent.train import self_play_episode, plot_training_metrics

def worker_process(worker_id, episode_queue, result_queue, model_weights, config):
    """
    Worker process function that plays episodes in parallel.
    
    Args:
        worker_id: ID of this worker
        episode_queue: Queue with episodes to process
        result_queue: Queue to put results
        model_weights: Initial model weights
        config: Configuration dictionary
    """
    print(f"Worker {worker_id} started")
    
    # Create a worker-specific agent
    agent = UrDQNAgent(
        learning_rate=config['learning_rate'],
        discount_factor=config['discount_factor'],
        epsilon_start=config['epsilon'],
        epsilon_min=config['epsilon_min'],
        epsilon_decay=1.0,  # No decay in worker (handled by main process)
        batch_size=config['batch_size']
    )
    
    # Set the model weights from the main process
    agent.dqn.primary_network.set_weights(model_weights)
    
    # Process episodes until getting a None (signal to stop)
    while True:
        episode_num = episode_queue.get()
        if episode_num is None:
            break
            
        # Run an episode
        winner, num_turns = self_play_episode(agent, training=True)
        
        # Send results back
        experiences = list(agent.dqn.replay_buffer.buffer)
        result_queue.put({
            'episode': episode_num,
            'winner': winner,
            'turns': num_turns,
            'experiences': experiences,
            'reward': agent.cumulative_reward
        })
        
        # Reset reward for next episode
        agent.cumulative_reward = 0
    
    print(f"Worker {worker_id} finished")
    result_queue.put(None)  # Signal that this worker is done

def parallel_train(
    num_episodes=10000,
    save_interval=500,
    plot_interval=100,
    eval_interval=500,
    models_dir="models",
    num_workers=None,  # Default to number of CPU cores
    batch_size=128
):
    """
    Train the agent using multiple processes for parallel episodes.
    
    Args:
        num_episodes: Number of episodes to train for
        save_interval: How often to save the model
        plot_interval: How often to plot metrics
        eval_interval: How often to evaluate the agent
        models_dir: Directory to save models
        num_workers: Number of worker processes (default: CPU count)
        batch_size: Batch size for training
    """
    # Determine number of workers
    if num_workers is None:
        num_workers = multiprocessing.cpu_count()
    num_workers = min(num_workers, num_episodes, multiprocessing.cpu_count())
    
    print(f"Starting parallel training with {num_workers} workers")
    
    # Create directories
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs("plots", exist_ok=True)
    
    # Create main agent
    main_agent = UrDQNAgent(
        learning_rate=0.001,
        discount_factor=0.99,
        epsilon_start=1.0,
        epsilon_min=0.01,
        epsilon_decay=0.995,
        update_target_frequency=500,
        batch_size=batch_size,
        replay_buffer_size=100000,  # Larger buffer for parallel training
        double_dqn=True
    )
    
    # Create queues for communication
    episode_queue = multiprocessing.Queue()
    result_queue = multiprocessing.Queue()
    
    # Put all episodes in the queue
    for i in range(1, num_episodes + 1):
        episode_queue.put(i)
    
    # Put termination signals (one per worker)
    for _ in range(num_workers):
        episode_queue.put(None)
    
    # Start worker processes
    processes = []
    config = {
        'learning_rate': 0.001,
        'discount_factor': 0.99,
        'epsilon': main_agent.dqn.epsilon,
        'epsilon_min': main_agent.dqn.epsilon_min,
        'batch_size': batch_size
    }
    
    for worker_id in range(num_workers):
        p = multiprocessing.Process(
            target=worker_process,
            args=(worker_id, episode_queue, result_queue, 
                  main_agent.dqn.primary_network.get_weights(), config)
        )
        p.start()
        processes.append(p)
    
    # Process results and train
    start_time = time.time()
    completed_episodes = 0
    workers_done = 0
    
    with tqdm(total=num_episodes, desc="Training", unit="episode") as progress_bar:
        while workers_done < num_workers:
            # Get result from a worker
            result = result_queue.get()
            
            # Check if worker is done
            if result is None:
                workers_done += 1
                continue
                
            # Process the result
            episode = result['episode']
            experiences = result['experiences']
            
            # Add experiences to replay buffer
            for exp in experiences:
                main_agent.dqn.replay_buffer.add(*exp)
            
            # Train the agent
            loss = main_agent.train()
            
            # Track metrics
            main_agent.episode_rewards.append(result['reward'])
            main_agent.dqn.win_history.append(1 if result['winner'] == 1 else 0)
            
            # Update epsilon
            main_agent.dqn.decay_epsilon()
            
            # Update progress
            completed_episodes += 1
            progress_bar.update(1)
            progress_bar.set_postfix({
                'epsilon': f"{main_agent.dqn.epsilon:.4f}",
                'buffer': len(main_agent.dqn.replay_buffer),
                'reward': f"{result['reward']:.2f}",
                'turns': result['turns']
            })
            
            # Save model periodically
            if episode % save_interval == 0 or episode == num_episodes:
                model_path = os.path.join(models_dir, f"ur_dqn_model_episode_{episode}.h5")
                main_agent.save(model_path)
                print(f"\nModel saved to {model_path}")
            
            # Plot metrics periodically
            if episode % plot_interval == 0 or episode == num_episodes:
                plot_path = f"plots/training_metrics_episode_{episode}.png"
                plot_training_metrics(main_agent, save_path=plot_path)
                print(f"\nPlot saved to {plot_path}")
    
    # Wait for all workers to finish
    for p in processes:
        p.join()
    
    # Save final model
    final_model_path = os.path.join(models_dir, "ur_dqn_model_final.h5")
    main_agent.save(final_model_path)
    
    # Final performance metrics
    total_time = time.time() - start_time
    print(f"\nTraining completed in {total_time:.2f} seconds")
    print(f"Final model saved to {final_model_path}")
    
    return main_agent

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Train the Royal Game of Ur RL agent in parallel")
    parser.add_argument("--episodes", type=int, default=10000, help="Number of episodes to train for")
    parser.add_argument("--workers", type=int, default=None, help="Number of worker processes to use")
    parser.add_argument("--batch-size", type=int, default=128, help="Batch size for training")
    
    args = parser.parse_args()
    
    parallel_train(
        num_episodes=args.episodes,
        num_workers=args.workers,
        batch_size=args.batch_size
    ) 