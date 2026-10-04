# Gemma on a DigitalOcean GPU Droplet

The friend's laptop can't run Gemma 12B, so the hosted version serves it from a GPU Droplet.
The app talks to it through the same OpenAI-compatible API as local Ollama. Only the URL changes.

1. Create a GPU Droplet (an Ollama 1-Click image if one is offered, otherwise Ubuntu + `curl -fsSL https://ollama.com/install.sh | sh`).
2. On the droplet:
   ```bash
   ollama pull gemma3:12b
   ollama pull nomic-embed-text
   sudo systemctl edit ollama   # add: Environment="OLLAMA_HOST=0.0.0.0"
   sudo systemctl restart ollama
   ```
3. Lock it down: a DigitalOcean Cloud Firewall that only allows port 11434 from your Render service's outbound IPs (or put Caddy with basic auth in front).
4. In Render (or `.env`):
   ```
   LLM_BASE_URL=http://<droplet-ip>:11434/v1
   LLM_MODEL=gemma3:12b
   LLM_HOST_LABEL=DigitalOcean GPU
   ```
5. Destroy the droplet when you're done demoing. GPU droplets bill by the hour.

The same droplet can serve as the **teacher** for `tinker/make_dataset.py` (`--teacher gemma3:27b`).
