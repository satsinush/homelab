# 🤖 Ollama AI LLM Server

Ollama runs local Large Language Models (LLMs) for inference.

* **Official Documentation:** [github.com/ollama/ollama/tree/main/docs](https://github.com/ollama/ollama/tree/main/docs)

---

## Overview

Ollama runs inside a container and provides an API endpoint for generating responses, embeddings, and chat completions. It powers the integrated AI Chatbot in the Homelab Dashboard.

## Architecture & Volume Paths

* **Container Name:** `ollama`
* **API Endpoint:** `http://ollama:11434` (internal Docker network)
* **Model Storage:** `./services/ollama/volumes/ollama/` (bind mount on host)

## Common Commands

```bash
# Pull a model into Ollama
docker exec -it ollama ollama pull llama3

# List downloaded models
docker exec -it ollama ollama list
```
