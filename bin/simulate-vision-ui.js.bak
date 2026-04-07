/**
 * A2R Vision UI Simulation Script
 * Run this in your Browser Console (Cmd+Option+I in Electron) 
 * to see the pulsing markers and thought trace.
 */

function simulateVision() {
  console.log("🚀 Starting A2R Vision Simulation...");

  const traceMessages = [
    "Analyzing desktop layout...",
    "Found 'Calculator' icon at [450, 320]",
    "Moving cursor to target...",
    "Clicking '7' button...",
    "Action verified. Generating receipt rcpt_v12345."
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i >= traceMessages.length) {
      clearInterval(interval);
      console.log("✅ Simulation Complete.");
      return;
    }

    const x = 300 + (Math.random() * 400);
    const y = 200 + (Math.random() * 300);
    
    const actionEvent = new CustomEvent("a2r:vision_action", {
      detail: {
        type: "vision_target",
        action: {
          id: "sim_" + Date.now(),
          x: x,
          y: y,
          type: "click",
          label: "A2R Vision: " + traceMessages[i]
        }
      }
    });
    window.dispatchEvent(actionEvent);
    
    console.log("Trace: " + traceMessages[i] + " at [" + x.toFixed(0) + ", " + y.toFixed(0) + "]");
    i++;
  }, 1500);
}

simulateVision();
