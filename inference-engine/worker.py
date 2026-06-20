from src.worker.engine import start_worker_loop

if __name__ == "__main__":
    print("[*] Booting inference-engine Worker...")
    try:
        start_worker_loop()
    except KeyboardInterrupt:
        print("\n[-] Vision Worker shutting down gracefully.")
