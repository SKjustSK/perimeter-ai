import threading
from src.api.app import run_api_server
from src.worker.engine import start_worker_loop

if __name__ == "__main__":
    print("[*] Booting inference-engine...")
    
    # Run API server in background and start blocking Redis worker loop
    api_thread = threading.Thread(target=run_api_server, daemon=True)
    api_thread.start()
    
    try:
        start_worker_loop()
    except KeyboardInterrupt:
        print("\n[-] Vision Worker shutting down gracefully.")