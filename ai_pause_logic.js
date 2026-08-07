
// ==========================================
// AI PAUSE TOGGLE LOGIC
// ==========================================

async function toggleAIPause() {
  if (!activeInboxContact) return;
  
  const toggleLabel = document.getElementById('ai-toggle-label');
  if (!toggleLabel) return;
  
  // Optimistic UI update
  const isCurrentlyPaused = toggleLabel.innerText.includes('PAUSED');
  const newPausedState = !isCurrentlyPaused;
  
  toggleLabel.innerText = newPausedState ? '⏸️ AI: PAUSED' : '🤖 AI: ON';
  toggleLabel.style.color = newPausedState ? '#e1306c' : '#111b21';
  
  try {
    // Update the leads table to set is_ai_paused
    const { error } = await supabase
      .from('leads')
      .update({ is_ai_paused: newPausedState })
      .eq('user_id', currentUser.id)
      .eq('customer_phone', activeInboxContact);
      
    if (error) throw error;
    
    console.log("AI Pause state updated to:", newPausedState);
  } catch (err) {
    console.error("Failed to toggle AI Pause:", err);
    // Revert optimistic UI
    toggleLabel.innerText = isCurrentlyPaused ? '⏸️ AI: PAUSED' : '🤖 AI: ON';
    toggleLabel.style.color = isCurrentlyPaused ? '#e1306c' : '#111b21';
    alert("Failed to update AI Pause state.");
  }
}

// Attach listener
setTimeout(() => {
  const toggleBtn = document.getElementById('btn-toggle-ai');
  if (toggleBtn) {
    toggleBtn.onclick = toggleAIPause;
  }
}, 2500);

// Modify loadInboxChat to check AI pause state
const originalLoadInboxChat = loadInboxChat;
loadInboxChat = async function(lead) {
  // Call the original
  await originalLoadInboxChat(lead);
  
  // Update toggle based on lead state
  const toggleLabel = document.getElementById('ai-toggle-label');
  if (toggleLabel) {
    const isPaused = lead.is_ai_paused || false;
    toggleLabel.innerText = isPaused ? '⏸️ AI: PAUSED' : '🤖 AI: ON';
    toggleLabel.style.color = isPaused ? '#e1306c' : '#111b21';
  }
};
