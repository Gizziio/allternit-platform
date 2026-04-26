# Python ML & Data Science Environment

A comprehensive, production-ready Machine Learning and Data Science development environment featuring Python 3.12, JupyterLab, PyTorch, TensorFlow, and a complete MLOps stack.

## 🌟 Features

- **Python 3.12** with modern tooling
- **JupyterLab 4.1+** with extensions and collaborative features
- **PyTorch 2.2+** with CUDA 12.1 support
- **TensorFlow 2.15** (optional, large download)
- **scikit-learn, XGBoost, LightGBM** for traditional ML
- **Hugging Face Transformers** for NLP
- **LangChain** for LLM applications
- **OpenCV** for computer vision
- **MLflow** for experiment tracking
- **Weights & Biases** integration
- **Poetry** for dependency management

## 🚀 Quick Start

### Using Docker Compose

```bash
# Clone or navigate to the template directory
cd python-ml

# Start all services
docker-compose up -d

# Access JupyterLab
open http://localhost:8888
```

### Using VS Code Dev Containers

1. Install the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
2. Open the project in VS Code
3. Press `F1` → "Dev Containers: Reopen in Container"

## 📁 Directory Structure

```
python-ml/
├── .devcontainer/          # VS Code dev container config
│   └── devcontainer.json
├── config/                 # Configuration templates
│   ├── pyproject.toml.template
│   ├── requirements.txt
│   └── jupyter_lab_config.py
├── notebooks/              # Jupyter notebooks
│   └── welcome.ipynb       # Getting started guide
├── scripts/                # Utility scripts
│   └── init-project.sh     # Initialization script
├── Dockerfile              # Main container image
├── docker-compose.yml      # Multi-service orchestration
├── template.json           # Allternit template metadata
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_GPU` | Enable NVIDIA GPU support | `true` |
| `JUPYTER_TOKEN` | Jupyter access token | `allternit-ml-dev` |
| `INCLUDE_TENSORFLOW` | Include TensorFlow (large) | `false` |
| `CUDA_VISIBLE_DEVICES` | GPU device selection | `0` |

### Template Variables (Allternit)

The following variables can be customized when creating a project from this template:

- **ENABLE_GPU**: Boolean - Enable CUDA GPU support
- **JUPYTER_TOKEN**: Secret - Authentication token for Jupyter
- **INCLUDE_TENSORFLOW**: Boolean - Include TensorFlow installation

## 🌐 Services

| Service | Port | Description |
|---------|------|-------------|
| JupyterLab | 8888 | Interactive notebooks and IDE |
| MLflow | 5000 | Experiment tracking and model registry |
| TensorBoard | 6006 | TensorFlow/PyTorch visualization |
| FastAPI/Apps | 8080 | Model serving and web apps |
| PostgreSQL | 5432 | MLflow metadata database |
| Redis | 6379 | Caching and message broker |
| MinIO API | 9000 | S3-compatible object storage |
| MinIO Console | 9001 | MinIO web interface |
| Weights & Biases | 8081 | Experiment tracking (optional) |

## 📦 Included Libraries

### Core Scientific Computing
- numpy, scipy, pandas
- PyTorch 2.2+ with CUDA
- PyTorch Lightning

### Machine Learning
- scikit-learn
- XGBoost, LightGBM, CatBoost
- imbalanced-learn

### Deep Learning & NLP
- Transformers (Hugging Face)
- Datasets, Accelerate, PEFT
- spaCy, NLTK, Gensim
- LangChain, OpenAI

### Computer Vision
- OpenCV
- Pillow, Albumentations
- timm (PyTorch Image Models)

### Visualization
- Matplotlib, Seaborn
- Plotly, Bokeh, Altair

### Experiment Tracking
- MLflow
- Weights & Biases
- TensorBoard, Sacred

### Web Frameworks
- FastAPI, Uvicorn
- Streamlit, Gradio
- Dash

### Utilities
- Pydantic, python-dotenv
- Hydra, OmegaConf
- Rich, tqdm, joblib

## 💻 Usage

### Running JupyterLab

```bash
# Via Docker Compose
docker-compose up -d python-ml

# Direct container
docker run -p 8888:8888 allternit/python-ml:latest
```

Access at: http://localhost:8888

Default token: `allternit-ml-dev`

### Using Poetry

```bash
# Initialize project
cd /workspace
poetry init

# Add dependencies
poetry add torch pandas scikit-learn

# Install dependencies
poetry install

# Run commands in virtual environment
poetry run python script.py

# Activate shell
poetry shell
```

### Running Tests

```bash
# Using pytest
pytest tests/

# With coverage
pytest --cov=src tests/

# Parallel execution
pytest -n auto tests/
```

### MLflow Tracking

```python
import mlflow

mlflow.set_tracking_uri("http://mlflow:5000")
mlflow.set_experiment("my-experiment")

with mlflow.start_run():
    mlflow.log_param("lr", 0.01)
    mlflow.log_metric("accuracy", 0.95)
    mlflow.sklearn.log_model(model, "model")
```

Access MLflow UI at: http://localhost:5000

### GPU Usage

```python
import torch

# Check GPU availability
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# Move model to GPU
model = model.to(device)

# Move data to GPU
data = data.to(device)
```

## 🐳 Docker Commands

```bash
# Build image
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f python-ml

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Access container shell
docker-compose exec python-ml bash

# Run GPU-enabled container
docker run --gpus all -p 8888:8888 allternit/python-ml:latest
```

## 🔌 VS Code Extensions

The devcontainer includes these pre-configured extensions:

- Python & Pylance
- Jupyter & Notebook support
- Black formatter, Flake8, Mypy
- GitLens & Git Graph
- Docker
- YAML, TOML support
- Markdown All in One
- Error Lens
- GitHub Copilot (if available)

## 📝 Example Notebooks

### Welcome Notebook

Open `notebooks/welcome.ipynb` for a guided tour including:
- Environment verification
- PyTorch GPU operations
- scikit-learn model training
- Hugging Face Transformers
- Data visualization
- MLflow experiment tracking

## 🔒 Security

- Jupyter token authentication enabled by default
- PostgreSQL with password protection
- MinIO with access keys
- No root access required for development

## 🛠️ Customization

### Adding New Dependencies

**Via Poetry:**
```bash
poetry add <package>
```

**Via pip:**
```bash
pip install <package>
```

**In Dockerfile:**
```dockerfile
RUN pip install your-package
```

### Modifying Jupyter Config

Edit `config/jupyter_lab_config.py` to customize:
- Authentication settings
- Server behavior
- Extension loading
- Security settings

### GPU Support

The template includes NVIDIA CUDA 12.1 support. To disable GPU:

```bash
export ENABLE_GPU=false
docker-compose up -d
```

## 🐛 Troubleshooting

### GPU Not Detected

```bash
# Check NVIDIA drivers
nvidia-smi

# Verify Docker GPU support
docker run --gpus all nvidia/cuda:12.1-base nvidia-smi
```

### Port Conflicts

Modify `docker-compose.yml` to change port mappings:

```yaml
ports:
  - "8889:8888"  # Use 8889 on host
```

### Out of Memory

Increase Docker memory limits in Docker Desktop settings or use:

```bash
docker-compose exec python-ml python -c "import torch; torch.cuda.empty_cache()"
```

## 📚 Resources

- [PyTorch Documentation](https://pytorch.org/docs/)
- [JupyterLab Documentation](https://jupyterlab.readthedocs.io/)
- [MLflow Documentation](https://mlflow.org/docs/latest/index.html)
- [Hugging Face Docs](https://huggingface.co/docs)
- [LangChain Documentation](https://python.langchain.com/)

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please submit issues and pull requests.

## 🙏 Acknowledgments

- PyTorch Team
- Jupyter Project
- Hugging Face
- MLflow Community

---

**Maintained by Allternit** | Built for ML Engineers and Data Scientists
