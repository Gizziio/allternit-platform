import React, { useEffect, useRef, useState } from 'react';
import { navigateTo } from '../../../host/browserActions';

interface BrowserViewProps {
  initialUrl?: string;
}

export const BrowserViewComponent: React.FC<BrowserViewProps> = ({ initialUrl = 'https://example.com' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);

  useEffect(() => {
    if (containerRef.current) {
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      // Create browser UI elements
      const browserContainer = document.createElement('div');
      browserContainer.style.width = '100%';
      browserContainer.style.height = '100%';
      browserContainer.style.display = 'flex';
      browserContainer.style.flexDirection = 'column';
      browserContainer.style.backgroundColor = '#f0f0f0';
      
      // Create top bar
      const topBar = document.createElement('div');
      topBar.className = 'ax-browser-top-bar';
      topBar.style.height = '56px';
      topBar.style.backgroundColor = 'white';
      topBar.style.borderBottom = '1px solid #ddd';
      topBar.style.display = 'flex';
      topBar.style.alignItems = 'center';
      topBar.style.padding = '0 16px';
      topBar.style.gap = '12px';
      
      // Back button
      const backButton = document.createElement('button');
      backButton.innerHTML = '←';
      backButton.title = 'Back';
      backButton.style.width = '32px';
      backButton.style.height = '32px';
      backButton.style.border = '1px solid #ddd';
      backButton.style.borderRadius = '4px';
      backButton.style.background = 'white';
      backButton.style.cursor = 'pointer';
      
      // Forward button
      const forwardButton = document.createElement('button');
      forwardButton.innerHTML = '→';
      forwardButton.title = 'Forward';
      forwardButton.style.width = '32px';
      forwardButton.style.height = '32px';
      forwardButton.style.border = '1px solid #ddd';
      forwardButton.style.borderRadius = '4px';
      forwardButton.style.background = 'white';
      forwardButton.style.cursor = 'pointer';
      
      // Reload button
      const reloadButton = document.createElement('button');
      reloadButton.innerHTML = '↻';
      reloadButton.title = 'Reload';
      reloadButton.style.width = '32px';
      reloadButton.style.height = '32px';
      reloadButton.style.border = '1px solid #ddd';
      reloadButton.style.borderRadius = '4px';
      reloadButton.style.background = 'white';
      reloadButton.style.cursor = 'pointer';
      
      // Omnibox (URL/Search bar)
      const omnibox = document.createElement('input');
      omnibox.type = 'text';
      omnibox.value = currentUrl;
      omnibox.className = 'ax-browser-omnibox';
      omnibox.style.flex = '1';
      omnibox.style.height = '36px';
      omnibox.style.padding = '0 16px';
      omnibox.style.border = '1px solid #ddd';
      omnibox.style.borderRadius = '18px';
      omnibox.style.fontSize = '14px';
      
      // Context pill
      const contextPill = document.createElement('div');
      contextPill.textContent = 'Page';
      contextPill.style.padding = '4px 12px';
      contextPill.style.backgroundColor = '#e9ecef';
      contextPill.style.borderRadius = '12px';
      contextPill.style.fontSize = '12px';
      contextPill.style.fontWeight = '500';
      
      // Capture button
      const captureButton = document.createElement('button');
      captureButton.textContent = '📷';
      captureButton.title = 'Capture';
      captureButton.style.width = '32px';
      captureButton.style.height = '32px';
      captureButton.style.border = 'none';
      captureButton.style.background = 'transparent';
      captureButton.style.cursor = 'pointer';
      captureButton.style.fontSize = '16px';
      
      // A2 button
      const a2Button = document.createElement('button');
      a2Button.textContent = 'A2';
      a2Button.title = 'A2UI Panel';
      a2Button.style.width = '32px';
      a2Button.style.height = '32px';
      a2Button.style.border = '1px solid #0d6efd';
      a2Button.style.borderRadius = '4px';
      a2Button.style.background = '#0d6efd';
      a2Button.style.color = 'white';
      a2Button.style.cursor = 'pointer';
      a2Button.style.fontWeight = 'bold';
      
      topBar.appendChild(backButton);
      topBar.appendChild(forwardButton);
      topBar.appendChild(reloadButton);
      topBar.appendChild(omnibox);
      topBar.appendChild(contextPill);
      topBar.appendChild(captureButton);
      topBar.appendChild(a2Button);
      
      // Create main content area
      const mainArea = document.createElement('div');
      mainArea.className = 'ax-browser-main';
      mainArea.style.display = 'flex';
      mainArea.style.flex = '1';
      mainArea.style.overflow = 'hidden';
      
      // WebView area
      const webViewArea = document.createElement('div');
      webViewArea.className = 'ax-browser-webview';
      webViewArea.style.flex = '1';
      webViewArea.style.position = 'relative';
      webViewArea.style.overflow = 'hidden';
      webViewArea.style.backgroundColor = 'white';
      
      // Simulated web view content
      const webViewContent = document.createElement('div');
      webViewContent.style.width = '100%';
      webViewContent.style.height = '100%';
      webViewContent.style.padding = '20px';
      webViewContent.style.overflow = 'auto';
      webViewContent.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
          <h1>Welcome to A2rchitech Browser</h1>
          <p>This is a simulated web view. In a real implementation, this would be an actual web browser view.</p>
          <p>You can navigate to websites by entering a URL in the omnibox above.</p>
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <h3>A2UI Actions Available:</h3>
            <ul>
              <li>Summarize page content</li>
              <li>Extract structured data</li>
              <li>Clip selection to notes</li>
              <li>Turn page into tasks</li>
              <li>Annotate and pin highlights</li>
              <li>Cite sources</li>
            </ul>
          </div>
        </div>
      `;
      
      webViewArea.appendChild(webViewContent);
      
      // Create A2UI overlay container
      const a2uiOverlay = document.createElement('div');
      a2uiOverlay.id = 'a2ui-overlay';
      a2uiOverlay.style.position = 'absolute';
      a2uiOverlay.style.top = '0';
      a2uiOverlay.style.left = '0';
      a2uiOverlay.style.width = '100%';
      a2uiOverlay.style.height = '100%';
      a2uiOverlay.style.pointerEvents = 'none'; // Allow clicks to pass through to content
      a2uiOverlay.style.zIndex = '1000';
      
      webViewArea.appendChild(a2uiOverlay);
      
      // Create selection handler
      webViewContent.addEventListener('mouseup', () => {
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection && selection.toString().trim() !== '') {
            showA2UIActions(selection);
          } else {
            hideA2UIActions();
          }
        }, 1);
      });
      
      // Function to show A2UI action handles
      function showA2UIActions(selection: Selection) {
        // Clear any existing action handles
        hideA2UIActions();
        
        // Get the bounding rectangle of the selection
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Create action handle container
        const actionHandle = document.createElement('div');
        actionHandle.id = 'a2ui-action-handle';
        actionHandle.style.position = 'fixed';
        actionHandle.style.left = `${rect.left + window.scrollX}px`;
        actionHandle.style.top = `${rect.top + window.scrollY - 40}px`;
        actionHandle.style.background = '#3b82f6';
        actionHandle.style.color = 'white';
        actionHandle.style.borderRadius = '4px';
        actionHandle.style.padding = '4px 8px';
        actionHandle.style.fontSize = '12px';
        actionHandle.style.zIndex = '1001';
        actionHandle.style.pointerEvents = 'all'; // Enable interactions for the handle
        
        // Add action buttons
        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '4px';
        
        const actions = [
          { label: 'Summarize', action: 'summarize' },
          { label: 'Extract', action: 'extract' },
          { label: 'Clip', action: 'clip' },
          { label: 'Tasks', action: 'tasks' },
          { label: 'Annotate', action: 'annotate' },
          { label: 'Cite', action: 'cite' }
        ];
        
        actions.forEach(action => {
          const btn = document.createElement('button');
          btn.textContent = action.label;
          btn.style.background = 'transparent';
          btn.style.border = '1px solid white';
          btn.style.borderRadius = '3px';
          btn.style.color = 'white';
          btn.style.padding = '2px 6px';
          btn.style.fontSize = '10px';
          btn.style.cursor = 'pointer';
          btn.style.pointerEvents = 'all';
          
          btn.addEventListener('click', () => {
            handleA2UIAction(action.action, selection.toString());
            hideA2UIActions();
          });
          
          actionsContainer.appendChild(btn);
        });
        
        actionHandle.appendChild(actionsContainer);
        document.body.appendChild(actionHandle);
      }
      
      // Function to hide A2UI action handles
      function hideA2UIActions() {
        const existingHandle = document.getElementById('a2ui-action-handle');
        if (existingHandle) {
          existingHandle.remove();
        }
      }
      
      // Function to handle A2UI actions
      function handleA2UIAction(action: string, selectedText: string) {
        console.log(`A2UI Action: ${action}`, { selectedText });
        
        // In a real implementation, these would connect to the agent system
        switch (action) {
          case 'summarize':
            alert(`Summarizing selected text:\n\n${selectedText.substring(0, 100)}...`);
            break;
          case 'extract':
            alert(`Extracting structured data from:\n\n${selectedText.substring(0, 100)}...`);
            break;
          case 'clip':
            alert(`Clipping to notes:\n\n${selectedText.substring(0, 100)}...`);
            break;
          case 'tasks':
            alert(`Creating tasks from:\n\n${selectedText.substring(0, 100)}...`);
            break;
          case 'annotate':
            // Create a highlight annotation
            createHighlight(selectedText);
            break;
          case 'cite':
            alert(`Citing source for:\n\n${selectedText.substring(0, 100)}...`);
            break;
        }
      }
      
      // Function to create a highlight annotation
      function createHighlight(text: string) {
        const range = window.getSelection()?.getRangeAt(0);
        if (!range) return;
        
        // Create a wrapper for the highlighted text
        const highlightSpan = document.createElement('span');
        highlightSpan.style.backgroundColor = 'rgba(251, 191, 36, 0.3)'; // amber-300 with transparency
        highlightSpan.style.borderBottom = '2px solid #f59e0b'; // amber-500
        
        // Clone the range content and wrap it
        const content = range.extractContents();
        highlightSpan.appendChild(content);
        range.insertNode(highlightSpan);
        
        // Store the highlight for persistence
        console.log('Highlight created for:', text);
      }
      
      // Right dock (collapsible)
      const rightDock = document.createElement('div');
      rightDock.className = 'ax-browser-right-dock';
      rightDock.style.width = '300px';
      rightDock.style.backgroundColor = 'white';
      rightDock.style.borderLeft = '1px solid #ddd';
      rightDock.style.display = 'flex';
      rightDock.style.flexDirection = 'column';
      rightDock.style.overflow = 'hidden';
      
      // Right dock header
      const rightDockHeader = document.createElement('div');
      rightDockHeader.textContent = 'Agent Panel';
      rightDockHeader.style.padding = '12px 16px';
      rightDockHeader.style.fontWeight = '600';
      rightDockHeader.style.borderBottom = '1px solid #ddd';
      rightDockHeader.style.color = '#495057';
      
      // Right dock content
      const rightDockContent = document.createElement('div');
      rightDockContent.style.flex = '1';
      rightDockContent.style.padding = '16px';
      rightDockContent.style.overflowY = 'auto';
      
      rightDockContent.innerHTML = `
        <div>
          <h4>Current Plan</h4>
          <p>No active plan</p>
          
          <h4>Tasks</h4>
          <ul>
            <li>None</li>
          </ul>
          
          <h4>Tool Calls</h4>
          <p>None</p>
          
          <h4>Citations</h4>
          <p>None</p>
          
          <h4>Extracted Notes</h4>
          <p>None</p>
        </div>
      `;
      
      rightDock.appendChild(rightDockHeader);
      rightDock.appendChild(rightDockContent);
      
      // Put everything together
      mainArea.appendChild(webViewArea);
      mainArea.appendChild(rightDock);
      
      browserContainer.appendChild(topBar);
      browserContainer.appendChild(mainArea);
      
      // Add event listeners
      backButton.addEventListener('click', () => {
        console.log('Navigate back');
      });
      
      forwardButton.addEventListener('click', () => {
        console.log('Navigate forward');
      });
      
      reloadButton.addEventListener('click', () => {
        console.log('Reload page');
      });
      
      omnibox.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const url = omnibox.value.trim();
          if (url) {
            console.log('Navigate to:', url, '[intent: user]');
            setCurrentUrl(url);
            // User navigation uses HUMAN renderer (intent: user)
            navigateTo(url, 'user').catch(err => console.error('Navigation failed:', err));
          }
        }
      });
      
      a2Button.addEventListener('click', () => {
        alert('A2UI Panel opened');
      });
      
      captureButton.addEventListener('click', () => {
        alert('Capture action triggered');
      });
      
      containerRef.current.appendChild(browserContainer);
    }
  }, [currentUrl]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};