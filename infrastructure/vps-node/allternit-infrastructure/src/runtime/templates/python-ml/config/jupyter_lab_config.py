# JupyterLab Configuration for Python ML Environment
# Place this file at /etc/jupyter/jupyter_lab_config.py

c = get_config()  # noqa

# -----------------------------------------------------------------------------
# Server Configuration
# -----------------------------------------------------------------------------

# Allow all origins for CORS
c.ServerApp.allow_origin = '*'
c.ServerApp.allow_remote_access = True

# IP address to listen on
c.ServerApp.ip = '0.0.0.0'

# Port to listen on
c.ServerApp.port = 8888

# Disable browser opening on start
c.ServerApp.open_browser = False

# Root directory for notebooks
c.ServerApp.root_dir = '/workspace'

# Default URL to open
c.ServerApp.default_url = '/lab'

# Disable token authentication for development (set via environment variable)
import os
c.ServerApp.token = os.environ.get('JUPYTER_TOKEN', 'allternit-ml-dev')

# Allow passwordless access (for development only)
c.ServerApp.password = ''

# Disable check for XSS in output
c.ServerApp.disable_check_xsrf = True

# Trust all notebooks
c.ServerApp.trust_xheaders = True

# -----------------------------------------------------------------------------
# Kernel Configuration
# -----------------------------------------------------------------------------

# Kernel spec manager
c.ServerApp.kernel_spec_manager_class = 'jupyter_client.kernelspec.KernelSpecManager'

# Kernel manager
c.ServerApp.kernel_manager_class = 'jupyter_server.services.kernels.kernelmanager.MappingKernelManager'

# Session manager
c.ServerApp.session_manager_class = 'jupyter_server.services.sessions.sessionmanager.SessionManager'

# Contents manager
c.ServerApp.contents_manager_class = 'jupyter_server.services.contents.largefilemanager.LargeFileManager'

# -----------------------------------------------------------------------------
# Logging Configuration
# -----------------------------------------------------------------------------

# Log level: DEBUG, INFO, WARN, ERROR, CRITICAL
c.ServerApp.log_level = 'INFO'

# Log format
c.ServerApp.log_format = '[%(name)s] %(message)s'

# -----------------------------------------------------------------------------
# Extension Configuration
# -----------------------------------------------------------------------------

# Enable JupyterLab extensions
c.ServerApp.jpserver_extensions = {
    'jupyterlab': True,
    'jupyterlab_git': True,
}

# -----------------------------------------------------------------------------
# Lab Configuration
# -----------------------------------------------------------------------------

# Theme settings
c.LabApp.collaborative = True
c.LabApp.default_workspace = '/lab'

# Terminal settings
c.ServerApp.terminado_settings = {
    'shell_command': ['/bin/bash']
}

# -----------------------------------------------------------------------------
# Security Settings (Development Only)
# -----------------------------------------------------------------------------

# Disable HTTPS redirect
c.ServerApp.allow_root = True

# Increase limits for large file uploads
c.ServerApp.max_buffer_size = 2147483647  # 2GB
c.ServerApp.max_body_size = 2147483647     # 2GB
c.ServerApp.max_memory_mb = 4096           # 4GB

# -----------------------------------------------------------------------------
# Custom Settings
# -----------------------------------------------------------------------------

# Enable extensions
c.NotebookApp.nbserver_extensions = {
    'jupyter_nbextensions_configurator': True,
}

# Timeout settings
c.MappingKernelManager.cull_idle_timeout = 3600  # 1 hour
c.MappingKernelManager.cull_interval = 300       # 5 minutes
c.MappingKernelManager.cull_connected = False

# Auto-save interval (in seconds)
c.FileContentsManager.post_save_hook = None
c.FileContentsManager.delete_to_trash = False

# -----------------------------------------------------------------------------
# Environment Variables
# -----------------------------------------------------------------------------

# Pass environment variables to kernels
import os

c.ServerApp.env_keep = [
    'PATH',
    'PYTHONPATH',
    'LD_LIBRARY_PATH',
    'CUDA_HOME',
    'CUDA_VISIBLE_DEVICES',
    'MLFLOW_TRACKING_URI',
    'WANDB_API_KEY',
    'WANDB_PROJECT',
    'OPENAI_API_KEY',
    'HUGGINGFACE_TOKEN',
    'KAGGLE_USERNAME',
    'KAGGLE_KEY',
]
