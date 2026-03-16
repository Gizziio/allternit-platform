;;; agent-shell-a2r.el --- A2rchitect integration for agent-shell  -*- lexical-binding: t; -*-

;; Copyright (C) 2024 A2rchitect Team

;; Author: A2rchitect Team
;; URL: https://github.com/a2rchitech/a2rchitech
;; Version: 0.1.0
;; Package-Requires: ((emacs "29.1") (agent-shell "0.40.1"))

;;; Commentary:
;;
;; This package provides A2rchitect (A2R) integration for agent-shell.
;;
;; It registers A2rchitect as an available agent that can be used
;; via agent-shell's TUI interface.
;;
;; Requirements:
;; - a2r-acp binary must be in PATH (built from agent-shell-acp-adapter)
;;
;; Usage:
;;   (require 'agent-shell-a2r)
;;   ;; Then use M-x agent-shell and select "A2rchitect"

;;; Code:

(require 'agent-shell)

(defgroup agent-shell-a2r nil
  "A2rchitect integration for agent-shell."
  :group 'agent-shell
  :prefix "agent-shell-a2r-")

(defcustom agent-shell-a2r-command
  '("a2r-acp")
  "Command and parameters for the A2rchitect ACP client.

The first element is the command name, and the rest are command parameters.

Ensure a2r-acp is in your PATH. It is built from:
  7-apps/agent-shell-acp-adapter/"
  :type '(repeat string)
  :group 'agent-shell-a2r)

(defcustom agent-shell-a2r-environment
  nil
  "Environment variables for the A2rchitect ACP client.

This should be a list of environment variables to be used when
starting the A2rchitect client process."
  :type '(repeat string)
  :group 'agent-shell-a2r)

(defun agent-shell-a2r--welcome-message (config)
  "Return A2rchitect welcome message using SHELL-MAKER CONFIG."
  (concat "\n\n"
          "   A2rchitect Agent Shell\n"
          "   Agentic OS Platform - ACP Adapter\n\n"
          (shell-maker-welcome-message config)))

(defun agent-shell-a2r-make-config ()
  "Create an A2rchitect agent configuration.

Returns an agent configuration alist using `agent-shell-make-agent-config'.

This configuration allows agent-shell to connect to a2rchitect via
 the ACP adapter (a2r-acp)."
  (agent-shell-make-agent-config
   :identifier 'a2r
   :mode-line-name "A2R"
   :buffer-name "A2rchitect"
   :shell-prompt "A2R> "
   :shell-prompt-regexp "A2R> "
   :welcome-function #'agent-shell-a2r--welcome-message
   :client-maker (lambda (buffer)
                   (agent-shell-a2r--make-client :buffer buffer))
   :install-instructions "Build from source: cargo build --release -p agent-shell-acp-adapter"))

(cl-defun agent-shell-a2r--make-client (&key buffer)
  "Create an A2rchitect ACP client with BUFFER as context.

See `agent-shell-a2r-command' for command configuration and
`agent-shell-a2r-environment' for environment variables."
  (unless buffer
    (error "Missing required argument: :buffer"))
  (let ((command (car agent-shell-a2r-command)))
    (unless (executable-find command)
      (error "a2r-acp not found in PATH. Build it with: cargo build --release -p agent-shell-acp-adapter"))
    (agent-shell--make-acp-client :command command
                                  :command-params (cdr agent-shell-a2r-command)
                                  :environment-variables agent-shell-a2r-environment
                                  :context-buffer buffer)))

;;;###autoload
(defun agent-shell-a2r-start ()
  "Start an interactive A2rchitect agent shell."
  (interactive)
  (agent-shell--dwim :config (agent-shell-a2r-make-config)
                     :new-shell t))

;; Register A2rchitect as an available agent (if variable exists)
(with-eval-after-load 'agent-shell
  (when (boundp 'agent-shell-available-configs)
    (add-to-list 'agent-shell-available-configs
                 (cons "A2rchitect" #'agent-shell-a2r-make-config))))

(provide 'agent-shell-a2r)

;;; agent-shell-a2r.el ends here
